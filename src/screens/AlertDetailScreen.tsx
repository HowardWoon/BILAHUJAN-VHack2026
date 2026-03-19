import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, get, update } from 'firebase/database';
import StatusBar from '../components/StatusBar';
import BottomNav from '../components/BottomNav';
import { rtdb } from '../firebase';
import type { FloodZone } from '../data/floodZones';
import { deduplicateFTName, isRealZone, isZoneExpired, severityToBadge, severityToBorderColor, toTimestampMs, trimToCity } from '../utils/floodCalculations';

interface ZoneListItem extends FloodZone {
  uploaded: boolean;
}

interface AlertDetailScreenProps {
  zoneId: string | null;
  stateName?: string | null;
  onBack: () => void;
  onScanClick: () => void;
  onViewMore: (zone: FloodZone) => void;
  onTabChange: (tab: 'map' | 'report' | 'alert' | 'dashboard') => void;
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

  return `${day}/${month}/${year} ${hour}:${minute}:${second} ${suffix}`;
};

const getZoneName = (zone: FloodZone) => deduplicateFTName(trimToCity(zone.locationName || zone.specificLocation || zone.name || zone.state || 'Unknown'));

const isBaselineZone = (zone: FloodZone) =>
  !isRealZone(zone);

const isMonitoringBaselineZone = (zone: FloodZone) =>
  Number(zone.severity || 1) <= 1 ||
  (zone as any).isWeatherFallbackZone === true ||
  (zone as any).source === 'baseline' ||
  (zone as any).source === 'seed';

const getEffectiveSeverity = (zone: FloodZone): number => {
  if (isZoneExpired(zone)) return 1;
  return Math.max(1, Math.min(10, Number(zone.severity || 1)));
};

const formatStartTime = (zone: FloodZone): string => {
  if (isMonitoringBaselineZone(zone)) {
    return 'N/A';
  }

  const startTime = (zone as any).startTime ?? zone.estimatedStartTime;
  if (!startTime || `${startTime}`.trim().toLowerCase() === 'n/a') {
    return 'Already in progress';
  }

  return formatDateTime(startTime, 'Already in progress');
};

const formatEndTime = (zone: FloodZone): string => {
  if (isMonitoringBaselineZone(zone)) {
    return 'N/A';
  }

  const endTime = (zone as any).endTime ?? zone.estimatedEndTime;
  if (!endTime || `${endTime}`.trim().toLowerCase() === 'n/a') {
    return 'Ongoing';
  }

  return formatDateTime(endTime, 'Ongoing');
};

const deriveTips = (zone: FloodZone, effectiveSeverity: number): string[] => {
  const fromTips = (zone as any).tips;
  if (Array.isArray(fromTips) && fromTips.length > 0) {
    return fromTips.slice(0, 3).map((tip) => `${tip}`.trim()).filter(Boolean);
  }

  const severity = Math.max(1, Math.min(10, Number(effectiveSeverity || 1)));
  if (severity >= 8) {
    return [
      'Evacuate now and avoid all flooded routes.',
      'Keep emergency contacts and supplies ready.',
      'Follow authority alerts and shelter instructions.'
    ];
  }
  if (severity >= 4) {
    return [
      'Avoid low-lying roads and underpasses.',
      'Prepare emergency kit and backup power.',
      'Monitor rainfall and local authority updates.'
    ];
  }
  if (severity >= 2) {
    return [
      'Watch water rise in nearby drains and roads.',
      'Move valuables above floor level.',
      'Be ready for quick evacuation if needed.'
    ];
  }

  return [
    'No active flood signal in this location.',
    'Keep monitoring during heavy rain periods.',
    'Report changes quickly for faster response.'
  ];
};

const zoneFromState = (raw: Record<string, FloodZone>, zoneId: string | null) => {
  if (zoneId && raw[zoneId]?.state) return raw[zoneId].state;

  if (zoneId && zoneId.startsWith('live_')) {
    const decoded = zoneId
      .replace(/^live_/, '')
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      .trim();
    if (decoded) return decoded;
  }

  return '';
};

