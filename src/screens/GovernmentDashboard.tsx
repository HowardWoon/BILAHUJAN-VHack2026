import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import {
  FloodStatistics,
  InfrastructureInsights,
  LocationAnalytics,
  getFloodStatistics,
  getInfrastructureInsights,
  getLocationAnalytics
} from '../services/governmentAnalytics';
import { rtdb } from '../firebase';
import { addFloodZone, createZone, getFloodZones, reconcileStateSeverity } from '../data/floodZones';
import { fetchLiveWeatherAndCCTV } from '../services/gemini';
import BottomNav from '../components/BottomNav';
import { DataExportPanel } from '../components/DataExportPanel';
import { MissionLogPanel } from '../components/MissionLogPanel';
import { useLiveNodes, useNodeStats } from '../services/nodeDiscovery';
import { SensorNode, SwarmNetworkStats } from '../types/swarm';

interface GovernmentDashboardProps {
  onTabChange: (tab: 'map' | 'report' | 'alert' | 'dashboard') => void;
  onLocationAlertOpen: (state: string, zoneId: string) => void;
}

interface SwarmSectionProps {
  nodes: SensorNode[];
  nodeStats: SwarmNetworkStats;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

type GovMenu = 'overview' | 'command';

const MALAYSIA_STATE_COORDS: Record<string, [number, number]> = {
  Selangor: [3.07, 101.51],
  'Kuala Lumpur': [3.14, 101.69],
  Kelantan: [6.12, 102.23],
  Johor: [1.49, 103.74],
  Penang: [5.35, 100.28],
  Pahang: [3.81, 103.32],
  Sarawak: [1.55, 110.35],
  Sabah: [5.98, 116.07],
  Perak: [4.59, 101.09],
  Kedah: [6.12, 100.36],
  Terengganu: [5.33, 103.15],
  'Negeri Sembilan': [2.72, 101.94],
  Melaka: [2.19, 102.25],
  Perlis: [6.44, 100.2],
  Putrajaya: [2.92, 101.69],
  Labuan: [5.28, 115.24]
};

const MALAYSIA_STATES = Object.keys(MALAYSIA_STATE_COORDS);

const SwarmSection = React.memo(function SwarmSection({ nodes, nodeStats }: SwarmSectionProps) {
  const [selectedNode, setSelectedNode] = useState<SensorNode | null>(null);

  return (
    <section data-purpose="swarm-intelligence-network" className="space-y-5">
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-icons-round text-purple-600 text-xl">satellite_alt</span>
          <h3 className="font-bold text-slate-800 text-lg">Swarm Intelligence Network</h3>
        </div>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">
          Real-time civilian sensor node network — every flood report becomes an active intelligence node in the swarm.
        </p>

        <div className="grid grid-cols-4 gap-2 mb-8">
          <div className="border border-slate-200 rounded-xl p-2 text-center">
            <span className="text-[9px] uppercase font-bold text-slate-400 block leading-tight">Total Nodes</span>
            <span className="material-icons-round text-purple-500 text-xs my-1">hub</span>
            <span className="text-xl font-bold text-slate-800 block">{nodeStats.total}</span>
          </div>
          <div className="border border-slate-200 rounded-xl p-2 text-center">
            <span className="text-[9px] uppercase font-bold text-slate-400 block leading-tight">Active Nodes</span>
            <span className="material-icons-round text-green-500 text-xs my-1">sensors</span>
            <span className="text-xl font-bold text-slate-800 block">{nodeStats.active}</span>
          </div>
          <div className="border border-slate-200 rounded-xl p-2 text-center">
            <span className="text-[9px] uppercase font-bold text-slate-400 block leading-tight">Idle Nodes</span>
            <span className="material-icons-round text-orange-500 text-xs my-1">pause_circle</span>
            <span className="text-xl font-bold text-slate-800 block">{nodeStats.idle}</span>
          </div>
          <div className="border border-slate-200 rounded-xl p-2 text-center">
            <span className="text-[9px] uppercase font-bold text-slate-400 block leading-tight">Avg Severity</span>
            <span className="material-icons-round text-red-500 text-xs my-1">monitoring</span>
            <span className="text-base font-bold text-red-600 block leading-tight mt-1">{nodeStats.avgNetworkSeverity.toFixed(1)}/10</span>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span className="material-icons-round text-blue-500">scatter_plot</span>
              <span className="font-bold text-slate-700 text-sm">Live Sensor Nodes</span>
            </div>
            <span className="text-[10px] text-slate-400">{`${nodeStats.active} active • ${nodeStats.idle} idle • ${nodeStats.offline} offline`}</span>
          </div>

          {nodes.length === 0 ? (
            <div className="flex items-center justify-center h-20 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
              <p className="text-gray-400 text-sm italic">
                No active sensor nodes. Awaiting citizen flood reports.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-lg min-h-16">
              {nodes.map((node) => {
                const dotSize = node.currentSeverity >= 7 ? 'w-8 h-8' : node.currentSeverity >= 4 ? 'w-6 h-6' : 'w-4 h-4';
                const dotColor =
                  node.status === 'active' ? 'bg-green-500' : node.status === 'idle' ? 'bg-yellow-500' : 'bg-red-400';
                const pulse = node.status === 'active' ? 'animate-pulse' : '';
                const ring = selectedNode?.nodeId === node.nodeId ? 'ring-2 ring-blue-500 ring-offset-2' : '';

                return (
                  <div
                    key={node.nodeId}
                    onClick={() => setSelectedNode(selectedNode?.nodeId === node.nodeId ? null : node)}
                    className="relative cursor-pointer group flex flex-col items-center gap-1"
                    title={`${node.nodeId} | ${node.location?.address || 'Unknown'} | Severity: ${node.currentSeverity} | ${node.status}`}
                  >
                    <div className={`rounded-full transition-all hover:scale-125 ${dotSize} ${dotColor} ${pulse} ${ring}`} />
                    <span className="text-[9px] text-gray-500 font-mono opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {node.nodeId}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {selectedNode && (
            <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-blue-800 text-sm">{selectedNode.nodeId}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      selectedNode.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : selectedNode.status === 'idle'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {selectedNode.status.toUpperCase()}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-gray-400 hover:text-gray-600 text-lg font-light leading-none"
                  aria-label="Close node detail"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white rounded-lg p-2">
                  <p className="text-gray-400 mb-0.5">Severity</p>
                  <p
                    className={`font-bold text-lg ${
                      selectedNode.currentSeverity >= 7
                        ? 'text-red-600'
                        : selectedNode.currentSeverity >= 4
                        ? 'text-orange-500'
                        : 'text-green-600'
                    }`}
                  >
                    {selectedNode.currentSeverity}/10
                  </p>
                </div>
                <div className="bg-white rounded-lg p-2">
                  <p className="text-gray-400 mb-0.5">Reports</p>
                  <p className="font-bold text-lg text-gray-800">{selectedNode.reportCount}</p>
                </div>
                <div className="bg-white rounded-lg p-2 col-span-2">
                  <p className="text-gray-400 mb-0.5">Location</p>
                  <p className="font-medium text-gray-800 text-xs leading-snug">
                    {selectedNode.location?.address || 'Unknown Location'}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-2 col-span-2">
                  <p className="text-gray-400 mb-0.5">Last Seen</p>
                  <p className="font-medium text-gray-700 text-xs">
                    {new Date(selectedNode.lastSeen).toLocaleString('en-MY', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>

              {selectedNode.currentSeverity >= 7 && (
                <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2">
                  <span className="text-red-500 text-sm">⚠️</span>
                  <p className="text-red-600 text-xs font-medium">
                    High severity — this node triggered authority dispatch
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </section>
  );
});

export const GovernmentDashboard: FC<GovernmentDashboardProps> = ({ onTabChange, onLocationAlertOpen }) => {
  const [statistics, setStatistics] = useState<FloodStatistics | null>(null);
  const [locationAnalytics, setLocationAnalytics] = useState<LocationAnalytics[]>([]);
  const [infrastructure, setInfrastructure] = useState<InfrastructureInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [refreshStatusMessage, setRefreshStatusMessage] = useState<string | null>(null);
  const [firstLoad, setFirstLoad] = useState(true);
  const [dateRange, setDateRange] = useState(30);
  const [govMenu, setGovMenu] = useState<GovMenu>('overview');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const manualRefreshLockRef = useRef(false);

  const nodes = useLiveNodes();
  const nodeStats = useNodeStats(nodes);

  const refreshLiveStateWeather = useCallback(async (): Promise<{ updated: number; failed: number }> => {
    const batchSize = 6;
    let updated = 0;
    let failed = 0;

    for (let index = 0; index < MALAYSIA_STATES.length; index += batchSize) {
      const batch = MALAYSIA_STATES.slice(index, index + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(async (state) => {
          const liveData = await withTimeout(fetchLiveWeatherAndCCTV(state), 12000, `fetchLiveWeatherAndCCTV:${state}`);
          const [lat, lng] = MALAYSIA_STATE_COORDS[state] ?? [3.14, 101.69];
          const zoneId = `live_${state.toLowerCase().replace(/\s+/g, '_')}`;

          const allCurrentZones = getFloodZones();
          const userZonesForState = Object.values(allCurrentZones).filter(
            (zone) => zone.state === state && zone.id.startsWith('user_reported_')
          );
          const userMaxSeverity = userZonesForState.reduce((max, zone) => Math.max(max, zone.severity), 0);
          const reconciledSeverity = reconcileStateSeverity(
            liveData.severity,
            userMaxSeverity,
            liveData.isRaining,
            userZonesForState.length
          );

          const stateZone = createZone(
            zoneId,
            state,
            `Live Weather: ${liveData.weatherCondition}`,
            state,
            'Live Region',
            lat,
            lng,
            reconciledSeverity,
            liveData.weatherCondition,
            0.05,
            ['Google Weather', 'CCTV Live', 'AI Analysis']
          );

          stateZone.aiAnalysisText = liveData.aiAnalysisText;
          stateZone.eventType = liveData.isRaining ? 'Heavy Rain' : 'Normal';
          addFloodZone(stateZone);
        })
      );

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          updated += 1;
        } else {
          failed += 1;
        }
      });

      if (index + batchSize < MALAYSIA_STATES.length) {
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
    }

    return { updated, failed };
  }, []);

  const loadDashboardData = useCallback(async (options?: { manual?: boolean }) => {
    const manual = options?.manual ?? false;
    if (manual) {
      setIsManualRefreshing(true);
    }

    setLoading(true);

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      const [statsResult, locationsResult, infraResult] = await Promise.allSettled([
        withTimeout(getFloodStatistics(startDate, endDate), 10000, 'getFloodStatistics'),
        withTimeout(getLocationAnalytics(), 10000, 'getLocationAnalytics'),
        withTimeout(getInfrastructureInsights(), 10000, 'getInfrastructureInsights')
      ]);

      if (statsResult.status === 'fulfilled') {
        setStatistics(statsResult.value);
      }
      if (locationsResult.status === 'fulfilled') {
        setLocationAnalytics(locationsResult.value);
      }
      if (infraResult.status === 'fulfilled') {
        setInfrastructure(infraResult.value);
      }

      if (statsResult.status === 'rejected' || locationsResult.status === 'rejected' || infraResult.status === 'rejected') {
        console.warn('Dashboard refresh completed with partial data', {
          statistics: statsResult.status,
          locations: locationsResult.status,
          infrastructure: infraResult.status,
        });
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setLoading(false);
      if (manual) {
        setIsManualRefreshing(false);
      }
      if (firstLoad) {
        setFirstLoad(false);
      }
    }
  }, [dateRange, firstLoad]);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, [loadDashboardData]);

  useEffect(() => {
    const zonesRef = ref(rtdb, 'liveZones');
    let debounceTimer: ReturnType<typeof setTimeout>;

    const unsubscribe = onValue(zonesRef, () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadDashboardData();
      }, 2000);
    });

    return () => {
      unsubscribe();
      clearTimeout(debounceTimer);
    };
  }, [loadDashboardData]);

  const displayDrainageEfficiency = useMemo(() => {
    if ((infrastructure?.drainageEfficiency ?? 0) > 0) {
      return infrastructure?.drainageEfficiency ?? 0;
    }

    if (locationAnalytics.length === 0) {
      return 0;
    }

    const avgDrainageBlockage =
      locationAnalytics.reduce((sum, location) => sum + (location.avgDrainageBlockage || 0), 0) /
      locationAnalytics.length;

    return Math.max(0, Math.round(100 - avgDrainageBlockage));
  }, [infrastructure, locationAnalytics]);

  const locationTable = useMemo(
    () =>
      locationAnalytics.map((loc, index) => {
        const sev = loc.avgSeverity;
        const barColor = sev >= 7 ? 'bg-red-500' : sev >= 4 ? 'bg-amber-400' : 'bg-emerald-400';
        const cleanedLocation = loc.location
          .replace(/^live\s*weather\s*:?\s*/i, '')
          .replace(/\s+/g, ' ')
          .trim();
        const escapedState = loc.state.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const locationWithoutState = cleanedLocation
          .replace(new RegExp(`(?:,?\\s*${escapedState})$`, 'i'), '')
          .replace(/\s+/g, ' ')
          .replace(/^,\s*|,\s*$/g, '')
          .trim();
        const hotspotLabel =
          locationWithoutState && locationWithoutState.toLowerCase() !== loc.state.trim().toLowerCase()
            ? locationWithoutState
            : null;

        return (
          <div
            key={`${loc.state}-${index}`}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 hover:bg-slate-50/70 hover:border-slate-200 transition-all"
          >
            <span className="text-xs font-bold text-slate-300 w-4 text-center shrink-0 tabular-nums">{index + 1}</span>
            <div className={`w-1 h-8 rounded-full ${barColor} shrink-0`} />
            <div className="flex-1 min-w-0">
              {hotspotLabel ? (
                <button
                  type="button"
                  onClick={() => onLocationAlertOpen(loc.state, loc.alertZoneId || '')}
                  className="text-sm font-semibold leading-5 text-blue-600 hover:text-blue-700 hover:underline text-left whitespace-normal break-words"
                  title={`Open AI analysis for ${hotspotLabel} in ${loc.state}`}
                >
                  {hotspotLabel}
                </button>
              ) : (
                <p className="text-sm font-semibold leading-5 text-slate-300">—</p>
              )}
              <p className="text-xs text-slate-400 leading-4 whitespace-normal break-words">{loc.state}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="flex gap-3">
                <div className="w-14 flex flex-col items-center gap-0.5">
                  <span className="text-base font-black text-slate-800 leading-none tabular-nums">{loc.incidentCount}</span>
                  <span className="text-[9px] text-slate-400 uppercase tracking-wide">incidents</span>
                </div>
                <div className="w-14 flex flex-col items-center gap-0.5">
                  <span className={`text-base font-black leading-none tabular-nums ${
                    sev >= 7 ? 'text-red-600' : sev >= 4 ? 'text-amber-600' : 'text-emerald-600'
                  }`}>{sev.toFixed(1)}</span>
                  <span className="text-[9px] text-slate-400 uppercase tracking-wide">severity</span>
                </div>
              </div>
            </div>
          </div>
        );
      }),
    [locationAnalytics, onLocationAlertOpen]
  );

  const handleManualRefresh = useCallback(() => {
    if (isManualRefreshing || manualRefreshLockRef.current) {
      return;
    }

    manualRefreshLockRef.current = true;
    setIsManualRefreshing(true);
    setRefreshStatusMessage('Refreshing live weather across Malaysia...');

    void (async () => {
      let result: { updated: number; failed: number } | null = null;

      try {
        result = await refreshLiveStateWeather();
      } catch (error) {
        console.warn('Live weather refresh failed before dashboard analytics refresh', error);
      }

      try {
        setRefreshStatusMessage('Recalculating analytics...');
        await loadDashboardData();

        if (result && result.updated > 0) {
          setRefreshStatusMessage(`Updated ${result.updated} states${result.failed > 0 ? ` (${result.failed} failed)` : ''}.`);
        } else if (result && result.failed > 0) {
          setRefreshStatusMessage('Live refresh failed. Showing cached analytics.');
        } else {
          setRefreshStatusMessage('Analytics refreshed.');
        }
      } finally {
        setIsManualRefreshing(false);
        window.setTimeout(() => {
          manualRefreshLockRef.current = false;
        }, 150);
        window.setTimeout(() => {
          setRefreshStatusMessage(null);
        }, 3500);
      }
    })();
  }, [isManualRefreshing, loadDashboardData, refreshLiveStateWeather]);

  const refreshStatusTone = useMemo(() => {
    const status = (refreshStatusMessage || '').toLowerCase();
    if (!status) return 'neutral';
    if (status.includes('failed') || status.includes('cached')) return 'warning';
    if (status.includes('updated') || status.includes('refreshed')) return 'success';
    return 'neutral';
  }, [refreshStatusMessage]);

  if (firstLoad && loading) {
    return (
      <div className="h-full bg-gray-50 pb-32 overflow-y-auto">
        <div className="flex items-center justify-center h-full bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Loading Analytics...</p>
          </div>
        </div>
        <BottomNav activeTab="dashboard" onTabChange={onTabChange} />
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 overflow-y-auto">
      <div className="max-w-[480px] mx-auto bg-white min-h-full shadow-[0_0_50px_rgba(0,0,0,0.08)] relative pb-32">
        <header
          className="relative overflow-hidden p-6 pb-14 rounded-b-[3rem] shadow-2xl"
          style={{ background: 'radial-gradient(circle at top right, #1e40af, #0f172a)' }}
        >
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}
          />
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                <span className="material-icons-round text-blue-400 text-sm">verified_user</span>
                <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-blue-100">Government Secured</span>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-inner">
              <h1 className="text-4xl font-black leading-tight mb-3 tracking-tighter text-white">
                <span className="tracking-[0.15em] text-blue-400 block text-xs mb-1 font-bold">PLATFORM</span>
                BILAHUJAN
              </h1>
              <div className="h-1 w-12 bg-blue-500 rounded-full mb-4" />
              <p className="text-blue-100 text-sm font-medium leading-relaxed opacity-90">
                Real-time Flood Monitoring Analytics
                <br />
                <span className="text-blue-300 font-bold">JPS • NADMA • APM</span>
              </p>

              {lastUpdated && (
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-blue-200 text-xs">Updated {lastUpdated.toLocaleTimeString()}</span>
                </div>
              )}
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        </header>

        <section className="px-6 -mt-8 relative z-30 pointer-events-auto">
          <div className="bg-white rounded-2xl shadow-lg p-4 border border-slate-100 relative z-30 pointer-events-auto">
            <div className="space-y-3 relative z-30 pointer-events-auto">
              <div className="min-w-0">
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Time Range</label>
                <select
                  value={dateRange}
                  onChange={(event) => setDateRange(Number(event.target.value))}
                  className="block h-11 w-full text-sm text-slate-800 border border-slate-200 bg-slate-50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-200 px-3 appearance-none"
                >
                  <option value={30}>Last 30 Days</option>
                  <option value={7}>Last 7 Days</option>
                  <option value={1}>Last 24 Hours</option>
                  <option value={90}>Last 90 Days</option>
                  <option value={365}>Last Year</option>
                </select>
              </div>
              <button
                type="button"
                aria-label="Refresh dashboard data"
                onClick={handleManualRefresh}
                onTouchEnd={handleManualRefresh}
                disabled={isManualRefreshing}
                className={`w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-bold inline-flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:cursor-not-allowed whitespace-nowrap relative z-40 pointer-events-auto touch-manipulation ${
                  isManualRefreshing ? 'h-10 px-3 text-xs' : 'h-11 px-4 text-sm'
                }`}
              >
                {isManualRefreshing ? (
                  <span className="material-icons-round text-sm animate-spin">progress_activity</span>
                ) : (
                  <span className="material-icons-round text-sm">sync</span>
                )}
                {isManualRefreshing ? 'Refreshing...' : 'Refresh Data'}
              </button>
            </div>
          </div>

          {isManualRefreshing && (
            <div className="mt-3 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                  <span className="material-icons-round text-[17px] animate-spin">autorenew</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-blue-800">Syncing latest flood intelligence</p>
                  <p className="text-[11px] text-blue-700/90 truncate">{refreshStatusMessage || 'Refreshing live weather data across all states...'}</p>
                </div>
              </div>
            </div>
          )}

          {!isManualRefreshing && refreshStatusMessage && (
            <div
              className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 shadow-sm border ${
                refreshStatusTone === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : refreshStatusTone === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              <span className="material-icons-round text-[14px]">
                {refreshStatusTone === 'success' ? 'check_circle' : refreshStatusTone === 'warning' ? 'warning' : 'info'}
              </span>
              <span className="text-[11px] font-semibold">{refreshStatusMessage}</span>
            </div>
          )}

          <div className="mt-3 bg-white rounded-2xl shadow-sm border border-slate-100 p-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGovMenu('overview')}
                className={`h-10 rounded-xl text-xs font-bold transition-all inline-flex items-center justify-center gap-2 ${
                  govMenu === 'overview'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="material-icons-round text-sm">dashboard</span>
                Overview
              </button>
              <button
                type="button"
                onClick={() => setGovMenu('command')}
                className={`h-10 rounded-xl text-xs font-bold transition-all inline-flex items-center justify-center gap-2 ${
                  govMenu === 'command'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="material-icons-round text-sm">smart_toy</span>
                Command Agent
              </button>
            </div>
          </div>
        </section>

        <main className={govMenu === 'command' ? 'p-4 pt-5 space-y-4' : 'p-6 space-y-8'}>
          {govMenu === 'overview' ? (
            <>
          <section className="grid grid-cols-2 gap-4">
            <div className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center transition-all ${isManualRefreshing ? 'ring-1 ring-blue-100' : ''}`}>
              <span className="text-slate-500 text-xs font-medium mb-1">Total Incidents</span>
              <span className="material-icons-round text-red-500 text-xl mb-2">warning</span>
              <span className="text-3xl font-bold text-slate-800">{statistics?.totalIncidents || 0}</span>
            </div>
            <div className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center transition-all ${isManualRefreshing ? 'ring-1 ring-blue-100' : ''}`}>
              <span className="text-slate-500 text-xs font-medium mb-1">Avg Severity</span>
              <span className="material-icons-round text-orange-500 text-xl mb-2">trending_up</span>
              <span className="text-3xl font-bold text-slate-800">
                {`${statistics?.averageSeverity.toFixed(1) || '0.0'}`}
                <span className="text-sm text-slate-400">/10</span>
              </span>
            </div>
            <div className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center transition-all ${isManualRefreshing ? 'ring-1 ring-blue-100' : ''}`}>
              <span className="text-slate-500 text-xs font-medium mb-1">Affected Areas</span>
              <span className="material-icons-round text-blue-500 text-xl mb-2">location_on</span>
              <span className="text-3xl font-bold text-slate-800">{statistics?.affectedAreas || 0}</span>
            </div>
            <div className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center transition-all ${isManualRefreshing ? 'ring-1 ring-blue-100' : ''}`}>
              <span className="text-slate-500 text-xs font-medium mb-1">Drainage Eff.</span>
              <span className="material-icons-round text-teal-500 text-xl mb-2">water_drop</span>
              <span className="text-3xl font-bold text-slate-800">{`${displayDrainageEfficiency}%`}</span>
            </div>
          </section>

          <section>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-red-50 p-2 rounded-lg">
                  <span className="material-icons-round text-red-600">location_city</span>
                </div>
                <h3 className="font-bold text-slate-800">Most Affected Region</h3>
              </div>
              <p className="text-2xl font-bold text-slate-900">{statistics?.mostAffectedRegion || 'N/A'}</p>
            </div>
          </section>

          <section>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                  <span className="material-icons-round">bar_chart</span>
                </div>
                <h3 className="font-bold text-slate-800">Location Analytics</h3>
              </div>
              <div className="flex items-center gap-3 px-3 mb-2">
                <span className="w-4 shrink-0" />
                <span className="w-1 shrink-0" />
                <span className="flex-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Location · State</span>
                <div className="flex gap-3 shrink-0">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-14 text-center">Incidents</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-14 text-center">Severity</span>
                </div>
              </div>
              <div className="space-y-1.5">{locationTable}</div>
            </div>
          </section>

          <section>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-icons-round text-orange-500 text-lg">engineering</span>
                <h3 className="font-bold text-slate-800">Infrastructure Insights</h3>
              </div>

              <div className="mb-5">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-bold text-slate-700 uppercase">Drainage Efficiency</p>
                  <p className="text-sm font-bold text-teal-600">{infrastructure?.drainageEfficiency ?? 0}%</p>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full bg-teal-500 transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, infrastructure?.drainageEfficiency ?? 0))}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 mb-5">
                <div>
                  <p className="text-xs font-bold text-slate-700 uppercase mb-2">Critical Zones</p>
                  {infrastructure?.criticalZones?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {infrastructure.criticalZones.map((zone, index) => (
                        <span key={`${zone}-${index}`} className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-semibold">
                          {zone}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 italic">No critical zones</p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-700 uppercase mb-2">Maintenance Needed</p>
                  {infrastructure?.maintenanceNeeded?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {infrastructure.maintenanceNeeded.map((zone, index) => (
                        <span key={`${zone}-${index}`} className="px-2 py-1 rounded bg-orange-100 text-orange-700 text-xs font-semibold">
                          {zone}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">All systems operational</p>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                <span className="text-blue-700 font-bold text-sm">
                  Average Response Time: <span className="font-medium">{Math.max(1, infrastructure?.responseTime ?? 15)} minutes</span>
                </span>
              </div>
            </div>
          </section>

          <SwarmSection nodes={nodes} nodeStats={nodeStats} />

          <DataExportPanel />

            </>
          ) : (
            <>
              <section>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-green-100 p-3 rounded-xl text-green-600 flex-shrink-0">
                      <span className="material-icons-round text-xl">smart_toy</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg leading-tight">Autonomous Command Agent</h3>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Powered by Gemini AI • MCP Tool Architecture</p>
                    </div>
                  </div>

                  <MissionLogPanel className="min-h-[78vh]" />
                </div>
              </section>
            </>
          )}

          {govMenu === 'overview' && (
            <footer className="text-center py-2 px-2">
              <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Copyright © 2026 FEI. Developed for V Hack 2026 - USM.</p>
              <div className="w-24 h-1 bg-slate-200 rounded-full mx-auto mt-4" />
            </footer>
          )}
        </main>
      </div>

      <BottomNav activeTab="dashboard" onTabChange={onTabChange} />
    </div>
  );
};
