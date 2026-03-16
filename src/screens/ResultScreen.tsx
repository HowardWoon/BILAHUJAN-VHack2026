import { useState, useEffect } from 'react';
import StatusBar from '../components/StatusBar';
import BottomNav from '../components/BottomNav';
import { FloodAnalysisResult } from '../services/gemini';
import { createZone } from '../data/floodZones';
import type { FloodZone } from '../data/floodZones';
import { ref, set } from 'firebase/database';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { rtdb, db } from '../firebase';

// ── Metric helpers ──────────────────────────────────────────────
const formatTime = (t: string): string => {
  if (!t || /progress|unknown|n\/a/i.test(t)) return t;
  try {
    const d = new Date(t);
    if (isNaN(d.getTime())) return t;
    return d.toLocaleString('en-MY', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short', hour12: true });
  } catch { return t; }
};

const extractDepthValue = (depth: string): string => {
  const m = depth.match(/[~≈]?[\d.]+(?:[–\-][\d.]+)?\s*m/i);
  return m ? m[0].trim() : depth.split(/[\s(,]/)[0];
};

const extractDepthNote = (depth: string): string => {
  const paren = depth.match(/\(([^)]+)\)/);
  if (paren) return paren[1];
  const after = depth.replace(/[~≈]?[\d.]+(?:[–\-][\d.]+)?\s*m/i, '').replace(/^[,\s]+/, '').trim();
  return after || '';
};

const parsePassability = (text: string) => [
  { key: 'pedestrian', icon: 'directions_walk', label: 'Foot' },
  { key: 'motorcycle', icon: 'two_wheeler',      label: 'Moto' },
  { key: 'car',        icon: 'directions_car',   label: 'Car'  },
  { key: '4x4',        icon: 'airport_shuttle',  label: '4×4'  },
].map(({ key, icon, label }) => {
  const pattern = key === '4x4'
    ? /4[×x]4:?\s*([^|\n]+)/i
    : new RegExp(key + 's?:?\\s*([^|\\n]+)', 'i');
  const m = text.match(pattern);
  const seg = m ? m[1] : '';
  const passable = seg.length > 0 && /passable/i.test(seg) && !/impassable/i.test(seg);
  return { icon, label, passable };
});

const parseHazards = (text: string): string[] =>
  text.split(/[,;]/).map(h => h.trim()).filter(Boolean);

function normalizeMalaysianStateName(rawState: string): string {
  const stateName = (rawState || '').trim();
  if (!stateName) return 'Unknown';

  if (stateName.includes('Kuala Lumpur')) return 'Kuala Lumpur';
  if (stateName.includes('Labuan')) return 'Labuan';
  if (stateName.includes('Putrajaya')) return 'Putrajaya';
  if (stateName.includes('Penang') || stateName.includes('Pulau Pinang')) return 'Penang';
  if (stateName.includes('Malacca') || stateName.includes('Melaka')) return 'Melaka';
  if (stateName.includes('Johor')) return 'Johor';
  if (stateName.includes('Kedah')) return 'Kedah';
  if (stateName.includes('Kelantan')) return 'Kelantan';
  if (stateName.includes('Negeri Sembilan')) return 'Negeri Sembilan';
  if (stateName.includes('Pahang')) return 'Pahang';
  if (stateName.includes('Perak')) return 'Perak';
  if (stateName.includes('Perlis')) return 'Perlis';
  if (stateName.includes('Sabah')) return 'Sabah';
  if (stateName.includes('Sarawak')) return 'Sarawak';
  if (stateName.includes('Selangor')) return 'Selangor';
  if (stateName.includes('Terengganu')) return 'Terengganu';

  return 'Unknown';
}

function extractStateFromAddress(address: string): string {
  const states = [
    'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan',
    'Pahang', 'Perak', 'Perlis', 'Penang', 'Pulau Pinang',
    'Sabah', 'Sarawak', 'Selangor', 'Terengganu',
    'Kuala Lumpur', 'Labuan', 'Putrajaya'
  ];

  const lowered = (address || '').toLowerCase();
  for (const state of states) {
    if (lowered.includes(state.toLowerCase())) {
      return state === 'Pulau Pinang' ? 'Penang' : state;
    }
  }

  return 'Unknown';
}

function extractRegionFromState(state: string): string {
  const regions: Record<string, string> = {
    Johor: 'Southern Region',
    Melaka: 'Southern Region',
    'Negeri Sembilan': 'Central Region',
    Selangor: 'Central Region',
    'Kuala Lumpur': 'Central Region',
    Putrajaya: 'Central Region',
    Perak: 'Northern Region',
    Penang: 'Northern Region',
    Kedah: 'Northern Region',
    Perlis: 'Northern Region',
    Pahang: 'East Coast',
    Terengganu: 'East Coast',
    Kelantan: 'East Coast',
    Sabah: 'East Malaysia',
    Sarawak: 'East Malaysia',
    Labuan: 'East Malaysia',
  };
  return regions[state] || 'Central Region';
}

function formatLocationLabel(locality: string, sublocality: string, state: string): string {
  const normalize = (value: string) => (value || '').trim().toLowerCase();
  const cleanLocality = (locality || '').trim();
  const cleanSublocality = (sublocality || '').trim();
  const cleanState = (state || '').trim();

  let place = 'Reported Location';
  if (cleanSublocality && cleanLocality) {
    place = normalize(cleanSublocality) === normalize(cleanLocality)
      ? cleanLocality
      : `${cleanSublocality}, ${cleanLocality}`;
  } else if (cleanLocality) {
    place = cleanLocality;
  } else if (cleanSublocality) {
    place = cleanSublocality;
  }

  if (!cleanState || cleanState === 'Unknown' || cleanState === 'Unknown State') {
    return place;
  }

  if (normalize(place).includes(normalize(cleanState))) {
    return place;
  }

  return `${place}, ${cleanState}`;
}

function estimateRainfallFromSeverity(severity: number): number {
  const map: Record<number, number> = {
    1: 20, 2: 35, 3: 55, 4: 80, 5: 110,
    6: 145, 7: 185, 8: 235, 9: 290, 10: 380
  };
  return map[severity] || 50;
}

function estimateDrainageFromSeverity(severity: number): number {
  return Math.min(95, severity * 9 + Math.floor(Math.random() * 10));
}

function estimateAffectedResidents(severity: number): number {
  const base = Math.max(1, severity) * 800;
  return base + Math.floor(Math.random() * base * 0.3);
}

interface ResultScreenProps {
  result: FloodAnalysisResult;
  imageUri: string;
  location: { lat: number; lng: number; address: string } | null;
  onBack: () => void;
  onTabChange: (tab: 'map' | 'report' | 'alert' | 'dashboard') => void;
  zoneId?: string | null;
  onUploadAlert?: (zoneId: string, zone: import('../data/floodZones').FloodZone) => void;
}

export default function ResultScreen({ result, imageUri, location, onBack, onTabChange, zoneId, onUploadAlert }: ResultScreenProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fullAddress, setFullAddress] = useState(location?.address || 'Unknown Location');
  const [detectedState, setDetectedState] = useState('Unknown State');

  useEffect(() => {
    if (location && window.google && window.google.maps && window.google.maps.Geocoder) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat: location.lat, lng: location.lng } }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          setFullAddress(results[0].formatted_address);
          
          // Find state (administrative_area_level_1)
          const addressComponents = results[0].address_components;
          const stateComponent = addressComponents.find(c => c.types.includes('administrative_area_level_1'));
          
          const normalizedState = normalizeMalaysianStateName(stateComponent?.long_name || '');

          // Find a good human readable name (locality, sublocality, or route)
          const locality = addressComponents.find(c => c.types.includes('locality'))?.long_name;
          const sublocality = addressComponents.find(c => c.types.includes('sublocality'))?.long_name;
          const route = addressComponents.find(c => c.types.includes('route'))?.long_name;
          
          let readableName = formatLocationLabel(locality || route || '', sublocality || '', normalizedState);
          if (!readableName || readableName === 'Reported Location') {
            readableName = results[0].formatted_address.split(',')[0];
          }
          
          // Store the readable name in fullAddress state for now, we'll use it in createZone
          setFullAddress(readableName);

          if (stateComponent) {
            setDetectedState(normalizedState);
          }
        }
      });
    } else if (location?.address) {
       // Fallback to simple string matching if geocoding fails
       const states = ['Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis', 'Penang', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu', 'Kuala Lumpur', 'Putrajaya', 'Labuan'];
       for (const state of states) {
         if (location.address.toLowerCase().includes(state.toLowerCase())) {
           setDetectedState(state);
           const firstSegment = (location.address.split(',')[0] || '').trim();
           setFullAddress(formatLocationLabel(firstSegment, '', state));
           break;
         }
       }
    }
  }, [location]);

  const handleUploadToAlertZone = async () => {
    if (uploading || uploadSuccess) return;

    if (!result || !location) {
      setUploadError('Location is required. Please set your location first.');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const timestamp = Date.now();
      const generatedZoneId = zoneId || `user_reported_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;

      const resolveUploadState = async () => {
        if (detectedState && detectedState !== 'Unknown State' && detectedState !== 'Unknown') {
          return detectedState;
        }

        const fromAddress = extractStateFromAddress(location.address || fullAddress || '');
        if (fromAddress !== 'Unknown') {
          return fromAddress;
        }

        if (window.google && window.google.maps && window.google.maps.Geocoder) {
          const geocoder = new window.google.maps.Geocoder();
          const geocodeResult = await new Promise<string>((resolve) => {
            geocoder.geocode({ location: { lat: location.lat, lng: location.lng } }, (results, status) => {
              if (status === 'OK' && results && results[0]) {
                const stateComponent = results[0].address_components.find(c => c.types.includes('administrative_area_level_1'));
                resolve(normalizeMalaysianStateName(stateComponent?.long_name || ''));
                return;
              }
              resolve('Unknown');
            });
          });

          if (geocodeResult !== 'Unknown') {
            setDetectedState(geocodeResult);
            return geocodeResult;
          }
        }

        return 'Unknown';
      };

      const derivedState = await resolveUploadState();
      if (derivedState === 'Unknown') {
        setUploadError('Unable to detect a specific state for this report. Please set a clearer location and try again.');
        return;
      }

      const normalizedSeverity = Math.max(1, Math.min(10, Math.round(Number(result.riskScore) || 1)));
      const region = extractRegionFromState(derivedState);

      const zoneData = {
        id: generatedZoneId,
        name: fullAddress || location.address || 'Reported Flood Zone',
        specificLocation: fullAddress || location.address || 'Reported Flood Zone',
        state: derivedState || 'Kuala Lumpur',
        region,
        severity: normalizedSeverity,
        rainfall: estimateRainfallFromSeverity(normalizedSeverity),
        drainageBlockage: estimateDrainageFromSeverity(normalizedSeverity),
        center: { lat: location.lat, lng: location.lng },
        forecast: result.directive || 'Citizen flood report submitted.',
        timestamp,
        lastUpdated: new Date().toISOString(),
        eventType: result.eventType || 'Flash Flood',
        waterDepth: result.waterDepth || 'Unknown',
        estimatedDepth: result.estimatedDepth || 'Unknown',
        detectedHazards: result.detectedHazards || 'None',
        passability: result.passability || 'Unknown',
        humanRisk: result.humanRisk || 'Unknown',
        directive: result.directive || '',
        aiConfidence: result.aiConfidence || 0,
        isUserReport: true,
        source: 'citizen_scan',
        reportedAt: new Date().toISOString(),
        status: normalizedSeverity >= 7 ? 'active' : normalizedSeverity >= 4 ? 'warning' : 'monitor',
        affectedResidents: estimateAffectedResidents(normalizedSeverity),
        aiAnalysisText: result.directive || 'Citizen report received for monitoring.',
        aiAnalysis: {
          waterDepth: result.waterDepth || result.estimatedDepth || 'Unknown',
          currentSpeed: normalizedSeverity >= 7 ? 'rapid current' : normalizedSeverity >= 4 ? 'moderate current' : 'still water',
          riskLevel: normalizedSeverity >= 7 ? 'High' : normalizedSeverity >= 4 ? 'Moderate' : 'Low',
          historicalContext: 'Citizen-submitted event pending trend aggregation.'
        },
        aiRecommendation: {
          impassableRoads: result.passability || 'Unknown',
          evacuationRoute: result.directive || 'Follow local authority advisories.',
          evacuationCenter: `SMK ${derivedState}`
        },
        color: normalizedSeverity >= 8 ? 'red' : normalizedSeverity >= 4 ? 'orange' : 'yellow',
        paths: [{ lat: location.lat, lng: location.lng }],
        sources: ['Citizen Scan', 'Gemini AI'],
        estimatedStartTime: result.estimatedStartTime || 'Unknown',
        estimatedEndTime: result.estimatedEndTime || 'Unknown',
      };

      await set(ref(rtdb, `liveZones/${generatedZoneId}`), zoneData);

      const reportData = {
        id: generatedZoneId,
        location: {
          lat: location.lat,
          lng: location.lng,
          address: location.address || fullAddress || 'Unknown Location'
        },
        analysisResult: result,
        timestamp,
        severity: normalizedSeverity,
        status: 'completed',
        zoneId: generatedZoneId,
        reportCount: 1
      };

      await set(ref(rtdb, `liveReports/${generatedZoneId}`), reportData);

      try {
        await addDoc(collection(db, 'reports'), {
          ...reportData,
          timestamp: serverTimestamp(),
          createdAt: new Date().toISOString()
        });

        await addDoc(collection(db, 'floodZones'), {
          ...zoneData,
          timestamp: serverTimestamp(),
          createdAt: new Date().toISOString()
        });
      } catch (firestoreErr) {
        console.warn('Firestore write failed (non-fatal):', firestoreErr);
      }

      if (onUploadAlert) {
        const floodZone: FloodZone = createZone(
          generatedZoneId,
          zoneData.name,
          zoneData.specificLocation,
          zoneData.state,
          zoneData.region,
          zoneData.center.lat,
          zoneData.center.lng,
          zoneData.severity,
          zoneData.forecast,
          0.02,
          ['Citizen Scan', 'Gemini AI']
        );
        floodZone.aiConfidence = zoneData.aiConfidence;
        floodZone.aiAnalysisText = zoneData.aiAnalysisText;
        floodZone.estimatedStartTime = zoneData.estimatedStartTime;
        floodZone.estimatedEndTime = zoneData.estimatedEndTime;
        floodZone.eventType = zoneData.eventType;
        onUploadAlert(generatedZoneId, floodZone);
      }

      window.dispatchEvent(new CustomEvent('floodAlert', {
        detail: {
          zoneId: generatedZoneId,
          zone: {
            id: generatedZoneId,
            name: zoneData.name,
            specificLocation: zoneData.specificLocation,
            state: zoneData.state,
            region: zoneData.region,
            severity: zoneData.severity,
            center: zoneData.center,
            rainfall: zoneData.rainfall,
            drainageBlockage: zoneData.drainageBlockage,
          }
        }
      }));

      if (normalizedSeverity >= 7) {
        try {
          const { autoAssessNewZone } = await import('../services/commandAgent');
          autoAssessNewZone(generatedZoneId, normalizedSeverity, zoneData.name)
            .catch((e: unknown) => console.warn('Auto-mission failed:', e));
        } catch (e) {
          console.warn('Command agent import failed:', e);
        }
      }

      setUploadSuccess(true);
      console.log('✅ Upload to Alert Zone successful:', generatedZoneId);
    } catch (error: any) {
      console.error('Upload to Alert Zone error:', error);
      setUploadError(
        error?.message?.includes('permission')
          ? 'Firebase permission denied. Check database rules.'
          : error?.message?.includes('network')
          ? 'Network error. Check your internet connection.'
          : 'Upload failed. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  // --- Rejection screen for irrelevant images ---
  if (!result.isRelevant) {
    return (
      <div className="relative h-full w-full flex flex-col bg-[#F8F9FA]">
        <StatusBar theme="light" />
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-6">
          <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center">
            <span className="material-icons-round text-red-500 text-5xl">no_photography</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Image Not Accepted</h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              {result.rejectionReason ||
                'This image does not appear to show a flood or drain condition. Please upload a photo of a flooded area, waterlogged road, blocked drain, or overflowing drainage system.'}
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 w-full text-left">
            <p className="text-amber-800 text-xs font-bold uppercase tracking-widest mb-2">Accepted image types</p>
            <ul className="text-amber-700 text-sm space-y-1">
              <li className="flex items-center gap-2"><span className="material-icons-round text-base text-amber-500">water</span> Flooded roads, streets, or fields</li>
              <li className="flex items-center gap-2"><span className="material-icons-round text-base text-amber-500">waves</span> Rivers, streams, or canals at risk</li>
              <li className="flex items-center gap-2"><span className="material-icons-round text-base text-amber-500">water_drop</span> Drains — blocked, overflowing, or normal</li>
              <li className="flex items-center gap-2"><span className="material-icons-round text-base text-amber-500">flood</span> Waterlogged or stormwater runoff areas</li>
            </ul>
          </div>
          <button
            onClick={onBack}
            className="w-full py-4 bg-[#E65100] hover:bg-[#CC4800] text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
          >
            <span className="material-icons-round">arrow_back</span>
            Try Again with a Valid Image
          </button>
        </div>
        <BottomNav activeTab="report" onTabChange={onTabChange} />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full flex flex-col bg-[#F8F9FA]">
      <StatusBar theme="light" />
      
      <header className="flex items-center justify-center px-6 py-6 mt-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#E65100] text-white flex items-center justify-center">
            <span className="material-icons-round text-xl">check</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">AI Analysis Complete</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-32">
        <div className="px-6 mb-6">
          <div className="flex items-center gap-2 mb-4 text-slate-600 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
            <span className="material-icons-round text-[#E65100]">location_on</span>
            <p className="text-sm font-medium truncate">{fullAddress}</p>
          </div>

          <button
            onClick={handleUploadToAlertZone}
            disabled={uploading || uploadSuccess}
            className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg ${
              uploadSuccess
                ? 'bg-green-500 text-white cursor-default'
                : uploading
                ? 'bg-purple-400 text-white cursor-not-allowed opacity-75'
                : 'bg-[#6B59D3] hover:bg-[#5a48c2] text-white'
            }`}
          >
            {uploadSuccess ? (
              <>
                <span className="material-icons-round">check_circle</span>
                Alert Zone Updated!
              </>
            ) : uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <span className="material-icons-round">cloud_upload</span>
                Upload to Alert Zone
              </>
            )}
          </button>

          {uploadError && !uploadSuccess && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl mt-2">
              <span className="material-icons-round text-red-500 text-sm">error</span>
              <p className="text-red-600 text-xs">{uploadError}</p>
            </div>
          )}

          {uploadSuccess && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-xl mt-2">
              <span className="material-icons-round text-green-500 text-sm">check_circle</span>
              <p className="text-green-700 text-xs font-medium">
                Report saved to Firebase. Alert zones and dashboard updated in real time.
                {(Math.max(1, Math.min(10, Math.round(Number(result.riskScore) || 1))) >= 7) && ' 🚨 Authorities have been notified.'}
              </p>
            </div>
          )}
        </div>

        <div className="px-6 mb-6">
          {/* Severity Banner */}
          {(() => {
            const numericScore = Math.max(0, Math.min(10, Math.round(Number(result.riskScore) || 0)));
            const score = result.isRelevant ? Math.max(1, numericScore) : numericScore;
            let bgGradient = 'from-green-500 to-emerald-600';
            let textLabel = 'NORMAL';
            let icon = 'check_circle';
            let description = 'No significant flood risk detected. Conditions are safe.';
            if (score >= 9) { bgGradient = 'from-red-700 to-red-900'; textLabel = 'CRITICAL'; icon = 'crisis_alert'; description = 'Catastrophic flooding. Immediate evacuation is imperative. Life is at risk.'; }
            else if (score >= 7) { bgGradient = 'from-red-500 to-red-700'; textLabel = 'SEVERE'; icon = 'warning'; description = 'Severe flooding. Vehicles and pedestrians cannot pass safely. Evacuate now.'; }
            else if (score >= 5) { bgGradient = 'from-orange-400 to-orange-600'; textLabel = 'MODERATE'; icon = 'report_problem'; description = 'Moderate flooding. Cars at risk of stalling. Avoid the area if possible.'; }
            else if (score >= 3) { bgGradient = 'from-yellow-400 to-amber-500'; textLabel = 'MINOR'; icon = 'info'; description = 'Minor pooling. Motorcycles and pedestrians should proceed with caution.'; }
            return (
              <div className={`bg-gradient-to-br ${bgGradient} rounded-2xl p-5 mb-4 text-white shadow-lg`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="material-icons-round text-3xl">{icon}</span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Flood Severity Assessment</p>
                    <p className="text-2xl font-black">{textLabel} — Level {score}/10</p>
                  </div>
                </div>
                <p className="text-sm opacity-90 leading-relaxed">{description}</p>
                {/* Severity Scale Bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest opacity-70 mb-1">
                    <span>Normal</span><span>Minor</span><span>Moderate</span><span>Severe</span><span>Critical</span>
                  </div>
                  <div className="relative h-3 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all"
                      style={{ width: `${score * 10}%` }}
                    />
                  </div>
                  <div className="flex mt-1">
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <div key={n} className={`flex-1 text-center text-[8px] font-bold ${
                        n === score ? 'text-white' : 'text-white/40'
                      }`}>{n}</div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Level Definitions */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-4">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Flood Level Reference Guide</p>
            </div>
            {[
              { range: '1–2', label: 'Normal', color: 'bg-green-500', desc: 'Dry / surface dampness. Safe.' },
              { range: '3–4', label: 'Minor', color: 'bg-yellow-400', desc: 'Ankle-deep (<0.2m). Caution for motorcycles.' },
              { range: '5–6', label: 'Moderate', color: 'bg-orange-400', desc: 'Knee-deep (0.2–0.5m). Cars at risk.' },
              { range: '7–8', label: 'Severe', color: 'bg-red-500', desc: 'Waist to roof-level (0.5–1.3m). Evacuate.' },
              { range: '9–10', label: 'Critical', color: 'bg-red-800', desc: 'Full submersion (>1.3m). Life-threatening.' },
            ].map(({ range, label, color, desc }) => {
              const [lo, hi] = range.split('–').map(Number);
              const isActive = result.riskScore >= lo && result.riskScore <= hi;
              return (
                <div key={range} className={`flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 last:border-0 ${isActive ? 'bg-slate-50' : ''}`}>
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${color}`} />
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-800">{label} ({range})</span>
                    <span className="text-xs text-slate-500 ml-2">{desc}</span>
                  </div>
                  {isActive && <span className="material-icons-round text-slate-600 text-base">arrow_left</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Directive + image */}
        <div className="px-6 mb-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex gap-4 mb-4">
              <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0">
                <img src={imageUri} alt="Scanned area" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">AI Survival Directive</p>
                <p className="text-xs text-slate-500">Based on visual analysis of the submitted image</p>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-4">
              <p className="text-[#D32F2F] font-bold italic text-[14px] leading-relaxed">
                "{result.directive}"
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 mb-8">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Extracted Metrics</h3>
          <div className="space-y-3">

            {/* Timeline */}
            <div className="bg-[#111827] p-4 rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-icons-round text-[#E65100] text-base">schedule</span>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Timeline · {result.eventType}</p>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[9px] text-slate-500 mb-0.5">Start</p>
                  <p className="text-white font-bold text-sm">{formatTime(result.estimatedStartTime)}</p>
                </div>
                <span className="material-icons-round text-slate-600 text-lg">arrow_forward</span>
                <div className="text-right">
                  <p className="text-[9px] text-slate-500 mb-0.5">End</p>
                  <p className="text-white font-bold text-sm">{formatTime(result.estimatedEndTime)}</p>
                </div>
              </div>
            </div>

            {/* Depth + Confidence */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#111827] p-4 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-icons-round text-[#E65100] text-base">straighten</span>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Depth</p>
                </div>
                <p className="text-white font-black text-xl leading-tight">{extractDepthValue(result.estimatedDepth)}</p>
                <p className="text-slate-400 text-[10px] mt-1 leading-snug line-clamp-2">{extractDepthNote(result.estimatedDepth)}</p>
              </div>
              <div className="bg-[#111827] p-4 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-icons-round text-[#E65100] text-base">auto_awesome</span>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Confidence</p>
                </div>
                <p className="text-white font-black text-xl leading-tight">{result.aiConfidence}%</p>
                <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-[#E65100] rounded-full transition-all" style={{ width: `${result.aiConfidence}%` }} />
                </div>
              </div>
            </div>

            {/* Passability */}
            <div className="bg-[#111827] p-4 rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-icons-round text-[#E65100] text-base">traffic</span>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Passability</p>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {parsePassability(result.passability).map(({ icon, label, passable }) => (
                  <div key={label} className="flex flex-col items-center gap-1.5">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                      passable ? 'bg-emerald-500/20' : 'bg-red-500/20'
                    }`}>
                      <span className={`material-icons-round text-xl ${
                        passable ? 'text-emerald-400' : 'text-red-400'
                      }`}>{icon}</span>
                    </div>
                    <p className="text-[9px] text-slate-400 font-semibold">{label}</p>
                    <p className={`text-[8px] font-bold uppercase ${
                      passable ? 'text-emerald-400' : 'text-red-400'
                    }`}>{passable ? '✓ OK' : '✗ BLOCK'}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Hazards */}
            <div className="bg-[#111827] p-4 rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-icons-round text-[#E65100] text-base">warning</span>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Detected Hazards</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {parseHazards(result.detectedHazards).map((hazard, i) => (
                  <span key={i} className="bg-red-900/40 border border-red-500/30 text-red-300 text-[10px] font-medium px-2.5 py-1 rounded-full">
                    {hazard}
                  </span>
                ))}
              </div>
            </div>

          </div>
        </div>

        <div className="px-6 space-y-3 mb-6">
          <button 
            onClick={() => onTabChange('report')}
            className="w-full py-4 bg-[#E65100] hover:bg-[#CC4800] text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
          >
            <span className="material-icons-round">podcasts</span>
            Report to Authorities (JPS/APM)
          </button>
        </div>

        <div className="text-center pb-8">
          <p className="text-[10px] text-slate-400">
            ID: FL-{new Date().getFullYear()}-{Math.floor(Math.random() * 10000).toString().padStart(4, '0')} | Analysis generated just now
          </p>
        </div>
      </div>

      <BottomNav activeTab="report" onTabChange={onTabChange} />
    </div>
  );
}
