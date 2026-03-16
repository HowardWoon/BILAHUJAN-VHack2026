import { useEffect, useMemo, useState } from 'react';
import StatusBar from '../components/StatusBar';
import BottomNav from '../components/BottomNav';
import { FloodZone, addFloodZone, createZone, getFloodZones, reconcileStateSeverity, useFloodZones } from '../data/floodZones';
import { fetchLiveWeatherAndCCTV, fetchStateTownsWithWeather } from '../services/gemini';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase';

const MALAYSIA_STATES = [
  { name: 'Selangor', region: 'Central Region' },
  { name: 'Kuala Lumpur', region: 'Federal Territory' },
  { name: 'Johor', region: 'Southern Region' },
  { name: 'Penang', region: 'Northern Region' },
  { name: 'Pahang', region: 'East Coast' },
  { name: 'Sarawak', region: 'East Malaysia' },
  { name: 'Sabah', region: 'East Malaysia' },
  { name: 'Perak', region: 'Northern Region' },
  { name: 'Kedah', region: 'Northern Region' },
  { name: 'Kelantan', region: 'East Coast' },
  { name: 'Terengganu', region: 'East Coast' },
  { name: 'Negeri Sembilan', region: 'Central Region' },
  { name: 'Melaka', region: 'Southern Region' },
  { name: 'Perlis', region: 'Northern Region' },
  { name: 'Putrajaya', region: 'Federal Territory' },
  { name: 'Labuan', region: 'Federal Territory' }
];

const isRealtimeZone = (zone: any) => !zone?.isHistorical && zone?.status !== 'resolved';

