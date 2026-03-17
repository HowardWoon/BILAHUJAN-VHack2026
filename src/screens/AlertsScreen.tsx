import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, get } from 'firebase/database';
import StatusBar from '../components/StatusBar';
import BottomNav from '../components/BottomNav';
import { rtdb } from '../firebase';
import type { FloodZone } from '../data/floodZones';
import { addFloodZone, createZone, reconcileStateSeverity, seedTownZonesInRealtimeDb } from '../data/floodZones';
import { fetchLiveWeatherAndCCTV } from '../services/gemini';
import { deduplicateFTName, isRealZone, severityToBadge, severityToCardClass, trimToCity } from '../utils/floodCalculations';

interface AlertsScreenProps {
  onTabChange: (tab: 'map' | 'report' | 'alert' | 'dashboard') => void;
  onAlertClick: (zoneId: string) => void;
  onStateClick: (stateName: string) => void;
  onScanClick: () => void;
  initialState?: string | null;
  initialZoneId?: string | null;
  onClearNotifications: () => void;
  onNotificationsReady: (items: { zoneId: string; zone: FloodZone }[]) => void;
}

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

const STATE_COORDS: Record<string, [number, number]> = {
  'Selangor': [3.07, 101.51],
  'Kuala Lumpur': [3.14, 101.69],
  'Johor': [1.49, 103.74],
  'Penang': [5.35, 100.28],
  'Pahang': [3.81, 103.32],
  'Sarawak': [1.55, 110.35],
  'Sabah': [5.98, 116.07],
  'Perak': [4.59, 101.09],
  'Kedah': [6.12, 100.36],
  'Kelantan': [6.12, 102.23],
  'Terengganu': [5.33, 103.15],
  'Negeri Sembilan': [2.72, 101.94],
  'Melaka': [2.19, 102.25],
  'Perlis': [6.44, 100.2],
  'Putrajaya': [2.92, 101.69],
  'Labuan': [5.28, 115.24]
};

const getStateZones = (stateName: string, zones: Record<string, FloodZone>) =>
  Object.values(zones)
    .filter((zone) => (zone.state || '').toLowerCase() === stateName.toLowerCase())
    .filter((zone) => !(zone as any).isHistorical && zone.status !== 'resolved');

const getLocationTitle = (zone: FloodZone) =>
  deduplicateFTName(trimToCity(zone.locationName || zone.specificLocation || zone.name || zone.state || 'Unknown'));