export default function AlertDetailScreen({ zoneId, stateName, onBack, onScanClick, onViewMore, onTabChange }: AlertDetailScreenProps) {
  const [selectedState, setSelectedState] = useState('');
  const [zonesById, setZonesById] = useState<Record<string, FloodZone>>({});
  const [uploadedZoneIds, setUploadedZoneIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const unsubZones = onValue(ref(rtdb, 'liveZones'), (snapshot) => {
      const raw = snapshot.exists() ? (snapshot.val() as Record<string, FloodZone>) : {};
      setZonesById(raw);
      const state = zoneFromState(raw, zoneId) || stateName || '';
      setSelectedState(state);
      setLastUpdated(new Date());
      setRefreshing(false);
    });

    const unsubReports = onValue(ref(rtdb, 'liveReports'), (snapshot) => {
      const raw = snapshot.exists() ? (snapshot.val() as Record<string, any>) : {};
      const ids = new Set<string>();
      Object.values(raw).forEach((report: any) => {
        if (report?.zoneId) ids.add(String(report.zoneId));
      });
      setUploadedZoneIds(ids);
    });

    return () => {
      unsubZones();
      unsubReports();
    };
  }, [zoneId, stateName, refreshKey]);

  useEffect(() => {
    let mounted = true;

    const checkExpiredZones = async () => {
      try {
        const snap = await get(ref(rtdb, 'liveZones'));
        if (!mounted || !snap.exists()) return;

        const now = Date.now();
        const zones = Object.entries(snap.val() ?? {}) as [string, FloodZone][];

        for (const [id, zone] of zones) {
          const endTimeMs = toTimestampMs((zone as any)?.endTime ?? (zone as any)?.estimatedEndTime);
          if (
            endTimeMs > 0 &&
            Number((zone as any)?.severity || 0) > 1 &&
            (zone as any)?.isExpired !== true &&
            now >= endTimeMs
          ) {
            await update(ref(rtdb, `liveZones/${id}`), {
              severity: 1,
              isExpired: true,
              expiredAt: now
            });
            console.log(`[auto-expire] ${zone.locationName || zone.state || id} → NORMAL`);
          }
        }
      } catch (error) {
        console.error('checkExpiredZones error:', error);
      }
    };

    void checkExpiredZones();
    const interval = window.setInterval(() => {
      void checkExpiredZones();
    }, 60000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshKey((previous) => previous + 1);
  };

  const grouped = useMemo(() => {
    const stateZonesRaw = (Object.values(zonesById) as FloodZone[])
      .filter((zone) => (zone.state || '').toLowerCase() === selectedState.toLowerCase())
      .filter((zone) => zone.status !== 'resolved' && !(zone as any).isHistorical)
      .filter((zone) => {
        const id = zone.id || '';
        return !(id.startsWith('live_') && !id.startsWith('live_town_'));
      })
      .map((zone) => ({
        ...zone,
        uploaded: (zone as any).source === 'user' || (zone as any).source === 'citizen_scan' || uploadedZoneIds.has(zone.id)
      }))
      .sort((a, b) => Number(b.severity || 1) - Number(a.severity || 1));

    const seenZoneKeys = new Set<string>();
    const stateZones = stateZonesRaw.filter((zone) => {
      const key = `${String(zone.locationName || zone.specificLocation || zone.name || '').trim().toLowerCase()}|${String(zone.state || '').trim().toLowerCase()}`;
      if (seenZoneKeys.has(key)) return false;
      seenZoneKeys.add(key);
      return true;
    });

    const realZones = stateZones.filter(isRealZone);
    const activeRealZones = realZones.filter((zone) => !isZoneExpired(zone));
    const expiredRealZones = realZones.filter((zone) => isZoneExpired(zone));
    const highRisk = activeRealZones.filter((zone) => getEffectiveSeverity(zone) >= 4);
    const normal = activeRealZones.filter((zone) => getEffectiveSeverity(zone) <= 3);
    const baseline = stateZones.filter(isBaselineZone);

    return { highRisk, normal, baseline, expiredRealZones, allCount: stateZones.length };
  }, [zonesById, selectedState, uploadedZoneIds]);

  const renderZoneCard = (zone: ZoneListItem, muted = false) => {
    const expired = isZoneExpired(zone);
    const severity = muted || expired ? 1 : getEffectiveSeverity(zone);
    const badge = severityToBadge(severity);
    const zoneTips = deriveTips(zone, severity);
    const startTime = formatStartTime(zone);
    const endTime = formatEndTime(zone);
    const isBaselineCard = muted || isMonitoringBaselineZone(zone) || expired;
    const hasUploadedSource = zone.source === 'user' || zone.reportId != null;

    return (
      <div key={zone.id} className={`rounded-2xl bg-slate-900 border border-slate-700 border-l-4 ${severityToBorderColor(severity)} p-4`}>
        <div className="flex flex-col gap-1 mb-3">
          <div className="flex items-center justify-between gap-2">
            {severity >= 4 ? (
              <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wide">
                Flood Risk Nearby
              </span>
            ) : (
              <span className="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wide">
                Live Update — Normal
              </span>
            )}

            <span className={`text-xs font-bold px-3 py-1 rounded-full ${badge.className}`}>
              Level {severity}
            </span>
          </div>

          {hasUploadedSource && (
            <div className="flex">
              <span className="bg-indigo-600 text-white text-xs font-semibold px-2 py-1 rounded-md uppercase tracking-wide">
                Uploaded Analysis
              </span>
            </div>
          )}
        </div>

        <h3 className="text-white font-bold text-lg mb-2 leading-snug line-clamp-2">
          {deduplicateFTName(zone.locationName || getZoneName(zone))}
        </h3>

        <ul className="mt-3 space-y-1.5">
          {zoneTips.map((tip) => (
            <li key={`${zone.id}-${tip}`} className="text-slate-300 text-sm flex items-start gap-2">
              <span className="material-icons-round text-indigo-300 text-sm mt-0.5">check_circle</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>

        {expired && (
          <p className="mt-3 text-xs text-green-300 font-medium">Flood event has ended. Area returning to normal.</p>
        )}

        {!isBaselineCard ? (
          <div className="mt-3 grid grid-cols-2 gap-2 bg-slate-950 border border-slate-700 rounded-xl p-2.5">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Start</p>
              <p className="text-xs text-slate-200 font-semibold mt-0.5">{startTime}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">End</p>
              <p className="text-xs text-slate-200 font-semibold mt-0.5">{endTime}</p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-gray-400 font-medium">Monitoring active. No flood event recorded.</p>
        )}

        <button onClick={() => onViewMore(zone)} className="mt-3 flex items-center text-indigo-300 font-semibold text-sm hover:text-indigo-200">
          View More
          <span className="material-icons-round text-sm ml-1">arrow_forward</span>
        </button>

        {muted && !expired && (
          <div className="mt-2 inline-flex items-center px-2 py-1 rounded-full bg-slate-700 text-slate-200 text-[10px] font-black tracking-wide">
            BASELINE DATA
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative h-full w-full flex flex-col bg-white">
      <StatusBar theme="light" />

      <header className="px-6 py-4 flex items-center justify-between">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center border border-gray-200">
          <span className="material-icons-round">arrow_back</span>
        </button>
        <div className="text-center">
          <h1 className="text-gray-900 font-black text-lg leading-tight">{selectedState || 'Selected State'} Locations</h1>
          <p className="text-gray-500 text-xs">Select a location to view detailed analysis.</p>
          <p className="text-gray-500 text-xs mt-1">
            Last updated: {lastUpdated
              ? lastUpdated.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              : 'Loading...'}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="Refresh zones"
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 ${refreshing ? 'bg-gray-200 text-gray-400' : 'bg-[#6B59D3] text-white hover:bg-[#5a48c2]'}`}
        >
          <span className={`material-icons-round ${refreshing ? 'animate-spin' : ''}`}>sync</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-28">
        {grouped.allCount === 0 ? (
          <div className="rounded-2xl bg-gray-50 border border-gray-200 p-6 text-center">
            <span className="material-icons-round text-green-500 text-3xl">check_circle</span>
            <h3 className="text-gray-900 text-lg font-bold mt-2">All Clear</h3>
            <p className="text-gray-500 text-sm mt-1">No active flood alerts for {selectedState || 'this state'}.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.highRisk.length > 0 && (
              <section>
                <h2 className="text-gray-800 text-sm font-black tracking-wider mb-2">ACTIVE FLOOD ZONES</h2>
                <div className="space-y-3">
                  {grouped.highRisk.map((zone) => renderZoneCard(zone))}
                </div>
              </section>
            )}

            {grouped.normal.length > 0 && (
              <section>
                <h2 className="text-gray-600 text-sm font-black tracking-wider mb-2">NORMAL / WATCH ZONES</h2>
                <div className="space-y-3">
                  {grouped.normal.map((zone) => renderZoneCard(zone))}
                </div>
              </section>
            )}

            {(grouped.expiredRealZones.length > 0 || grouped.baseline.length > 0) && (
              <section>
                <div className="mb-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-gray-500 text-sm font-black tracking-wider">MONITORED LOCATIONS</h2>
                    <span
                      className="material-icons-round text-gray-400 text-base cursor-help"
                      title="These locations are pre-loaded for monitoring. Flood data will appear here when reported by users or sensors."
                    >
                      info
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">These areas are being monitored. No active flood detected.</p>
                </div>
                <div className="space-y-3">
                  {grouped.expiredRealZones.map((zone) => renderZoneCard(zone))}
                  {grouped.baseline.map((zone) => renderZoneCard(zone, true))}
                </div>
              </section>
            )}
          </div>
        )}

        <div
          onClick={onScanClick}
          className="mt-7 rounded-2xl bg-gray-100 border border-gray-200 p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-200 transition-colors"
        >
          <div className="w-11 h-11 rounded-full bg-indigo-600 text-white flex items-center justify-center">
            <span className="material-icons-round">forum</span>
          </div>
          <div className="flex-1">
            <h4 className="text-gray-900 font-bold text-sm">Join Our Community Discord</h4>
            <p className="text-gray-500 text-xs">Share flood updates & connect with nearby residents.</p>
          </div>
          <span className="material-icons-round text-gray-400">chevron_right</span>
        </div>
      </main>

      <BottomNav activeTab="alert" onTabChange={onTabChange} />
    </div>
  );
}