const getZoneTimestamp = (zone: any) => {
  if (!zone) return 0;
  if (typeof zone.timestamp === 'number' && Number.isFinite(zone.timestamp)) return zone.timestamp;

  const parsed = Date.parse(zone.lastUpdated || zone.reportedAt || '');
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatRelativeUpdateTime = (timestamp: number) => {
  if (!timestamp) return 'Last updated just now';

  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes <= 1) return 'Last updated just now';
  if (diffMinutes < 60) return `Last updated ${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Last updated ${diffHours} hr ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `Last updated ${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
};

function getStateSeverity(
  stateName: string,
  liveZones: Record<string, any>
): { severity: number; zoneName: string; count: number; lastUpdatedLabel: string } {
  const stateZones = Object.values(liveZones).filter(
    (zone: any) =>
      isRealtimeZone(zone) && (
      zone.state?.toLowerCase() === stateName.toLowerCase() ||
      zone.name?.toLowerCase().includes(stateName.toLowerCase())
      )
  );

  if (stateZones.length === 0) {
    return { severity: 0, zoneName: '', count: 0, lastUpdatedLabel: 'Waiting for live update' };
  }

  const liveStateZone = stateZones.find((zone: any) => zone.id?.startsWith('live_') && !zone.id?.startsWith('live_town_'));
  const userZones = stateZones.filter((zone: any) => zone.id?.startsWith('user_reported_'));
  const userMaxSeverity = userZones.reduce((max: number, zone: any) => Math.max(max, zone.severity || 0), 0);
  const liveSeverity = liveStateZone?.severity || 0;
  const isRaining = liveStateZone?.eventType === 'Heavy Rain' || (liveStateZone?.rainfall ?? 0) > 0;
  const effectiveSeverity = reconcileStateSeverity(liveSeverity, userMaxSeverity, isRaining, userZones.length);

  const highest = stateZones.reduce((max: any, zone: any) =>
    (zone.severity || 0) > (max.severity || 0) ? zone : max,
  stateZones[0]);

  const displayZone = userMaxSeverity >= liveSeverity && userZones.length > 0
    ? userZones.reduce((max: any, zone: any) => (zone.severity || 0) > (max.severity || 0) ? zone : max, userZones[0])
    : highest;

  const freshestTimestamp = stateZones.reduce((max: number, zone: any) => {
    return Math.max(max, getZoneTimestamp(zone));
  }, 0);

  return {
    severity: effectiveSeverity || highest.severity || 0,
    zoneName: displayZone?.name || stateName,
    count: stateZones.length,
    lastUpdatedLabel: formatRelativeUpdateTime(freshestTimestamp)
  };
}

interface AlertsScreenProps {
  onTabChange: (tab: 'map' | 'report' | 'alert' | 'dashboard') => void;
  onAlertClick: (zoneId: string) => void;
  onScanClick: () => void;
  initialState?: string | null;
  initialZoneId?: string | null;
  onClearNotifications: () => void;
  onNotificationsReady: (items: { zoneId: string; zone: FloodZone }[]) => void;
}

export default function AlertsScreen({ onTabChange, onAlertClick, onScanClick, initialState, initialZoneId, onClearNotifications, onNotificationsReady }: AlertsScreenProps) {
  const allZones = useFloodZones();
  
  const zones = useMemo(() => {
    const now = new Date();
    const filtered: Record<string, FloodZone> = {};
    Object.entries(allZones).forEach(([id, zone]) => {
      const floodZone = zone as FloodZone;
      if ((zone as any).isHistorical || (zone as any).status === 'resolved') {
        return;
      }
      if (floodZone.estimatedEndTime && floodZone.estimatedEndTime !== 'N/A' && floodZone.estimatedEndTime !== 'Unknown') {
        const endTime = new Date(floodZone.estimatedEndTime);
        // Only filter out if it's a valid date and it's in the past
        if (!isNaN(endTime.getTime()) && endTime < now) {
          // Skip this zone
        } else {
          filtered[id] = floodZone;
        }
      } else {
        filtered[id] = floodZone;
      }
    });
    return filtered;
  }, [allZones]);

  const [selectedState, setSelectedState] = useState<string | null>(initialState ?? null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<string | null>(null);
  const [liveZoneData, setLiveZoneData] = useState<Record<string, any>>({});

  useEffect(() => {
    setSelectedState(initialState ?? null);
  }, [initialState]);

  useEffect(() => {
    if (!selectedState || !initialZoneId) return;

    const frameId = window.requestAnimationFrame(() => {
      const target = document.getElementById(`alert-zone-${initialZoneId}`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [initialZoneId, selectedState, zones]);

  useEffect(() => {
    const zonesRef = ref(rtdb, 'liveZones');
    const unsubscribe = onValue(zonesRef, (snapshot) => {
      if (snapshot.exists()) {
        const raw = snapshot.val() as Record<string, any>;
        const filtered = Object.fromEntries(
          Object.entries(raw).filter(([, zone]) => isRealtimeZone(zone))
        );
        setLiveZoneData(filtered);
      } else {
        setLiveZoneData({});
      }
    });
    return () => unsubscribe();
  }, []);

  const handleRefreshLiveData = async () => {
    if (isRefreshing) return;
    onClearNotifications();
    setIsRefreshing(true);

    const allStatesList = [
      'Selangor', 'Kuala Lumpur', 'Johor', 'Penang', 'Pahang',
      'Sarawak', 'Sabah', 'Perak', 'Kedah', 'Kelantan',
      'Terengganu', 'Negeri Sembilan', 'Melaka', 'Perlis',
      'Putrajaya', 'Labuan'
    ];
    const statesToUpdate = allStatesList;
    const total = statesToUpdate.length;
    let done = 0;

    const coords: Record<string, [number, number]> = {
      'Selangor': [3.07, 101.51], 'Kuala Lumpur': [3.14, 101.69],
      'Kelantan': [6.12, 102.23], 'Johor': [1.49, 103.74],
      'Penang': [5.35, 100.28], 'Pahang': [3.81, 103.32],
      'Sarawak': [1.55, 110.35], 'Sabah': [5.98, 116.07],
      'Perak': [4.59, 101.09], 'Kedah': [6.12, 100.36],
      'Terengganu': [5.33, 103.15], 'Negeri Sembilan': [2.72, 101.94],
      'Melaka': [2.19, 102.25], 'Perlis': [6.44, 100.20],
      'Putrajaya': [2.92, 101.69], 'Labuan': [5.28, 115.24],
    };

    try {
      if (selectedState) {
        // ── Town-level refresh: use Google Maps/Search to discover real towns ──
        setRefreshStatus(`Searching Google Maps for ${selectedState} towns...`);
        const towns = await fetchStateTownsWithWeather(selectedState);

        if (towns.length === 0) {
          setRefreshStatus('Could not find towns. Try again.');
          setTimeout(() => setRefreshStatus(null), 2500);
          return;
        }

        setRefreshStatus(`Found ${towns.length} towns. Updating...`);

        const townZones: { zoneId: string; zone: FloodZone }[] = [];
        towns.forEach((townData) => {
          const zoneId = `live_town_${townData.town.toLowerCase().replace(/\s+/g, '_')}_${selectedState.toLowerCase().replace(/\s+/g, '_')}`;
          const newZone = createZone(
            zoneId,
            townData.town,
            `Live Weather: ${townData.weatherCondition}`,
            selectedState,
            'Live Region',
            townData.lat,
            townData.lng,
            townData.severity,
            townData.weatherCondition,
            0.05,
            ['Google Maps', 'Google Search', 'AI Analysis']
          );
          newZone.aiAnalysisText = townData.aiAnalysisText;
          newZone.eventType = townData.isRaining ? 'Heavy Rain' : 'Normal';
          addFloodZone(newZone);
          townZones.push({ zoneId, zone: newZone });
        });
        window.dispatchEvent(new CustomEvent('floodZonesUpdated'));
        // Show one notification banner per town
        onClearNotifications();
        onNotificationsReady(townZones);
        setRefreshStatus('Updated!');
        setTimeout(() => setRefreshStatus(null), 2000);
        return;
      } else {
        // ── Statewide overview: one query per state ──
        setRefreshStatus(`Checking weather (0/${total})...`);
        const collectedZones: { zoneId: string; zone: FloodZone }[] = [];
        const batchSize = 8;
        for (let i = 0; i < statesToUpdate.length; i += batchSize) {
          const batch = statesToUpdate.slice(i, i + batchSize);
          await Promise.allSettled(batch.map(async (state) => {
            try {
              const liveData = await fetchLiveWeatherAndCCTV(state);
              const [lat, lng] = coords[state] ?? [3.14, 101.69];
              const newZoneId = `live_${state.toLowerCase().replace(/\s+/g, '_')}`;
              // Reconcile live-weather severity with any existing user reports for this state
              const allCurrentZones = getFloodZones();
              const userZonesForState = Object.values(allCurrentZones).filter(
                z => z.state === state && z.id.startsWith('user_reported_')
              );
              const userMaxSev = userZonesForState.reduce(
                (max, z) => Math.max(max, z.severity), 0
              );
              const reconciledSev = reconcileStateSeverity(
                liveData.severity, userMaxSev, liveData.isRaining, userZonesForState.length
              );
              const newZone = createZone(
                newZoneId, state,  // use state name so it merges with the static zone
                `Live Weather: ${liveData.weatherCondition}`,
                state, 'Live Region', lat, lng,
                reconciledSev, liveData.weatherCondition,
                0.05, ['Google Weather', 'CCTV Live', 'AI Analysis']
              );
              newZone.aiAnalysisText = liveData.aiAnalysisText;
              newZone.eventType = liveData.isRaining ? 'Heavy Rain' : 'Normal';
              addFloodZone(newZone);
              collectedZones.push({ zoneId: newZoneId, zone: newZone });
            } catch (err) {
              console.error(`Failed to fetch data for ${state}:`, err);
            }
            done++;
            setRefreshStatus(`Checking weather (${done}/${total})...`);
          }));
          if (i + batchSize < statesToUpdate.length) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
        // All 16 states done — fill any failures with a severity-0 fallback so all 16 slots appear
        allStatesList.forEach(state => {
          if (!collectedZones.find(z => z.zone.state === state)) {
            const [lat, lng] = coords[state] ?? [3.14, 101.69];
            const fallbackId = `live_${state.toLowerCase().replace(/\s+/g, '_')}`;
            const fallbackZone = createZone(fallbackId, state, 'No live data available', state, '', lat, lng, 0, 'Unknown', 0.05, []);
            collectedZones.push({ zoneId: fallbackId, zone: fallbackZone });
          }
        });
        // Hand all 16 directly to App — no events, no race conditions
        onNotificationsReady(collectedZones);
      } // end statewide

      setRefreshStatus('Updated!');
      setTimeout(() => setRefreshStatus(null), 2000);
    } catch (error) {
      setRefreshStatus('Update failed.');
      setTimeout(() => setRefreshStatus(null), 2000);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Group zones by state
  const stateGroups = useMemo(() => {
    const groups: Record<string, { region: string, zones: FloodZone[], maxSeverity: number, activeReports: number }> = {};
    
    MALAYSIA_STATES.forEach(state => {
      groups[state.name] = {
        region: state.region,
        zones: [],
        maxSeverity: 0,
        activeReports: 0
      };
    });

    Object.values(zones).forEach(z => {
      const zone = z as FloodZone;
      if (!groups[zone.state]) {
        groups[zone.state] = { region: zone.region, zones: [], maxSeverity: 0, activeReports: 0 };
      }
      groups[zone.state].zones.push(zone);
    });

    // Apply statistical reconciliation per state: unify live-weather signal + user reports
    Object.entries(groups).forEach(([, data]) => {
      const liveZone = data.zones.find(
        z => z.id.startsWith('live_') && !z.id.startsWith('live_town_')
      );
      const userZones = data.zones.filter(z => z.id.startsWith('user_reported_'));
      const liveSeverity = liveZone?.severity ?? 0;
      const userMaxSeverity = userZones.reduce((max, z) => Math.max(max, z.severity), 0);
      const isRaining =
        liveZone?.eventType === 'Heavy Rain' || (liveZone?.rainfall ?? 0) > 0;
      const effectiveSeverity = reconcileStateSeverity(
        liveSeverity, userMaxSeverity, isRaining, userZones.length
      );
      data.maxSeverity = effectiveSeverity;
      data.activeReports = data.zones.filter(z => z.severity >= 4).length;
    });

    // Sort states by reconciled severity
    return Object.entries(groups).sort((a, b) => b[1].maxSeverity - a[1].maxSeverity);
  }, [zones]);

  const renderStateList = () => (
    <>
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-extrabold text-[#1A202C] mb-1">Malaysia Status</h2>
          <p className="text-slate-500 text-sm">Real-time flood monitoring across all regions.</p>
        </div>
        <button 
          onClick={handleRefreshLiveData}
          disabled={isRefreshing}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isRefreshing ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-[#6366F1] text-white hover:bg-[#4f46e5] shadow-md'}`}
        >
          <span className={`material-icons-round ${isRefreshing ? 'animate-spin' : ''}`}>sync</span>
        </button>
      </div>

      {refreshStatus && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-2 text-blue-700 text-sm font-medium animate-[fadeIn_0.3s_ease-out]">
          <span className="material-icons-round text-blue-500 text-lg">info</span>
          {refreshStatus}
        </div>
      )}

      <div className="space-y-4">
        {MALAYSIA_STATES.map(({ name: stateName, region }) => {
          const stateInfo = getStateSeverity(stateName, liveZoneData);
          const isFlood = stateInfo.severity >= 4;
          const isSevere = stateInfo.severity >= 7;
          const isCritical = stateInfo.severity >= 9;
          const titleColor = isCritical || isSevere ? 'text-white' : isFlood ? 'text-orange-900' : 'text-green-900';
          const regionColor = isCritical || isSevere ? 'text-red-100' : isFlood ? 'text-orange-700' : 'text-green-700';
          const zoneColor = isCritical || isSevere ? 'text-red-100' : isFlood ? 'text-orange-800' : 'text-green-800';
          const metaColor = isCritical || isSevere ? 'text-red-100/90' : isFlood ? 'text-orange-700/90' : 'text-green-700/90';

          return (
            <div
              key={stateName}
              onClick={() => setSelectedState(stateName)}
              className={`rounded-2xl p-4 mb-3 transition-all cursor-pointer hover:brightness-105 ${
                isCritical ? 'bg-red-950 border border-red-800' :
                isSevere ? 'bg-red-800 border border-red-700' :
                isFlood ? 'bg-orange-100 border border-orange-500' :
                stateInfo.severity > 0 ? 'bg-emerald-100 border border-emerald-500' :
                'bg-green-100 border border-green-500'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className={`${titleColor} font-bold text-xl mb-1`}>{stateName}</h3>
                  <p className={`${regionColor} text-sm`}>{region}</p>
                </div>

                {stateInfo.severity === 0 ? (
                  <span className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                    <span className="material-icons-round text-sm">check_circle</span>
                    CLEAR
                  </span>
                ) : isCritical ? (
                  <span className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full animate-pulse">
                    🆘 CRITICAL
                  </span>
                ) : isSevere ? (
                  <span className="flex items-center gap-1 px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
                    🔴 SEVERE
                  </span>
                ) : isFlood ? (
                  <span className="flex items-center gap-1 px-3 py-1 bg-orange-500 text-white text-xs font-bold rounded-full">
                    🟠 FLOOD
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full">
                    🟡 WATCH
                  </span>
                )}
              </div>

              {stateInfo.severity === 0 ? (
                <p className="text-gray-400 text-sm">No active alerts</p>
              ) : (
                <div>
                  <p className={`text-sm font-medium ${zoneColor}`}>
                    {stateInfo.zoneName}
                  </p>
                  <p className={`${metaColor} text-xs mt-0.5`}>
                    Severity {stateInfo.severity}/10 · {stateInfo.count} active zone{stateInfo.count > 1 ? 's' : ''}
                  </p>
                  <p className={`${metaColor} text-[11px] mt-1 font-medium`}>
                    {stateInfo.lastUpdatedLabel}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  const renderFormattedAnalysis = (text: string) => {
    if (!text) return null;
    
    // If it's a very short single sentence, just render it normally
    if (text.length < 30 && !text.includes('.')) {
      return <p className="text-sm text-slate-600 mb-4">{text}</p>;
    }

    // Split by sentences, keeping the punctuation
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    return (
      <div className="space-y-2 mb-4 mt-2">
        {sentences.map((sentence, idx) => {
          const cleanSentence = sentence.trim();
          if (!cleanSentence) return null;
          
          let icon = 'info';
          let color = 'text-blue-500';
          let bgColor = 'bg-blue-50';
          
          const lower = cleanSentence.toLowerCase();
          if (/\b(rain|storm|weather|downpour|shower|showers)\b/.test(lower)) {
            icon = 'water_drop';
            color = 'text-sky-500';
            bgColor = 'bg-sky-50';
          } else if (/\b(cctv|traffic|road|roads|highway|expressway)\b/.test(lower)) {
            icon = 'traffic';
            color = 'text-amber-500';
            bgColor = 'bg-amber-50';
          } else if (/\b(risk|warning|alert|vigilant|evacuate|evacuation|critical|danger)\b/.test(lower)) {
            icon = 'warning';
            color = 'text-red-500';
            bgColor = 'bg-red-50';
          } else if (/\b(stable|clear|normal|normally|no major|safe)\b/.test(lower)) {
            icon = 'check_circle';
            color = 'text-emerald-500';
            bgColor = 'bg-emerald-50';
          }

          return (
            <div key={idx} className="flex items-start gap-2">
              <div className={`mt-0.5 w-6 h-6 rounded-md ${bgColor} shrink-0 flex items-center justify-center overflow-hidden`}>
                <span className={`material-icons-round text-[14px] ${color}`}>{icon}</span>
              </div>
              <p className="text-sm text-slate-700 leading-snug flex-1">{cleanSentence}</p>
            </div>
          );
        })}
      </div>
    );
  };

  const renderLocationList = () => {
    if (!selectedState) return null;
    
    const stateData = stateGroups.find(g => g[0] === selectedState)?.[1];
    const rawZones = stateData?.zones.sort((a, b) => b.severity - a.severity) || [];

    // Deduplicate: keep only the highest-severity zone per normalised name.
    // Strips "(Default)" and other parenthetical suffixes before comparing.
    const normName = (n: string) => n.replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
    const seen = new Map<string, typeof rawZones[0]>();
    rawZones.forEach(zone => {
      const key = normName(zone.name);
      if (!seen.has(key) || zone.severity > seen.get(key)!.severity) {
        seen.set(key, zone);
      }
    });
    const stateZones = Array.from(seen.values()).sort((a, b) => b.severity - a.severity);

    return (
      <>
        <div className="mb-6 flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-bold text-[#1A202C] mb-1">{selectedState} Locations</h2>
            <p className="text-slate-500 text-sm">Select a location to view detailed analysis.</p>
          </div>
          <button 
            onClick={handleRefreshLiveData}
            disabled={isRefreshing}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isRefreshing ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-[#6366F1] text-white hover:bg-[#4f46e5] shadow-md'}`}
          >
            <span className={`material-icons-round ${isRefreshing ? 'animate-spin' : ''}`}>sync</span>
          </button>
        </div>

        {refreshStatus && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-2 text-blue-700 text-sm font-medium animate-[fadeIn_0.3s_ease-out]">
            <span className="material-icons-round text-blue-500 text-lg">info</span>
            {refreshStatus}
          </div>
        )}

        {stateZones.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-100 shadow-sm">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-icons-round text-green-500 text-3xl">check_circle</span>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">All Clear</h3>
            <p className="text-slate-500 text-sm">No active flood warnings or reports for any location in {selectedState}.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {(() => {
              // Pre-compute reconciled severity for the live state-level zone so the badge
              // stays in sync with user uploads without needing a full refresh.
              const userZonesInState = stateZones.filter(z => z.id.startsWith('user_reported_'));
              const liveStateZone = stateZones.find(
                z => z.id.startsWith('live_') && !z.id.startsWith('live_town_')
              );
              const userMaxSev = userZonesInState.reduce((max, z) => Math.max(max, z.severity), 0);
              const liveIsRaining = liveStateZone?.eventType === 'Heavy Rain' || (liveStateZone?.rainfall ?? 0) > 0;
              const reconciledLiveSev = liveStateZone
                ? reconcileStateSeverity(
                    liveStateZone.severity, userMaxSev, liveIsRaining, userZonesInState.length
                  )
                : 0;

              return stateZones.map((zone) => {
                // For the live state-level zone, use the reconciled severity for display;
                // user-reported and town zones keep their own raw severity.
                const isStateLevelLive = zone.id.startsWith('live_') && !zone.id.startsWith('live_town_');
                const displaySeverity = isStateLevelLive ? reconciledLiveSev : zone.severity;
                const isFocusedZone = zone.id === initialZoneId;

                let headerBgColor = 'bg-slate-100';
                let headerBorderColor = 'border-slate-200';
                let headerTextColor = 'text-slate-600';
                let headerText = 'Maintenance Notice';

                const isLiveUpdate = zone.id.startsWith('live_');

                if (displaySeverity >= 8) {
                  headerBgColor = 'bg-[#EF4444]/10';
                  headerBorderColor = 'border-[#EF4444]/20';
                  headerTextColor = 'text-[#EF4444]';
                  headerText = isLiveUpdate ? 'LIVE UPDATE - FLOOD NOW' : 'FLOOD NOW';
                } else if (displaySeverity >= 4) {
                  headerBgColor = 'bg-[#F59E0B]/10';
                  headerBorderColor = 'border-[#F59E0B]/20';
                  headerTextColor = 'text-[#F59E0B]';
                  headerText = isLiveUpdate ? 'LIVE UPDATE - FLOOD RISK NEARBY' : 'FLOOD RISK NEARBY';
                } else {
                  headerBgColor = 'bg-green-50';
                  headerBorderColor = 'border-green-100';
                  headerTextColor = 'text-green-600';
                  headerText = isLiveUpdate ? 'LIVE UPDATE - NORMAL' : 'NORMAL';
                }

              return (
                <div 
                  id={`alert-zone-${zone.id}`}
                  key={zone.id}
                  onClick={() => onAlertClick(zone.id)}
                  className={`bg-white rounded-2xl overflow-hidden shadow-sm border cursor-pointer transition-all ${isFocusedZone ? 'border-[#635BFF] ring-2 ring-[#635BFF]/20 shadow-md' : 'border-slate-100 hover:shadow-md'}`}
                >
                  <div className={`${headerBgColor} px-4 py-2 border-b ${headerBorderColor}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`${headerTextColor} text-xs font-bold uppercase tracking-wider`}>{headerText}</span>
                      {isFocusedZone && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#635BFF]">Uploaded Analysis</span>
                      )}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-bold text-lg">{zone.name.replace(/\s*\(.*?\)\s*/g, '').trim() || zone.name}</h3>
                      <span className="text-xs font-medium text-slate-500 mt-1">Level {displaySeverity}</span>
                    </div>
                    {renderFormattedAnalysis(zone.aiAnalysisText || zone.forecast)}
                    {(zone.estimatedStartTime || zone.estimatedEndTime) && (
                      <div className="flex gap-4 mb-4 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        {zone.estimatedStartTime && (
                          <div>
                            <span className="font-bold text-slate-700 block mb-0.5">Start ({zone.eventType || 'Event'})</span>
                            {zone.estimatedStartTime}
                          </div>
                        )}
                        {zone.estimatedEndTime && (
                          <div>
                            <span className="font-bold text-slate-700 block mb-0.5">End ({zone.eventType || 'Event'})</span>
                            {zone.estimatedEndTime}
                          </div>
                        )}
                      </div>
                    )}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onAlertClick(zone.id);
                      }}
                      className="flex items-center text-[#635BFF] font-semibold text-sm hover:underline"
                    >
                      View More
                      <span className="material-icons-outlined text-sm ml-1">arrow_forward</span>
                    </button>
                  </div>
                </div>
              );
              });
            })()}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="relative h-full w-full flex flex-col bg-[#F9FAFB]">
      <StatusBar theme="light" />
      
      <header className="px-6 py-4 flex items-center justify-between bg-white border-b border-slate-100">
        <button 
          onClick={() => {
            if (selectedState) {
              setSelectedState(null);
            } else {
              onTabChange('map');
            }
          }}
          className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors flex items-center justify-center"
        >
          <span className="material-icons-round text-slate-700">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">
          {selectedState ? selectedState : 'Alerts by State'}
        </h1>
        <div className="w-10"></div> {/* Spacer for centering */}
      </header>

      <main className="flex-1 px-6 pt-6 pb-32 overflow-y-auto">
        {selectedState ? renderLocationList() : renderStateList()}

        {/* Banner */}
        {!selectedState && (
          <div 
            onClick={onScanClick}
            className="bg-[#635BFF]/5 rounded-2xl p-4 border border-[#635BFF]/20 flex items-center space-x-4 mt-8 cursor-pointer hover:bg-[#635BFF]/10 transition-colors"
          >
            <div className="bg-[#635BFF] text-white p-3 rounded-full flex items-center justify-center">
              <span className="material-icons-outlined">forum</span>
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-sm">Join Our Community Discord</h4>
              <p className="text-xs text-slate-600">Share flood updates & connect with locals on Discord.</p>
            </div>
            <button className="material-icons-outlined text-slate-400">chevron_right</button>
          </div>
        )}
      </main>

      <BottomNav activeTab="alert" onTabChange={onTabChange} />
    </div>
  );
}
