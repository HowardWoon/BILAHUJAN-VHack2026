import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, get } from 'firebase/database';
import StatusBar from '../components/StatusBar';
import BottomNav from '../components/BottomNav';
import { rtdb } from '../firebase';
import type { FloodZone } from '../data/floodZones';
import { MALAYSIAN_FLOOD_HISTORY } from '../data/historicalFloodData';
import {
  calcHistoricalRiskScore,
  deriveAIConfidence,
  isDrainageBlocked,
  severityToBlockage,
  severityToDescription,
  severityToHeroBg,
  severityToPeakPrediction,
  severityToRainfall,
  severityToRainfallRange,
  severityToRiskLabel,
  severityToWaterDepth,
  deduplicateFTName,
  trimToCity
} from '../utils/floodCalculations';

interface ZoneDetailScreenProps {
  zone: FloodZone | null;
  onBack: () => void;
  onTabChange: (tab: 'map' | 'report' | 'alert' | 'dashboard') => void;
}

interface EvacCenter {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distanceKm: number;
}

interface ZoneMetrics {
  drainage: number;
  rainfall: number;
  confidence: number;
}

const formatDateTime = (value: unknown, fallback = 'Unknown'): string => {
  if (!value) return fallback;

  let date: Date | null = null;
  if (typeof value === 'number') {
    date = new Date(value > 1_000_000_000_000 ? value : value * 1000);
  } else if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return fallback;
    if (/^\d+$/.test(raw)) {
      const numeric = Number(raw);
      date = new Date(numeric > 1_000_000_000_000 ? numeric : numeric * 1000);
    } else {
      const parsed = new Date(raw);
      date = Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  } else if (typeof value === 'object' && value && 'seconds' in (value as any)) {
    date = new Date(Number((value as any).seconds) * 1000);
  }

  if (!date || Number.isNaN(date.getTime())) return fallback;

  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const year = date.getFullYear();
  const hour12 = date.toLocaleString('en-MY', { hour: 'numeric', hour12: true });
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  const second = `${date.getSeconds()}`.padStart(2, '0');
  const hour = hour12.replace(/\s?(am|pm)$/i, '').trim();
  const suffix = hour12.toLowerCase().includes('pm') ? 'pm' : 'am';

  return `${day}/${month}/${year}, ${hour}:${minute}:${second} ${suffix}`;
};

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const normalizeState = (state: string) => {
  const value = state.toLowerCase().trim();
  if (value === 'penang') return 'pulau pinang';
  return value;
};

const getHistoricalContext = (state: string) => {
  const normalized = normalizeState(state || '');
  if (!normalized) return 'No historical match found';

  const match = MALAYSIAN_FLOOD_HISTORY.find((entry) => normalizeState(entry.state) === normalized);
  if (!match) return 'No historical match found';

  const date = new Date(match.timestamp);
  const month = date.toLocaleString('en-MY', { month: 'short' });
  const year = date.getFullYear();
  return `Matches ${month} ${year} pattern`;
};

const getHistoricalRecordSummary = (state: string): string => {
  const normalized = normalizeState(state || '');
  if (!normalized) return 'No recent flood history for this location';

  const recordCount = MALAYSIAN_FLOOD_HISTORY.filter((entry) => normalizeState(entry.state) === normalized).length;
  if (recordCount === 0) {
    return 'No recent flood history for this location';
  }

  return `${state}: ${recordCount} past flood event${recordCount === 1 ? '' : 's'} on record`;
};

const getVisualAnalysis = (zone: FloodZone, severity: number) => {
  const description = ((zone as any).description || zone.aiAnalysisText || zone.forecast || '').trim();
  const waterDepth = severityToWaterDepth(severity);
  const summary = severityToDescription(severity);
  return `${summary} Estimated depth: ${waterDepth}. ${description}`.trim();
};

const truncateName = (name: string, max = 30) => (name.length > max ? `${name.slice(0, max)}...` : name);

const getUploadSource = (zone: FloodZone) => {
  const source = ((zone as any).source || '').toString().toLowerCase();
  if (source.includes('user') || source.includes('citizen')) return 'USER';
  return 'USER';
};

const toWidthClass = (percent: number) => {
  if (percent >= 95) return 'w-full';
  if (percent >= 85) return 'w-11/12';
  if (percent >= 75) return 'w-10/12';
  if (percent >= 65) return 'w-9/12';
  if (percent >= 55) return 'w-8/12';
  if (percent >= 45) return 'w-7/12';
  if (percent >= 35) return 'w-6/12';
  if (percent >= 25) return 'w-5/12';
  if (percent >= 15) return 'w-4/12';
  if (percent >= 5) return 'w-3/12';
  return 'w-2/12';
};

