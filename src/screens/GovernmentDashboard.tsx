import React, { useEffect, useState, FC, useMemo, useRef } from 'react';
import {
  FloodStatistics,
  LocationAnalytics,
  InfrastructureInsights,
  getFloodStatistics,
  getLocationAnalytics,
  getInfrastructureInsights
} from '../services/governmentAnalytics';
import { DataExportPanel } from '../components/DataExportPanel';
import BottomNav from '../components/BottomNav';
import { useLiveNodes, useNodeStats } from '../services/nodeDiscovery';
import { SensorNode, SwarmNetworkStats } from '../types/swarm';
import { MissionLogPanel } from '../components/MissionLogPanel';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase';

interface GovernmentDashboardProps {
  onTabChange: (tab: 'map' | 'report' | 'alert' | 'dashboard') => void;
}

interface SwarmSectionProps {
  nodes: SensorNode[];
  nodeStats: SwarmNetworkStats;
}

const SwarmSection = React.memo(function SwarmSection({ nodes, nodeStats }: SwarmSectionProps) {
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
            <span className="text-[10px] text-slate-400">Click a node to inspect</span>
          </div>

          <div className="border-2 border-dashed border-slate-100 rounded-xl p-8 text-center bg-slate-50/50">
            <p className="text-slate-400 text-xs italic">
              {nodes.length === 0 ? 'No active sensor nodes. Awaiting citizen flood reports.' : `${nodes.length} sensor nodes currently active.`}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-green-100 p-3 rounded-xl text-green-600 flex-shrink-0">
            <span className="material-icons-round text-xl">smart_toy</span>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-lg leading-tight">Autonomous Command Agent</h3>
            <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Powered by Gemini AI • MCP Tool Architecture</p>
          </div>
        </div>

        <MissionLogPanel />
      </div>
    </section>
  );
});