export default function AlertsScreen({
  onTabChange,
  onAlertClick,
  onStateClick,
  onScanClick,
  initialState,
  initialZoneId,
  onClearNotifications,
  onNotificationsReady
}: AlertsScreenProps) {
  const [zonesById, setZonesById] = useState<Record<string, FloodZone>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [refreshLabel, setRefreshLabel] = useState<string | null>(null);

  useEffect(() => {
    void seedTownZonesInRealtimeDb();

    const zonesRef = ref(rtdb, 'liveZones');
    const unsubscribe = onValue(zonesRef, (snapshot) => {
      const raw = snapshot.exists() ? (snapshot.val() as Record<string, FloodZone>) : {};
      setZonesById(raw);

      const liveItems = Object.values(raw)
        .filter((zone) => !(zone as any).isHistorical && zone.status !== 'resolved')
        .map((zone) => ({ zoneId: zone.id, zone }));
      onNotificationsReady(liveItems);
    });

    return () => unsubscribe();
  }, [onNotificationsReady]);

  useEffect(() => {
    if (initialState || initialZoneId) {
      onClearNotifications();
    }
  }, [initialState, initialZoneId, onClearNotifications]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshLabel('Refreshing live weather...');
    onClearNotifications();
    try {
      const zonesSnapshot = await get(ref(rtdb, 'liveZones'));
      const currentZones = zonesSnapshot.exists() ? (zonesSnapshot.val() as Record<string, FloodZone>) : {};

      const updates = await Promise.allSettled(
        MALAYSIA_STATES.map(async (state) => {
          const weather = await fetchLiveWeatherAndCCTV(state.name);
          const [lat, lng] = STATE_COORDS[state.name] || [3.139, 101.6869];
          const userZonesForState = Object.values(currentZones).filter(
            (zone) => (zone.state || '').toLowerCase() === state.name.toLowerCase() && String(zone.id || '').startsWith('user_reported_')
          );
          const userMaxSeverity = userZonesForState.reduce((max, zone) => Math.max(max, Number(zone.severity || 0)), 0);
          const finalSeverity = reconcileStateSeverity(
            Number(weather.severity || 0),
            userMaxSeverity,
            Boolean(weather.isRaining),
            userZonesForState.length
          );

          const zoneId = `live_${state.name.toLowerCase().replace(/\s+/g, '_')}`;
          const stateZone = createZone(
            zoneId,
            state.name,
            `Live Weather: ${weather.weatherCondition}`,
            state.name,
            state.region,
            lat,
            lng,
            finalSeverity,
            weather.weatherCondition,
            0.05,
            ['Google Weather', 'CCTV Live', 'AI Analysis']
          );
          stateZone.aiAnalysisText = weather.aiAnalysisText;
          stateZone.eventType = weather.isRaining ? 'Heavy Rain' : 'Normal';
          (stateZone as any).source = 'live_weather';
          (stateZone as any).isWeatherFallbackZone = finalSeverity < 2;
          addFloodZone(stateZone);
        })
      );

      const failed = updates.filter((result) => result.status === 'rejected').length;
      const snapshot = await get(ref(rtdb, 'liveZones'));
      const raw = snapshot.exists() ? (snapshot.val() as Record<string, FloodZone>) : {};
      setZonesById(raw);
      setRefreshLabel(failed > 0 ? `Updated with ${failed} failed state${failed > 1 ? 's' : ''}` : 'Updated');
      window.setTimeout(() => setRefreshLabel(null), 2000);
    } catch {
      setRefreshLabel('Refresh failed');
      window.setTimeout(() => setRefreshLabel(null), 1600);
    } finally {
      setRefreshing(false);
    }
  };

  const stateCards = useMemo(() => {
    return MALAYSIA_STATES.map((state) => {
      const stateZones = getStateZones(state.name, zonesById);
      const realZones = stateZones.filter((zone) => isRealZone(zone));
      const verifiedCount = realZones.length;
      const maxSeverity = verifiedCount > 0
        ? Math.max(...realZones.map((zone) => Number(zone.severity || 1)))
        : 1;

      const highestZone = realZones
        .slice()
        .sort((a, b) => Number(b.severity || 1) - Number(a.severity || 1))[0] || null;

      const activeCount = realZones.filter((zone) => Number(zone.severity || 1) >= 2).length;
      const verifiedReports = verifiedCount;

      return {
        ...state,
        maxSeverity,
        highestZone,
        activeCount,
        verifiedReports,
        fallbackZoneId: highestZone?.id || ''
      };
    }).sort((left, right) => {
      if (right.maxSeverity !== left.maxSeverity) return right.maxSeverity - left.maxSeverity;
      return left.name.localeCompare(right.name);
    });
  }, [zonesById]);

  return (
    <div className="relative h-full w-full flex flex-col bg-white">
      <StatusBar theme="light" />

      <header className="px-6 py-5 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 leading-tight">Malaysia Status</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time flood monitoring across all 16 states.</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${refreshing ? 'bg-gray-200 text-gray-400' : 'bg-[#6B59D3] text-white hover:bg-[#5a48c2]'}`}
        >
          <span className={`material-icons-round ${refreshing ? 'animate-spin' : ''}`}>sync</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-28">
        {refreshLabel && (
          <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 text-xs text-indigo-700 flex items-center gap-2">
            <span className="material-icons-round text-sm text-indigo-400">info</span>
            {refreshLabel}
          </div>
        )}

        <div className="space-y-3">
          {stateCards.map((card) => {
            const badge = severityToBadge(card.verifiedReports === 0 ? 1 : card.maxSeverity);
            const location = card.highestZone ? getLocationTitle(card.highestZone) : card.name;
            const isClear = card.verifiedReports === 0;

            return (
              <button
                key={card.name}
                onClick={() => {
                  if (card.fallbackZoneId) {
                    onAlertClick(card.fallbackZoneId);
                  } else {
                    onStateClick(card.name);
                  }
                }}
                className={`w-full text-left rounded-2xl p-4 transition-all ${card.verifiedReports === 0 ? 'bg-[#1a1a2e] border-l-4 border-l-green-500 border border-green-800/60' : severityToCardClass(card.maxSeverity)} hover:brightness-110`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h3 className="text-white text-xl font-bold leading-tight">{card.name}</h3>
                    <p className="text-slate-400 text-sm">{card.region}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black tracking-wide ${badge.className}`}>
                    <span className="material-icons-round text-sm">{badge.icon}</span>
                    {badge.text}
                  </span>
                </div>

                {isClear ? (
                  <div>
                    <p className="text-slate-500 text-sm">No active alerts</p>
                    <p className="text-slate-400 text-xs mt-0.5">No verified reports · Monitoring active</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-white text-sm font-semibold truncate">{location}</p>
                    <p className="text-slate-300 text-xs mt-0.5">Severity {card.maxSeverity}/10 · {card.activeCount} active zone{card.activeCount === 1 ? '' : 's'}</p>
                    <p className="text-slate-400 text-xs mt-0.5">Based on {card.verifiedReports} verified report{card.verifiedReports === 1 ? '' : 's'}</p>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div
          onClick={onScanClick}
          className="mt-7 rounded-2xl bg-gray-100 border border-gray-200 p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-200 transition-colors"
        >
          <div className="w-11 h-11 rounded-full bg-indigo-600 text-white flex items-center justify-center">
            <span className="material-icons-round">forum</span>
          </div>
          <div className="flex-1">
            <h4 className="text-gray-900 font-bold text-sm">Join Our Community Discord</h4>
            <p className="text-gray-500 text-xs">Share flood updates & connect with locals on Discord.</p>
          </div>
          <span className="material-icons-round text-gray-400">chevron_right</span>
        </div>
      </main>

      <BottomNav activeTab="alert" onTabChange={onTabChange} />
    </div>
  );
}
