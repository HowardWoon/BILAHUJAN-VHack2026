import { useMemo, useState, useEffect } from 'react';
import StatusBar from '../components/StatusBar';
import BottomNav from '../components/BottomNav';
import { getFloodZones } from '../data/floodZones';

interface EvacCenter {
  name: string;
  address: string;
  lat: number;
  lng: number;
  distanceKm: number;
  placeId: string;
}

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

interface AlertDetailScreenProps {
  zoneId: string | null;
  onBack: () => void;
  onScanClick: () => void;
  onTabChange: (tab: 'map' | 'report' | 'alert' | 'dashboard') => void;
}

export default function AlertDetailScreen({ zoneId, onBack, onScanClick, onTabChange }: AlertDetailScreenProps) {
  const zones = useMemo(() => getFloodZones(), []);
  const zone = zoneId ? zones[zoneId] : null;

  const [evacCenters, setEvacCenters] = useState<EvacCenter[]>([]);
  const [evacLoading, setEvacLoading] = useState(true);
  const [selectedCenter, setSelectedCenter] = useState<EvacCenter | null>(null);

  useEffect(() => {
    if (!zone) return;
    if (!(window as any).google?.maps?.places) { setEvacLoading(false); return; }

    const service = new (window as any).google.maps.places.PlacesService(
      document.createElement('div')
    );
    const centerLatLng = new (window as any).google.maps.LatLng(zone.center.lat, zone.center.lng);

    // Search for evacuation-suitable public places nearby: schools, community halls, stadiums
    const keywords = ['pusat pemindahan', 'dewan orang ramai', 'balai raya', 'sekolah', 'stadium', 'mosque'];
    const allResults: EvacCenter[] = [];
    let done = 0;

    keywords.slice(0, 3).forEach(keyword => {
      service.nearbySearch(
        { location: centerLatLng, radius: 10000, keyword },
        (results: any[], status: string) => {
          done++;
          if (status === 'OK' && results) {
            results.slice(0, 3).forEach((place: any) => {
              const lat = place.geometry.location.lat();
              const lng = place.geometry.location.lng();
              if (!allResults.find(r => r.placeId === place.place_id)) {
                allResults.push({
                  name: place.name,
                  address: place.vicinity || '',
                  lat,
                  lng,
                  distanceKm: haversineKm(zone.center.lat, zone.center.lng, lat, lng),
                  placeId: place.place_id,
                });
              }
            });
          }
          if (done === 3) {
            // Sort by distance, keep closest 4
            const sorted = allResults.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 4);
            setEvacCenters(sorted);
            if (sorted.length > 0) setSelectedCenter(sorted[0]);
            setEvacLoading(false);
          }
        }
      );
    });

    // Fallback if Places never calls back
    const timer = setTimeout(() => setEvacLoading(false), 8000);
    return () => clearTimeout(timer);
  }, [zone]);

  const handleNavigation = () => {
    const dest = selectedCenter
      ? `${selectedCenter.lat},${selectedCenter.lng}`
      : zone ? `${zone.center.lat},${zone.center.lng}` : '';
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, '_blank');
  };

  if (!zone) {
    return (
      <div className="relative h-full w-full flex flex-col bg-[#F8F9FA] items-center justify-center">
        <p>Alert not found.</p>
        <button onClick={onBack} className="mt-4 text-[#6366F1] font-bold">Go Back</button>
      </div>
    );
  }

  const isHighRisk = zone.severity >= 8;
  const isMediumRisk = zone.severity >= 4 && zone.severity < 8;
  const riskLabel = isHighRisk ? 'HIGH RISK' : isMediumRisk ? 'MODERATE RISK' : 'LOW RISK';
  const riskColor = isHighRisk ? 'red' : isMediumRisk ? 'orange' : 'green';
  const riskText = isHighRisk ? 'AI predicts flood peak in 1.5 hours' : isMediumRisk ? 'AI predicts possible flooding during heavy rain' : 'AI predicts no immediate flood risk';

  // Generate a static map image URL based on the zone's center coordinates
  const mapImageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${zone.center.lat},${zone.center.lng}&zoom=14&size=600x300&maptype=roadmap&markers=color:${riskColor}%7Clabel:!%7C${zone.center.lat},${zone.center.lng}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}`;
  return (
    <div className="relative h-full w-full flex flex-col bg-[#F8F9FA]">
      <StatusBar theme="light" />
      
      <header className="px-6 py-4 flex items-center justify-between">
        <button 
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold tracking-tight">Alert Details</h1>
        <div className="w-10 h-10"></div> {/* Placeholder for balance */}
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-24 space-y-4">
        {/* Header Card */}
        <div className={`bg-[#E53935] text-white p-6 rounded-3xl shadow-lg`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-white/90 text-sm">warning</span>
            <span className="inline-block px-2 py-0.5 bg-white/20 text-white text-[10px] font-bold uppercase tracking-widest rounded-full">
              {riskLabel}
            </span>
          </div>
          <h2 className="text-4xl font-extrabold mb-2 tracking-tight">{zone.specificLocation}</h2>
          <div className="flex items-center gap-2 text-white/90 text-sm font-medium">
            <span className="material-symbols-outlined text-sm">smart_toy</span>
            <p>{riskText}</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          {(zone.estimatedStartTime || zone.estimatedEndTime) && (
            <div className="col-span-3 bg-slate-100 p-4 rounded-2xl flex justify-between items-center border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-slate-600">
                  <span className="material-symbols-outlined">schedule</span>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Start ({zone.eventType || 'Event'})</p>
                  <p className="text-sm font-bold text-slate-800">{zone.estimatedStartTime || 'Unknown'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">End ({zone.eventType || 'Event'})</p>
                <p className="text-sm font-bold text-slate-800">{zone.estimatedEndTime || 'Unknown'}</p>
              </div>
            </div>
          )}

          <div className="bg-[#1E293B] text-white p-4 rounded-2xl flex flex-col justify-between">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">Drainage</p>
            <div>
              <div className="text-2xl font-bold mb-1">{zone.drainageBlockage}%</div>
              <p className={`text-xs font-medium ${zone.drainageBlockage > 70 ? 'text-[#E53935]' : zone.drainageBlockage > 40 ? 'text-orange-400' : 'text-green-400'}`}>
                {zone.drainageBlockage > 70 ? 'Blocked' : zone.drainageBlockage > 40 ? 'Partial' : 'Clear'}
              </p>
            </div>
            <div className="w-full h-1 bg-slate-700 rounded-full mt-3 overflow-hidden">
              <div className={`h-full ${zone.drainageBlockage > 70 ? 'bg-[#E53935]' : zone.drainageBlockage > 40 ? 'bg-orange-400' : 'bg-green-400'}`} style={{ width: `${zone.drainageBlockage}%` }}></div>
            </div>
          </div>

          <div className="bg-[#1E293B] text-white p-4 rounded-2xl flex flex-col justify-between relative overflow-hidden">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">Rainfall</p>
            <div>
              <div className="text-2xl font-bold mb-1">{zone.rainfall}<span className="text-xs text-slate-400 font-normal">mm/hr</span></div>
            </div>
            <span className="material-symbols-outlined absolute right-2 bottom-2 text-3xl text-white/10">cloudy_snowing</span>
          </div>

          <div className="bg-[#2A244D] text-white p-4 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center gap-1 mb-2">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">AI Conf</p>
              <span className="material-symbols-outlined text-[10px] text-[#A78BFA]">auto_awesome</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-[#A78BFA] mb-1">{zone.aiConfidence}%</div>
              <p className="text-[10px] font-medium text-slate-300">High Accuracy</p>
            </div>
          </div>
        </div>

        {/* Gemini AI Analysis */}
        <div className="bg-white border border-[#A78BFA]/30 p-5 rounded-3xl shadow-sm relative overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-[#8B5CF6] flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[14px]">smart_toy</span>
            </div>
            <h3 className="font-bold text-sm tracking-wide">GEMINI AI ANALYSIS</h3>
          </div>
          
          <div className="flex gap-4">
            <div className="w-24 h-24 rounded-xl overflow-hidden relative flex-shrink-0 border border-slate-200">
              <img 
                src={mapImageUrl} 
                alt="Map" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = "https://lh3.googleusercontent.com/aida-public/AB6AXuALLxYx7YJrqORiNwHA4wo1JIkCIxNlsBBpy7JaDhVBcvSlqA4D9oNMm_pKJKLyMeLmpUJVRaY5yfA-yK74UgFLj3GLmoS_IrPoMZcN1k7c8SqJK-lRnbS0McYc5Es7cbHL-pKD8EMxg1vO-b4qUrzpzbSZMF9wLCf4MrjGmY6W4YD-jmypBfz8bmf6tDaCNdLFP51G4qLJR_A1t-mC7SrXXvVprx-VMp2j2lPQLpnv7OZmmO3eMhcKFEaKM1sNXyiWDEuI34J9cjY";
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-1">
                <p className="text-[8px] text-center text-white font-medium uppercase tracking-wider">Source: User</p>
              </div>
            </div>
            
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Visual Analysis</p>
                <p className="text-sm text-slate-800 leading-tight">
                  Water depth <span className="font-bold text-[#6366F1]">{zone.aiAnalysis.waterDepth}</span>, {zone.aiAnalysis.currentSpeed}. {zone.aiAnalysis.riskLevel}
                </p>
              </div>
              <div className="bg-slate-50 p-2 rounded-lg mt-2">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Historical Context</p>
                <p className="text-xs text-slate-700">{zone.aiAnalysis.historicalContext}</p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Recommendation */}
        <div className="bg-[#1E293B] text-white p-5 rounded-3xl shadow-lg">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#818CF8]">alt_route</span>
              <h3 className="font-bold text-sm tracking-wide">AI RECOMMENDATION</h3>
            </div>
            <span className="bg-white/10 text-white/80 text-[10px] px-2 py-1 rounded-full font-medium">
              {isHighRisk ? 'Urgent' : 'Advisory'}
            </span>
          </div>

          <p className="text-[10px] text-slate-400 mb-4">
            Nearest evacuation centres within <span className="text-white font-bold">10 km</span> of this alert zone
          </p>

          {evacLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-slate-400">
              <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
              <p className="text-xs">Searching nearby centres…</p>
            </div>
          ) : evacCenters.length === 0 ? (
            <div className="bg-white/5 rounded-2xl p-4 mb-4 text-center">
              <span className="material-symbols-outlined text-slate-500 text-2xl">location_off</span>
              <p className="text-xs text-slate-400 mt-1">No places found nearby. Proceed to the nearest school or community hall.</p>
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {evacCenters.map((c, i) => {
                const isSelected = selectedCenter?.placeId === c.placeId;
                return (
                  <button
                    key={c.placeId}
                    onClick={() => setSelectedCenter(c)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${
                      isSelected
                        ? 'bg-[#6366F1]/20 border-[#6366F1]/60'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {/* Rank badge */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${
                      i === 0 ? 'bg-green-500 text-white' : 'bg-white/10 text-slate-300'
                    }`}>{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-bold truncate">{c.name}</p>
                      <p className="text-slate-400 text-[10px] truncate">{c.address}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs font-bold ${i === 0 ? 'text-green-400' : 'text-slate-300'}`}>{c.distanceKm.toFixed(1)} km</p>
                      {isSelected && <span className="material-symbols-outlined text-[#818CF8] text-sm">check_circle</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {zone.notifiedDepts && zone.notifiedDepts.length > 0 && (
            <div className="mb-4 bg-white/5 p-3 rounded-xl border border-white/10">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Notified Authorities</p>
              <div className="flex flex-wrap gap-2">
                {zone.notifiedDepts.map(dept => (
                  <span key={dept} className="bg-[#ec5b13]/20 text-[#ec5b13] border border-[#ec5b13]/30 px-2 py-1 rounded-md text-xs font-bold">
                    {dept}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => { handleNavigation(); }}
            disabled={evacLoading}
            className="group relative w-full overflow-hidden rounded-2xl text-white font-bold transition-all duration-200 active:scale-[0.97] active:brightness-90 disabled:opacity-50"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {/* Background layers */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#4338CA] via-[#6366F1] to-[#818CF8]" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />
            {/* Shimmer */}
            <span className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            {/* Glow */}
            <div className="absolute -inset-1 bg-[#6366F1]/40 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />

            {/* Content */}
            <div className="relative flex items-center justify-between px-5 py-4">
              {/* Left: pulsing dot + label */}
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 flex items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
                  <span className="relative w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">navigation</span>
                  </span>
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60">Nearest Safe Location</p>
                  <p className="text-sm font-black leading-tight">
                    {selectedCenter ? selectedCenter.name : 'Start Navigation'}
                  </p>
                </div>
              </div>

              {/* Right: arrow chip */}
              <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5 group-hover:bg-white/25 transition-colors duration-200">
                <span className="text-xs font-bold">Go</span>
                <span className="material-symbols-outlined text-base transition-transform duration-300 group-hover:translate-x-0.5">arrow_forward</span>
              </div>
            </div>
          </button>
        </div>
      </main>

      <BottomNav activeTab="alert" onTabChange={onTabChange} />
    </div>
  );
}