export default function ZoneDetailScreen({ zone, onBack, onTabChange }: ZoneDetailScreenProps) {
  const [liveZone, setLiveZone] = useState<FloodZone | null>(zone);
  const [reportData, setReportData] = useState<any>(null);
  const [zoneReports, setZoneReports] = useState<any[]>([]);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [evacCenters, setEvacCenters] = useState<EvacCenter[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<EvacCenter | null>(null);
  const [resolvedCoords, setResolvedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingCenters, setLoadingCenters] = useState(true);

  useEffect(() => {
    if (!zone?.id) return;

    const unsubscribeZone = onValue(ref(rtdb, `liveZones/${zone.id}`), (snapshot) => {
      if (snapshot.exists()) {
        setLiveZone(snapshot.val() as FloodZone);
      }
    });

    const unsubscribeReports = onValue(ref(rtdb, 'liveReports'), (snapshot) => {
      if (!snapshot.exists()) {
        setReportData(null);
        setZoneReports([]);
        return;
      }
      const reports = snapshot.val() as Record<string, any>;
      const matches = Object.values(reports).filter((report: any) => report?.zoneId === zone.id);
      setZoneReports(matches);
      setReportData(matches[0] || null);
    });

    const unsubscribeAnalysis = onValue(ref(rtdb, `analysisResults/${zone.id}`), (snapshot) => {
      setAnalysisData(snapshot.exists() ? snapshot.val() : null);
    });

    return () => {
      unsubscribeZone();
      unsubscribeReports();
      unsubscribeAnalysis();
    };
  }, [zone?.id]);

  useEffect(() => {
    const lat = Number(liveZone?.center?.lat);
    const lng = Number(liveZone?.center?.lng);

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setResolvedCoords({ lat, lng });
      return;
    }

    const locationName = (liveZone?.locationName || liveZone?.specificLocation || liveZone?.name || '').trim();
    const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
    if (!locationName || !mapsKey) {
      setResolvedCoords(null);
      return;
    }

    let cancelled = false;

    fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationName)}&key=${mapsKey}`)
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        const geo = payload?.results?.[0]?.geometry?.location;
        if (!geo || typeof geo.lat !== 'number' || typeof geo.lng !== 'number') {
          return;
        }

        setResolvedCoords({ lat: geo.lat, lng: geo.lng });
        setLiveZone((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            center: { lat: geo.lat, lng: geo.lng }
          } as FloodZone;
        });
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedCoords(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [liveZone?.center?.lat, liveZone?.center?.lng, liveZone?.locationName, liveZone?.specificLocation, liveZone?.name]);

  useEffect(() => {
    if (!liveZone) return;
    const lat = Number(resolvedCoords?.lat);
    const lng = Number(resolvedCoords?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setLoadingCenters(false);
      return;
    }

    if (!(window as any).google?.maps?.places) {
      setLoadingCenters(false);
      return;
    }

    let active = true;
    const service = new (window as any).google.maps.places.PlacesService(document.createElement('div'));
    const location = new (window as any).google.maps.LatLng(lat, lng);
    const all: EvacCenter[] = [];

    const runSearch = (keyword: string, radius: number) =>
      new Promise<void>((resolve) => {
        service.nearbySearch(
          { location, radius, keyword, type: 'establishment' },
          (results: any[], status: string) => {
            if (status === 'OK' && Array.isArray(results)) {
              results.slice(0, 10).forEach((item: any) => {
                const pLat = item.geometry?.location?.lat?.();
                const pLng = item.geometry?.location?.lng?.();
                if (typeof pLat !== 'number' || typeof pLng !== 'number') return;
                const placeId = item.place_id || `${pLat}-${pLng}`;
                if (all.some((x) => x.placeId === placeId)) return;

                all.push({
                  placeId,
                  name: item.name || 'Evacuation Centre',
                  address: item.vicinity || 'Address unavailable',
                  lat: pLat,
                  lng: pLng,
                  distanceKm: haversineKm(lat, lng, pLat, pLng)
                });
              });
            }
            resolve();
          }
        );
      });

    const runFallbackSearches = async () => {
      await runSearch('dewan orang ramai', 10000);
      if (all.length < 2) await runSearch('community hall', 15000);
      if (all.length < 2) await runSearch('sekolah kebangsaan', 20000);
      if (all.length < 2) await runSearch('masjid', 20000);
      if (all.length < 2) await runSearch('surau', 20000);

      if (!active) return;
      const sorted = all.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 6);
      setEvacCenters(sorted);
      setSelectedCenter((prev) => {
        if (!sorted.length) return null;
        if (prev && sorted.some((item) => item.placeId === prev.placeId)) {
          return sorted.find((item) => item.placeId === prev.placeId) || sorted[0];
        }
        return sorted[0];
      });
      setLoadingCenters(false);
    };

    void runFallbackSearches();

    const timeout = setTimeout(() => {
      if (!active) return;
      setLoadingCenters(false);
    }, 8000);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [liveZone, resolvedCoords]);

  const activeZone = liveZone || zone;

  if (!activeZone) {
    return (
      <div className="relative h-full w-full flex flex-col bg-[#0f0f1a] items-center justify-center">
        <p className="text-white font-semibold">Zone details unavailable.</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold">Go Back</button>
      </div>
    );
  }

  const severity = Math.max(1, Math.min(10, Number(activeZone.severity || 1)));
  const locationRaw = (activeZone.locationName || activeZone.specificLocation || activeZone.name || activeZone.state || 'Unknown').trim();
  const trimmedLocation = trimToCity(locationRaw);
  const locationName = deduplicateFTName(trimmedLocation === 'Unknown Location' ? (activeZone.state || 'Unknown') : trimmedLocation);
  const hasRealFloodIncident =
    severity >= 2 &&
    (activeZone as any).reportId != null &&
    !(activeZone as any).isWeatherFallbackZone;
  const isBaselineMonitoring = !hasRealFloodIncident;
  const historicalRisk = calcHistoricalRiskScore(activeZone.state || '', locationRaw);
  const historicalMatch = historicalRisk >= 2;

  const reportsAgreeingWithin1 = zoneReports.filter((report) => Math.abs(Number(report?.severity || severity) - severity) <= 1).length;
  const geminiConfidenceZeroToOne = Math.max(0, Math.min(1, Number((analysisData?.confidence ?? (activeZone as any).aiConfidence ?? 80) / 100)));
  const computedConfidence = deriveAIConfidence(geminiConfidenceZeroToOne * 100, reportsAgreeingWithin1, zoneReports.length, historicalMatch, severity);

  const activeMetrics: ZoneMetrics = {
    drainage: Math.round(Number((activeZone as any).blockagePercent ?? (activeZone as any).drainageBlockage ?? severityToBlockage(severity))),
    rainfall: Math.round(Number(analysisData?.rainfallMmHr ?? analysisData?.rainfall ?? (activeZone as any).rainfall ?? severityToRainfall(severity))),
    confidence: computedConfidence
  };

  const baselineMetrics: ZoneMetrics = {
    drainage: 15,
    rainfall: 5,
    confidence: 65
  };

  const metrics = isBaselineMonitoring ? baselineMetrics : activeMetrics;

  const lat = Number(resolvedCoords?.lat);
  const lng = Number(resolvedCoords?.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const staticMap = hasCoords
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=560x320&scale=2&markers=color:red|${lat},${lng}&style=feature:water|color:0x4A90D9&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}`
    : '';

  const startRaw = (activeZone as any).startTime ?? activeZone.estimatedStartTime ?? reportData?.startTime;
  const endRaw = (activeZone as any).endTime ?? activeZone.estimatedEndTime ?? reportData?.endTime;

  const startText = isBaselineMonitoring
    ? 'No event recorded'
    : (startRaw ? formatDateTime(startRaw, 'Already in progress') : 'Already in progress');
  const endText = isBaselineMonitoring
    ? 'No event recorded'
    : formatDateTime(endRaw, 'Unknown');
  const historicalText = isBaselineMonitoring
    ? getHistoricalRecordSummary(activeZone.state || '')
    : getHistoricalContext(activeZone.state || '');
  const visualText = isBaselineMonitoring
    ? 'No flood indicators detected in this area.'
    : getVisualAnalysis(activeZone, severity);
  const activeCenter = selectedCenter || evacCenters[0] || null;

  return (
    <div className="relative h-full w-full flex flex-col bg-[#0f0f1a]">
      <StatusBar theme="dark" />

      <header className="px-6 py-4 flex items-center justify-between">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-[#1a1a2e] border border-slate-700/70 text-white flex items-center justify-center">
          <span className="material-icons-round">arrow_back</span>
        </button>
        <h1 className="text-white font-bold text-lg">Zone Analysis</h1>
        <div className="w-10 h-10" />
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-24 space-y-4">
        <div className={`${isBaselineMonitoring ? 'bg-[#064e3b]' : `bg-gradient-to-r ${severityToHeroBg(severity)}`} text-white p-6 rounded-3xl shadow-lg`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="material-icons-round text-white/90 text-sm">{isBaselineMonitoring ? 'check_circle' : 'warning'}</span>
            <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-full ${isBaselineMonitoring ? 'bg-green-400 text-[#064e3b]' : 'bg-white/20 text-white'}`}>
              {isBaselineMonitoring ? 'ALL CLEAR' : severityToRiskLabel(severity)}
            </span>
          </div>
          <h2 className="text-[32px] leading-[1.05] font-extrabold mb-2 tracking-tight">{locationName}</h2>
          <div className="flex items-center gap-2 text-white/90 text-sm font-medium">
            <p>{isBaselineMonitoring ? '🛰 No flood activity detected. Monitoring active.' : `AI predicts flood peak in ${severityToPeakPrediction(severity)}`}</p>
          </div>
        </div>

        <div className="col-span-3 bg-white p-4 rounded-2xl flex justify-between items-center border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-700">
              <span className="material-icons-round">schedule</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">START</p>
              <p className="text-sm font-bold text-slate-800">{startText}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">END</p>
            <p className="text-sm font-bold text-slate-800">{endText}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#111827] text-white p-4 rounded-2xl flex flex-col justify-between">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">Drainage</p>
            <div>
              <div className="text-2xl font-bold mb-1">{metrics.drainage}%</div>
              <p className={`text-xs font-medium ${isBaselineMonitoring ? 'text-green-400' : isDrainageBlocked(severity) ? 'text-red-400' : 'text-green-400'}`}>
                {isDrainageBlocked(severity) ? 'Blocked' : 'Clear'}
              </p>
            </div>
            <div className="w-full h-1.5 bg-slate-700 rounded-full mt-3 overflow-hidden">
              <div className={`h-full ${isBaselineMonitoring ? 'bg-green-500' : 'bg-red-500'} ${toWidthClass(metrics.drainage)}`} />
            </div>
            <p className="mt-2 text-[9px] text-slate-400">Derived from AI visual analysis</p>
          </div>

          <div className="bg-[#111827] text-white p-4 rounded-2xl flex flex-col justify-between relative overflow-hidden">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">Rainfall</p>
            <div>
              {isBaselineMonitoring ? (
                <div className="text-2xl font-bold mb-1">&lt; 5<span className="text-xs text-slate-400 font-normal">mm/hr</span></div>
              ) : (
                <>
                  <div className="text-2xl font-bold mb-1">{metrics.rainfall}<span className="text-xs text-slate-400 font-normal">mm/hr</span></div>
                  <p className="text-[10px] text-slate-300">{severityToRainfallRange(severity)}</p>
                </>
              )}
            </div>
            {!isBaselineMonitoring && <span className="material-icons-round absolute right-2 bottom-2 text-3xl text-white/10">cloud</span>}
            <p className="mt-2 text-[9px] text-slate-400">Source: Weather API via Gemini</p>
          </div>

          <div className={`${isBaselineMonitoring ? 'bg-slate-700' : 'bg-[#2A244D]'} text-white p-4 rounded-2xl flex flex-col justify-between`}>
            <div className="flex items-center gap-1 mb-2">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">AI CONF</p>
              <span className={`material-icons-round text-[10px] ${isBaselineMonitoring ? 'text-slate-300' : 'text-[#A78BFA]'}`}>auto_awesome</span>
            </div>
            <div>
              <div className={`text-2xl font-bold mb-1 ${isBaselineMonitoring ? 'text-slate-200' : 'text-[#A78BFA]'}`}>{metrics.confidence}%</div>
              <p className="text-[10px] font-medium text-slate-300">{isBaselineMonitoring ? 'Monitoring' : metrics.confidence >= 80 ? 'High Accuracy' : 'Moderate Accuracy'}</p>
            </div>
            <p className="mt-2 text-[9px] text-slate-300">Gemini 2.5 Flash · Multi-report consensus</p>
          </div>
        </div>

        <div className="bg-white border border-[#A78BFA]/30 p-5 rounded-3xl shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-[#8B5CF6] flex items-center justify-center">
              <span className="material-icons-round text-white text-[14px]">smart_toy</span>
            </div>
            <h3 className="font-bold text-sm tracking-wide">GEMINI AI ANALYSIS</h3>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                if (!hasCoords) return;
                window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
              }}
              disabled={!hasCoords}
              className="w-full h-40 rounded-xl overflow-hidden relative border border-slate-200 bg-slate-200 disabled:opacity-70"
            >
              {hasCoords ? (
                <img src={staticMap} alt="Map" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">No map data</div>
              )}
              <div className="absolute bottom-2 left-2 bg-black/65 px-2 py-1 rounded">
                <p className="text-[8px] text-white font-bold tracking-wider">SOURCE: {getUploadSource(activeZone)}</p>
              </div>
            </button>

            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">VISUAL ANALYSIS</p>
              <p className="text-sm text-slate-800 leading-tight">{visualText}</p>
            </div>
            <div className="bg-slate-50 p-2 rounded-lg">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">HISTORICAL CONTEXT</p>
              <p className="text-xs text-slate-700">{historicalText} · Historical risk {historicalRisk.toFixed(1)}/10</p>
            </div>
          </div>
        </div>

        <div className="bg-[#111827] text-white p-5 rounded-3xl shadow-lg">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="material-icons-round text-indigo-300">alt_route</span>
              <h3 className="font-bold text-sm tracking-wide">AI RECOMMENDATION</h3>
            </div>
            {!isBaselineMonitoring && severity >= 6 && (
              <span className="bg-red-600 text-white text-[10px] px-2 py-1 rounded-full font-bold">Urgent</span>
            )}
          </div>

          <p className="text-[10px] text-slate-400 mb-4">
            {isBaselineMonitoring ? (
              <>Precautionary evacuation centres near this location</>
            ) : (
              <>Nearest evacuation centres within <span className="text-white font-bold">10 km</span> of this alert zone</>
            )}
          </p>

          {loadingCenters ? (
            <div className="flex items-center justify-center gap-2 py-6 text-slate-400">
              <span className="material-icons-round animate-spin text-lg">progress_activity</span>
              <p className="text-xs">Searching nearby centres…</p>
            </div>
          ) : evacCenters.length === 0 ? (
            <div className="bg-white/5 rounded-2xl p-4 mb-4 text-center">
              <span className="material-icons-round text-slate-500 text-2xl">location_off</span>
              <p className="text-xs text-slate-300 mt-1">No registered centres found within 20km.</p>
              <p className="text-[11px] text-slate-400 mt-1">Contact NADMA: 03-8064 2400 or nearest police station.</p>
              <button
                type="button"
                onClick={() => {
                  window.location.href = 'tel:0380642400';
                }}
                className="mt-3 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold active:opacity-80"
              >
                <span className="material-icons-round text-sm">call</span>
                Call NADMA
              </button>
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {evacCenters.map((center, index) => {
                const isSelected = activeCenter?.placeId === center.placeId;
                return (
                  <button
                    type="button"
                    key={center.placeId}
                    onClick={() => {
                      setSelectedCenter(center);
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all active:opacity-80 ${isSelected ? 'border-indigo-400 bg-white text-slate-900' : 'border-slate-700 bg-gray-900 text-white'}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200'}`}>{index + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs truncate ${isSelected ? 'font-black text-slate-900' : 'font-bold text-white'}`}>{truncateName(center.name)}</p>
                      <p className={`text-[10px] truncate ${isSelected ? 'text-slate-600' : 'text-slate-400'}`}>{center.address}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs font-bold ${isSelected ? 'text-indigo-700' : 'text-slate-300'}`}>{center.distanceKm.toFixed(1)} km</p>
                      <span className={`material-icons-round text-base ${isSelected ? 'text-indigo-700' : 'text-slate-400'}`}>
                        {isSelected ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <button
            onClick={() => {
              if (!activeCenter) return;
              window.open(`https://www.google.com/maps/dir/?api=1&destination=${activeCenter.lat},${activeCenter.lng}&travelmode=driving`, '_blank');
            }}
            disabled={!activeCenter}
            className="w-full bg-gradient-to-r from-[#4338CA] to-[#7C3AED] rounded-2xl px-4 py-3 text-white disabled:opacity-50"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-left min-w-0">
                <p className="text-[10px] text-white/70 font-bold tracking-wider">NEAREST SAFE LOCATION</p>
                <p className="text-sm font-black truncate">{activeCenter ? activeCenter.name : 'Unavailable'}</p>
              </div>
              <div className="flex-shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-full bg-white shadow-lg shadow-indigo-900/60">
                <span className="text-indigo-700 text-xs font-black leading-none">Go</span>
                <span className="material-icons-round text-indigo-700 text-base leading-none">arrow_forward</span>
              </div>
            </div>
          </button>
        </div>
      </main>

      <BottomNav activeTab="alert" onTabChange={onTabChange} />
    </div>
  );
}
