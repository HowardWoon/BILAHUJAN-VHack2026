import { useState, useEffect } from 'react';
import StatusBar from '../components/StatusBar';
import BottomNav from '../components/BottomNav';
import { FloodAnalysisResult } from '../services/gemini';
import { createZone, addFloodZone } from '../data/floodZones';

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

interface ResultScreenProps {
  result: FloodAnalysisResult;
  imageUri: string;
  location: { lat: number; lng: number; address: string } | null;
  onBack: () => void;
  onTabChange: (tab: 'map' | 'report' | 'alert' | 'dashboard') => void;
  zoneId?: string | null;
  onUploadAlert?: (zoneId: string, zone: import('../data/floodZones').FloodZone) => void;
}

export default function ResultScreen({ result, imageUri, location, onBack, onTabChange, onUploadAlert }: ResultScreenProps) {
  const [isUploaded, setIsUploaded] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState(0);
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
          
          // Find a good human readable name (locality, sublocality, or route)
          const locality = addressComponents.find(c => c.types.includes('locality'))?.long_name;
          const sublocality = addressComponents.find(c => c.types.includes('sublocality'))?.long_name;
          const route = addressComponents.find(c => c.types.includes('route'))?.long_name;
          
          let readableName = 'Reported Location';
          if (sublocality && locality) {
            readableName = `${sublocality}, ${locality}`;
          } else if (locality) {
            readableName = locality;
          } else if (route) {
            readableName = route;
          } else {
            readableName = results[0].formatted_address.split(',')[0];
          }
          
          // Store the readable name in fullAddress state for now, we'll use it in createZone
          setFullAddress(readableName);

          if (stateComponent) {
            let stateName = stateComponent.long_name;
            // Clean up common prefixes/suffixes to match our predefined states
            if (stateName.includes('Kuala Lumpur')) stateName = 'Kuala Lumpur';
            else if (stateName.includes('Labuan')) stateName = 'Labuan';
            else if (stateName.includes('Putrajaya')) stateName = 'Putrajaya';
            else if (stateName.includes('Penang') || stateName.includes('Pulau Pinang')) stateName = 'Penang';
            else if (stateName.includes('Malacca') || stateName.includes('Melaka')) stateName = 'Melaka';
            else if (stateName.includes('Johor')) stateName = 'Johor';
            else if (stateName.includes('Kedah')) stateName = 'Kedah';
            else if (stateName.includes('Kelantan')) stateName = 'Kelantan';
            else if (stateName.includes('Negeri Sembilan')) stateName = 'Negeri Sembilan';
            else if (stateName.includes('Pahang')) stateName = 'Pahang';
            else if (stateName.includes('Perak')) stateName = 'Perak';
            else if (stateName.includes('Perlis')) stateName = 'Perlis';
            else if (stateName.includes('Sabah')) stateName = 'Sabah';
            else if (stateName.includes('Sarawak')) stateName = 'Sarawak';
            else if (stateName.includes('Selangor')) stateName = 'Selangor';
            else if (stateName.includes('Terengganu')) stateName = 'Terengganu';
            
            setDetectedState(stateName);
          }
        }
      });
    } else if (location?.address) {
       // Fallback to simple string matching if geocoding fails
       const states = ['Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis', 'Penang', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu', 'Kuala Lumpur', 'Putrajaya', 'Labuan'];
       for (const state of states) {
         if (location.address.toLowerCase().includes(state.toLowerCase())) {
           setDetectedState(state);
           break;
         }
       }
    }
  }, [location]);

  const handleUpload = () => {
    if (location) {
      const newZoneId = 'user_reported_' + Date.now();
      
      const newZone = createZone(
        newZoneId,
        fullAddress, // This is now the readable name
        fullAddress, // This is now the readable name
        detectedState !== 'Unknown State' ? detectedState : 'Kuala Lumpur', // Fallback to KL if unknown
        'Unknown Region',
        location.lat,
        location.lng,
        result.riskScore,
        result.directive,
        0.02,
        ['User Reports', 'AI Analysis']
      );
      
      newZone.estimatedStartTime = result.estimatedStartTime;
      newZone.estimatedEndTime = result.estimatedEndTime;
      newZone.eventType = result.eventType;
      
      addFloodZone(newZone);

      // Notify via direct callback — no window events
      if (onUploadAlert) onUploadAlert(newZoneId, newZone);
    }
    setNearbyUsers(Math.floor(Math.random() * 2000) + 500); // Random number between 500 and 2500
    setIsUploaded(true);
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

          {!isUploaded ? (
            <button 
              onClick={handleUpload}
              className="w-full bg-[#5E56B1] hover:bg-[#4A4494] text-white p-4 rounded-xl flex items-center justify-center gap-2 font-bold shadow-md transition-all active:scale-95"
            >
              <span className="material-icons-round">cloud_upload</span>
              Upload to Alert Zone
            </button>
          ) : (
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-start gap-3 animate-fade-in">
              <span className="material-icons-round text-emerald-500 mt-0.5">notifications_active</span>
              <p className="text-emerald-700 text-sm font-medium">
                Your report is live. <span className="font-bold">{nearbyUsers} nearby users</span> have been alerted.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 mb-6">
          {/* Severity Banner */}
          {(() => {
            const score = result.riskScore;
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