export const GovernmentDashboard: FC<GovernmentDashboardProps> = ({ onTabChange }) => {
  const [statistics, setStatistics] = useState<FloodStatistics | null>(null);
  const [locationAnalytics, setLocationAnalytics] = useState<LocationAnalytics[]>([]);
  const [infrastructure, setInfrastructure] = useState<InfrastructureInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [dateRange, setDateRange] = useState(30);
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nodes = useLiveNodes();
  const nodeStats = useNodeStats(nodes);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDashboardData();
    }, 500);
    return () => clearTimeout(timer);
  }, [dateRange]);

  const loadDashboardData = async () => {
    setLoading(true);
    let loadedSomething = false;

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      try {
        const stats = await getFloodStatistics(startDate, endDate);
        setStatistics(stats);
        loadedSomething = true;
      } catch (error) {
        console.error('Failed loading flood statistics:', error);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      try {
        const locations = await getLocationAnalytics();
        setLocationAnalytics(locations);
        loadedSomething = true;
      } catch (error) {
        console.error('Failed loading location analytics:', error);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      try {
        const infra = await getInfrastructureInsights();
        setInfrastructure(infra);
        loadedSomething = true;
      } catch (error) {
        console.error('Failed loading infrastructure insights:', error);
      }
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setLoading(false);
      if (firstLoad && loadedSomething) {
        setFirstLoad(false);
      } else if (firstLoad) {
        setFirstLoad(false);
      }
    }
  };

  useEffect(() => {
    const zonesRef = ref(rtdb, 'liveZones');
    const unsubscribe = onValue(zonesRef, () => {
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current);
      }
      refreshDebounceRef.current = setTimeout(() => {
        loadDashboardData();
      }, 2000);
    });

    return () => {
      unsubscribe();
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current);
      }
    };
  }, []);

  const displayDrainageEfficiency = useMemo(() => {
    if (loading && !firstLoad) return null;
    if ((infrastructure?.drainageEfficiency ?? 0) > 0) {
      return infrastructure?.drainageEfficiency ?? 0;
    }
    if (locationAnalytics.length === 0) {
      return 0;
    }
    const avgDrainageBlockage =
      locationAnalytics.reduce((sum, location) => sum + (location.avgDrainageBlockage || 0), 0) / locationAnalytics.length;
    return Math.max(0, Math.round(100 - avgDrainageBlockage));
  }, [infrastructure, locationAnalytics, loading, firstLoad]);

  const displayMostAffectedRegion = useMemo(() => {
    if (loading && !firstLoad) return '--';
    const raw = statistics?.mostAffectedRegion?.trim();
    if (raw && raw !== 'Live Region' && raw !== 'N/A') {
      return raw;
    }
    if (locationAnalytics.length === 0) {
      return 'N/A';
    }
    const bestLocation = [...locationAnalytics].sort((left, right) => {
      if (right.avgSeverity !== left.avgSeverity) {
        return right.avgSeverity - left.avgSeverity;
      }
      return right.incidentCount - left.incidentCount;
    })[0];
    return bestLocation?.state || bestLocation?.location || 'N/A';
  }, [statistics, locationAnalytics, loading, firstLoad]);

  const locationTable = useMemo(
    () =>
      locationAnalytics.map((loc, idx) => (
        <tr key={idx}>
          <td className="py-3 px-3 text-slate-400">{loc.location === '—' ? '—' : loc.location}</td>
          <td className="py-3 px-3 font-medium text-slate-700">{loc.state}</td>
          <td className="py-3 px-3 text-right font-bold text-slate-800">{loc.incidentCount}</td>
        </tr>
      )),
    [locationAnalytics]
  );

  if (firstLoad && loading) {
    return (
      <div className="h-full bg-gray-50 pb-32 overflow-y-auto">
        <div className="flex items-center justify-center h-full bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
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
        <header className="relative overflow-hidden p-6 pb-14 rounded-b-[3rem] shadow-2xl" style={{ background: 'radial-gradient(circle at top right, #1e40af, #0f172a)' }}>
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
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
              <div className="h-1 w-12 bg-blue-500 rounded-full mb-4"></div>
              <p className="text-blue-100 text-sm font-medium leading-relaxed opacity-90">
                Real-time Flood Monitoring Analytics
                <br />
                <span className="text-blue-300 font-bold">JPS • NADMA • APM</span>
              </p>
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-600/20 rounded-full blur-3xl"></div>
        </header>

        <section className="px-6 -mt-8 relative z-20">
          <div className="bg-white rounded-2xl shadow-lg p-4 flex flex-col sm:flex-row sm:items-end gap-4 border border-slate-100">
            <div className="w-full sm:flex-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Time Range</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(Number(e.target.value))}
                className="block w-full text-sm border-none bg-slate-50 rounded-lg focus:ring-2 focus:ring-blue-500 py-2"
              >
                <option value={30}>Last 30 Days</option>
                <option value={7}>Last 7 Days</option>
                <option value={1}>Last 24 Hours</option>
                <option value={90}>Last 90 Days</option>
                <option value={365}>Last Year</option>
              </select>
            </div>
            <button
              onClick={loadDashboardData}
              className="w-full sm:w-auto sm:min-w-[150px] bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
            >
              {loading && !firstLoad ? (
                <span className="material-icons-round text-sm animate-spin">progress_activity</span>
              ) : (
                <span className="material-icons-round text-sm">sync</span>
              )}
              Refresh Data
            </button>
          </div>
        </section>

        <main className="p-6 space-y-8">
          <section className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
              <span className="text-slate-500 text-xs font-medium mb-1">Total Incidents</span>
              <span className="material-icons-round text-red-500 text-xl mb-2">warning</span>
              <span className="text-3xl font-bold text-slate-800">{loading && !firstLoad ? '--' : statistics?.totalIncidents || 0}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
              <span className="text-slate-500 text-xs font-medium mb-1">Avg Severity</span>
              <span className="material-icons-round text-orange-500 text-xl mb-2">trending_up</span>
              <span className="text-3xl font-bold text-slate-800">{loading && !firstLoad ? '--' : `${statistics?.averageSeverity.toFixed(1) || '0.0'}`}<span className="text-sm text-slate-400">/10</span></span>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
              <span className="text-slate-500 text-xs font-medium mb-1">Affected Areas</span>
              <span className="material-icons-round text-blue-500 text-xl mb-2">location_on</span>
              <span className="text-3xl font-bold text-slate-800">{loading && !firstLoad ? '--' : statistics?.affectedAreas || 0}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
              <span className="text-slate-500 text-xs font-medium mb-1">Drainage Eff.</span>
              <span className="material-icons-round text-teal-500 text-xl mb-2">water_drop</span>
              <span className="text-3xl font-bold text-slate-800">{loading && !firstLoad ? '--' : `${displayDrainageEfficiency ?? 0}%`}</span>
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
              <p className="text-2xl font-bold text-slate-900">{displayMostAffectedRegion}</p>
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
              <p className="text-[11px] text-slate-400 mb-4">Showing all 16 Malaysia states and federal territories (16/16).</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      <th className="py-2 px-3 font-semibold rounded-l-lg">Top Hotspot</th>
                      <th className="py-2 px-3 font-semibold">State</th>
                      <th className="py-2 px-3 font-semibold text-right rounded-r-lg">Incidents</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">{locationTable}</tbody>
                </table>
              </div>
            </div>
          </section>

          <section>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-icons-round text-orange-500 text-lg">engineering</span>
                <h3 className="font-bold text-slate-800">Infrastructure Insights</h3>
              </div>
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <p className="text-xs font-bold text-slate-700 uppercase mb-2">Critical Zones</p>
                  {infrastructure?.criticalZones.length ? (
                    <p className="text-xs text-slate-600">{infrastructure.criticalZones.slice(0, 3).join(', ')}</p>
                  ) : (
                    <p className="text-sm text-slate-400 italic">No critical zones</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-700 uppercase mb-2">Maintenance Needed</p>
                  {infrastructure?.maintenanceNeeded.length ? (
                    <p className="text-xs text-slate-600">{infrastructure.maintenanceNeeded.slice(0, 3).join(', ')}</p>
                  ) : (
                    <p className="text-xs text-slate-500 italic">All systems operational</p>
                  )}
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                <span className="text-blue-700 font-bold text-sm">Average Response Time: <span className="font-medium">{infrastructure?.responseTime ?? 0} minutes</span></span>
              </div>
            </div>
          </section>

          <SwarmSection nodes={nodes} nodeStats={nodeStats} />

          <DataExportPanel />

          <footer className="text-center py-2 px-2">
            <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Copyright © 2026 FEI. Developed for V Hack 2026 - USM.</p>
            <div className="w-24 h-1 bg-slate-200 rounded-full mx-auto mt-4"></div>
          </footer>
        </main>
      </div>

      <BottomNav activeTab="dashboard" onTabChange={onTabChange} />
    </div>
  );
};
