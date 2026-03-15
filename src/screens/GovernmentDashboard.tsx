import React, { useEffect, useState, FC, useMemo } from 'react';
import {
  FloodStatistics,
  LocationAnalytics,
  InfrastructureInsights,
  getFloodStatistics,
  getLocationAnalytics,
  getInfrastructureInsights
} from '../services/governmentAnalytics';
import { DataExportPanel } from '../components/DataExportPanel';
import MissionLogPanel from '../components/MissionLogPanel';
import BottomNav from '../components/BottomNav';
import { useLiveNodes, useNodeStats } from '../services/nodeDiscovery';
import { SensorNode, SwarmNetworkStats } from '../types/swarm';

interface GovernmentDashboardProps {
  onTabChange: (tab: 'map' | 'report' | 'alert' | 'dashboard') => void;
}

interface SwarmSectionProps {
  nodes: SensorNode[];
  nodeStats: SwarmNetworkStats;
}

const SwarmSection = React.memo(function SwarmSection({ nodes, nodeStats }: SwarmSectionProps) {
  const [selectedNode, setSelectedNode] = useState<SensorNode | null>(null);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">🛰️ Swarm Intelligence Network</h2>
      <p className="text-gray-500 text-sm mb-6">
        Real-time civilian sensor node network — every flood report becomes an active intelligence node in the swarm.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs mb-1">Total Nodes</p>
              <p className="text-3xl font-bold text-gray-800">{nodeStats.total}</p>
            </div>
            <span className="material-icons-round text-4xl text-purple-500">hub</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs mb-1">Active Nodes</p>
              <p className="text-3xl font-bold text-green-600">{nodeStats.active}</p>
            </div>
            <span className="material-icons-round text-4xl text-green-500">sensors</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs mb-1">Idle Nodes</p>
              <p className="text-3xl font-bold text-yellow-600">{nodeStats.idle}</p>
            </div>
            <span className="material-icons-round text-4xl text-yellow-500">pause_circle</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs mb-1">Avg Severity</p>
              <p className="text-3xl font-bold text-red-600">{nodeStats.avgNetworkSeverity.toFixed(1)}/10</p>
            </div>
            <span className="material-icons-round text-4xl text-red-500">monitoring</span>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="material-icons-round text-blue-500 text-base">scatter_plot</span>
          Live Sensor Nodes
          <span className="ml-auto text-xs text-gray-400">Click a node to inspect</span>
        </h3>

        {nodes.length === 0 ? (
          <div className="flex items-center justify-center h-24 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <p className="text-gray-400 italic text-sm">No active sensor nodes. Awaiting citizen flood reports.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg min-h-24">
            {nodes.map((node) => {
              const sizeClass = node.currentSeverity >= 7 ? 'w-8 h-8' : node.currentSeverity >= 4 ? 'w-6 h-6' : 'w-4 h-4';
              const colorClass =
                node.status === 'active' ? 'bg-green-500' : node.status === 'idle' ? 'bg-yellow-500' : 'bg-red-500';
              const pulseClass = node.status === 'active' ? 'animate-pulse' : '';
              const ringClass = selectedNode?.nodeId === node.nodeId ? 'ring-2 ring-blue-500 ring-offset-2' : '';

              return (
                <div
                  key={node.nodeId}
                  onClick={() => setSelectedNode(selectedNode?.nodeId === node.nodeId ? null : node)}
                  className="relative cursor-pointer group flex flex-col items-center"
                  title={`${node.nodeId} | ${node.location.address} | Severity: ${node.currentSeverity} | ${node.status}`}
                >
                  <div
                    className={`rounded-full transition-all hover:scale-125 ${sizeClass} ${colorClass} ${pulseClass} ${ringClass}`}
                  />
                  <span className="mt-1 text-[9px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {node.nodeId}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedNode && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-blue-800 flex items-center gap-2">
              <span className="material-icons-round text-sm">sensors</span>
              {selectedNode.nodeId}
            </h4>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-blue-600 hover:text-blue-900 text-sm font-medium"
            >
              ✕ Close
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-blue-600 font-medium">Status: </span>
              <span
                className={`px-1.5 py-0.5 rounded text-xs font-bold ${
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
            <div>
              <span className="text-blue-600 font-medium">Severity: </span>
              <span className="font-bold">{selectedNode.currentSeverity}/10</span>
            </div>
            <div className="col-span-2">
              <span className="text-blue-600 font-medium">Location: </span>
              {selectedNode.location.address}
            </div>
            <div>
              <span className="text-blue-600 font-medium">Last Seen: </span>
              {new Date(selectedNode.lastSeen).toLocaleString()}
            </div>
            <div>
              <span className="text-blue-600 font-medium">Reports: </span>
              {selectedNode.reportCount}
            </div>
            <div>
              <span className="text-blue-600 font-medium">Avg Severity: </span>
              {selectedNode.avgSeverity.toFixed(1)}/10
            </div>
            <div>
              <span className="text-blue-600 font-medium">Node ID: </span>
              <span className="font-mono">{selectedNode.nodeId}</span>
            </div>
          </div>
        </div>
      )}

      <div>
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="material-icons-round text-green-600 text-base">smart_toy</span>
          Autonomous Command Agent
          <span className="ml-2 text-xs text-gray-400 font-normal">— Powered by Gemini AI · MCP Tool Architecture</span>
        </h3>
        <MissionLogPanel className="w-full" />
      </div>
    </div>
  );
});

export const GovernmentDashboard: FC<GovernmentDashboardProps> = ({ onTabChange }) => {
  const [statistics, setStatistics] = useState<FloodStatistics | null>(null);
  const [locationAnalytics, setLocationAnalytics] = useState<LocationAnalytics[]>([]);
  const [infrastructure, setInfrastructure] = useState<InfrastructureInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [dateRange, setDateRange] = useState(30);

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
      locationAnalytics.slice(0, 10).map((loc, idx) => (
        <tr key={idx} className="hover:bg-gray-50">
          <td className="px-4 py-3 text-sm text-gray-800 font-medium">{loc.location}</td>
          <td className="px-4 py-3 text-sm text-gray-600">{loc.state}</td>
          <td className="px-4 py-3 text-sm text-center">{loc.incidentCount}</td>
          <td className="px-4 py-3 text-sm text-center">
            <span
              className={`font-semibold ${
                loc.avgSeverity >= 7 ? 'text-red-600' : loc.avgSeverity >= 4 ? 'text-orange-600' : 'text-green-600'
              }`}
            >
              {loc.avgSeverity.toFixed(1)}
            </span>
          </td>
          <td className="px-4 py-3 text-sm text-center">{loc.avgWaterLevel.toFixed(0)}cm</td>
          <td className="px-4 py-3 text-sm text-center">{loc.avgDrainageBlockage.toFixed(0)}%</td>
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
    <div className="h-full bg-gray-50 pb-32 overflow-y-auto">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6 shadow-lg">
        <h1 className="text-3xl font-bold mb-2">BILAHUJAN Government Dashboard</h1>
        <p className="text-blue-100">Real-time Flood Monitoring Analytics for JPS, NADMA & APM</p>
      </div>

      <div className="bg-white shadow-sm p-4 mb-6 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-4">
          <label className="font-medium text-gray-700">Time Range:</label>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
            <option value={365}>Last Year</option>
          </select>

          <button
            onClick={loadDashboardData}
            className="ml-auto bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            {loading && !firstLoad ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <span className="material-icons-round text-sm">refresh</span>
            )}
            Refresh Data
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-1">Total Incidents</p>
                <p className="text-3xl font-bold text-gray-800">
                  {loading && !firstLoad ? <span className="text-gray-300">--</span> : statistics?.totalIncidents || 0}
                </p>
              </div>
              <span className="material-icons-round text-5xl text-red-500">warning</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-1">Avg Severity</p>
                <p className="text-3xl font-bold text-gray-800">
                  {loading && !firstLoad ? (
                    <span className="text-gray-300">--</span>
                  ) : (
                    `${statistics?.averageSeverity.toFixed(1) || '0.0'}/10`
                  )}
                </p>
              </div>
              <span className="material-icons-round text-5xl text-orange-500">speed</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-1">Affected Areas</p>
                <p className="text-3xl font-bold text-gray-800">
                  {loading && !firstLoad ? <span className="text-gray-300">--</span> : statistics?.affectedAreas || 0}
                </p>
              </div>
              <span className="material-icons-round text-5xl text-blue-500">place</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm mb-1">Drainage Efficiency</p>
                <p className="text-3xl font-bold text-gray-800">
                  {loading && !firstLoad ? (
                    <span className="text-gray-300">--</span>
                  ) : (
                    `${displayDrainageEfficiency ?? 0}%`
                  )}
                </p>
              </div>
              <span className="material-icons-round text-5xl text-green-500">water_drop</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
            <span className="material-icons-round text-red-500">location_city</span>
            Most Affected Region
          </h2>
          <p className="text-2xl font-semibold text-gray-700">{displayMostAffectedRegion}</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="material-icons-round text-blue-500">analytics</span>
            Location Analytics
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Location</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">State</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Incidents</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Avg Severity</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Water Level</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Drainage</th>
                </tr>
              </thead>
              <tbody>{locationTable}</tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="material-icons-round text-yellow-500">engineering</span>
            Infrastructure Insights
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Critical Zones</h3>
              {infrastructure?.criticalZones.length ? (
                <ul className="space-y-1">
                  {infrastructure.criticalZones.map((zone, idx) => (
                    <li key={idx} className="text-red-600 flex items-center gap-2">
                      <span className="material-icons-round text-sm">error</span>
                      {zone}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 italic">No critical zones</p>
              )}
            </div>

            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Maintenance Needed</h3>
              {infrastructure?.maintenanceNeeded.length ? (
                <ul className="space-y-1">
                  {infrastructure.maintenanceNeeded.map((zone, idx) => (
                    <li key={idx} className="text-orange-600 flex items-center gap-2">
                      <span className="material-icons-round text-sm">build</span>
                      {zone}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 italic">All systems operational</p>
              )}
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Average Response Time:</strong> {infrastructure?.responseTime ?? 0} minutes
            </p>
          </div>
        </div>

        <SwarmSection nodes={nodes} nodeStats={nodeStats} />

        <DataExportPanel />
      </div>

      <BottomNav activeTab="dashboard" onTabChange={onTabChange} />
    </div>
  );
};
