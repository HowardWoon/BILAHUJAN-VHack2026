import { analyzeFloodImage } from '../services/gemini';
import { rtdb } from '../firebase';
import { ref, get, set, update } from 'firebase/database';
import { MCPTool, MCPToolResult } from '../types/swarm';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

const buildResult = (
  toolName: string,
  success: boolean,
  output: any,
  error?: string
): MCPToolResult => ({
  toolName,
  success,
  output,
  error,
  executedAt: new Date().toISOString()
});

const normalizeSeverity = (value: any): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(10, value));
  }
  return 0;
};

const toTimestampMs = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }

  if (typeof value === 'string') {
    if (/^\d+$/.test(value.trim())) {
      const numeric = Number(value.trim());
      if (Number.isFinite(numeric)) {
        return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
      }
    }

    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  if (value && typeof value === 'object') {
    const maybeSeconds = (value as any).seconds;
    if (typeof maybeSeconds === 'number' && Number.isFinite(maybeSeconds)) {
      return maybeSeconds * 1000;
    }
  }

  return 0;
};

export const toolRegistry: MCPTool[] = [
  {
    name: 'scan_flood_zone',
    description:
      'Analyzes flood image for a zone using Gemini AI vision, returns 16-field structured flood assessment including severity, depth, hazards, and passability',
    inputSchema: {
      zoneId: 'string',
      imageBase64: 'string'
    },
    execute: async (input: { zoneId: string; imageBase64: string }) => {
      const toolName = 'scan_flood_zone';
      try {
        const { zoneId, imageBase64 } = input || {};
        if (!zoneId || !imageBase64) {
          return buildResult(toolName, false, null, 'zoneId and imageBase64 are required');
        }

        const analysis = await analyzeFloodImage(imageBase64, 'image/jpeg');

        try {
          await update(ref(rtdb, `liveZones/${zoneId}`), {
            ...analysis,
            lastUpdated: new Date().toISOString()
          });
        } catch (writeError: any) {
          return buildResult(toolName, false, null, writeError?.message || 'Failed updating liveZones');
        }

        return buildResult(toolName, true, analysis);
      } catch (error: any) {
        return {
          toolName,
          success: false,
          error: error?.message || 'Failed to scan flood zone',
          executedAt: new Date().toISOString(),
          output: null
        };
      }
    }
  },
  {
    name: 'get_zone_status',
    description:
      'Retrieves current flood severity, water depth, hazards and metadata for a specific zone from Firebase',
    inputSchema: {
      zoneId: 'string'
    },
    execute: async (input: { zoneId: string }) => {
      const toolName = 'get_zone_status';
      try {
        const { zoneId } = input || {};
        if (!zoneId) {
          return buildResult(toolName, false, null, 'zoneId is required');
        }

        const snapshot = await get(ref(rtdb, `liveZones/${zoneId}`));
        const zoneData = snapshot.exists() ? snapshot.val() : { found: false };
        return buildResult(toolName, true, zoneData);
      } catch (error: any) {
        return {
          toolName,
          success: false,
          error: error?.message || 'Failed to retrieve zone status',
          executedAt: new Date().toISOString(),
          output: null
        };
      }
    }
  },
  {
    name: 'update_zone_severity',
    description:
      'Updates severity level of a flood zone with reason and audit timestamp for government tracking',
    inputSchema: {
      zoneId: 'string',
      severity: 'number',
      reason: 'string'
    },
    execute: async (input: { zoneId: string; severity: number; reason: string }) => {
      const toolName = 'update_zone_severity';
      try {
        const { zoneId, severity, reason } = input || {};
        if (!zoneId || typeof severity !== 'number' || !reason) {
          return buildResult(toolName, false, null, 'zoneId, severity, and reason are required');
        }

        try {
          await update(ref(rtdb, `liveZones/${zoneId}`), {
            severity,
            agentReason: reason,
            lastUpdated: new Date().toISOString()
          });
        } catch (writeError: any) {
          return buildResult(toolName, false, null, writeError?.message || 'Failed to update zone severity');
        }

        return buildResult(toolName, true, { updated: true, zoneId, severity, reason });
      } catch (error: any) {
        return {
          toolName,
          success: false,
          error: error?.message || 'Failed to update zone severity',
          executedAt: new Date().toISOString(),
          output: null
        };
      }
    }
  },
  {
    name: 'get_active_nodes',
    description:
      'Discovers all active citizen sensor nodes currently reporting flood data. Returns node list for agent to plan resource allocation',
    inputSchema: {},
    execute: async () => {
      const toolName = 'get_active_nodes';
      try {
        const snapshot = await get(ref(rtdb, 'liveReports'));
        if (!snapshot.exists()) {
          return buildResult(toolName, true, { nodeCount: 0, nodes: [] });
        }

        const now = Date.now();
        const activeThreshold = now - 600000;
        const reportsObj = snapshot.val() as Record<string, any>;

        const activeNodes = Object.entries(reportsObj)
          .filter(([, report]) => {
            const timestamp = toTimestampMs(
              report?.timestamp ?? report?.createdAt ?? report?.submittedAt ?? report?.updatedAt
            );
            return Number.isFinite(timestamp) && timestamp > activeThreshold;
          })
          .map(([reportId, report], index) => ({
            nodeId: report?.nodeId || `NODE-${String(index + 1).padStart(3, '0')}`,
            reportId,
            location: report?.location || { lat: 0, lng: 0, address: 'Unknown' },
            severity: normalizeSeverity(report?.analysisResult?.riskScore ?? report?.severity),
            timestamp: toTimestampMs(
              report?.timestamp ?? report?.createdAt ?? report?.submittedAt ?? report?.updatedAt
            )
          }));

        return buildResult(toolName, true, { nodeCount: activeNodes.length, nodes: activeNodes });
      } catch (error: any) {
        return {
          toolName,
          success: false,
          error: error?.message || 'Failed to get active nodes',
          executedAt: new Date().toISOString(),
          output: null
        };
      }
    }
  },
  {
    name: 'dispatch_alert',
    description:
      'Dispatches emergency flood alert for a zone to Malaysian authorities. Use for severity >= 7 zones only.',
    inputSchema: {
      zoneId: 'string',
      authorities: 'string[]',
      severity: 'number',
      reason: 'string'
    },
    execute: async (input: {
      zoneId: string;
      authorities: string[];
      severity: number;
      reason: string;
    }) => {
      const toolName = 'dispatch_alert';
      try {
        const { zoneId, authorities, severity, reason } = input || {};
        if (!zoneId || !Array.isArray(authorities) || authorities.length === 0 || typeof severity !== 'number' || !reason) {
          return buildResult(toolName, false, null, 'zoneId, authorities, severity, and reason are required');
        }

        const timestamp = new Date().toISOString();

        try {
          await set(ref(rtdb, `agentAlerts/${zoneId}`), {
            zoneId,
            authorities,
            severity,
            reason,
            dispatchedAt: timestamp,
            status: 'dispatched'
          });
        } catch (writeError: any) {
          return buildResult(toolName, false, null, writeError?.message || 'Failed to dispatch alert');
        }

        return buildResult(toolName, true, {
          dispatched: true,
          zoneId,
          authorities,
          dispatchedAt: timestamp
        });
      } catch (error: any) {
        return {
          toolName,
          success: false,
          error: error?.message || 'Failed to dispatch alert',
          executedAt: new Date().toISOString(),
          output: null
        };
      }
    }
  },
  {
    name: 'get_system_health',
    description:
      'Checks BILAHUJAN system health: active nodes, last heartbeat, network status, and zone coverage',
    inputSchema: {},
    execute: async () => {
      const toolName = 'get_system_health';
      try {
        const [heartbeatSnap, reportsSnap, zonesSnap] = await Promise.all([
          get(ref(rtdb, 'systemHeartbeat/status')),
          get(ref(rtdb, 'liveReports')),
          get(ref(rtdb, 'liveZones'))
        ]);

        const heartbeat = heartbeatSnap.exists() ? heartbeatSnap.val() : null;
        const reports = reportsSnap.exists() ? reportsSnap.val() : {};
        const zones = zonesSnap.exists() ? zonesSnap.val() : {};

        const activeReports = Object.keys(reports).length;
        const activeZones = Object.keys(zones).length;
        const heartbeatTimestamp = Number(heartbeat?.timestamp ?? 0);
        const lastHeartbeat = heartbeat?.lastUpdate || null;

        let networkHealth: 'optimal' | 'degraded' | 'offline' = 'offline';
        const heartbeatAge = heartbeatTimestamp ? Date.now() - heartbeatTimestamp : Number.POSITIVE_INFINITY;
        if (heartbeatAge < 2 * 60 * 1000) {
          networkHealth = 'optimal';
        } else if (heartbeatAge <= 10 * 60 * 1000) {
          networkHealth = 'degraded';
        }

        return buildResult(toolName, true, {
          status: heartbeat?.status || 'unknown',
          lastHeartbeat,
          activeReports,
          activeZones,
          networkHealth
        });
      } catch (error: any) {
        return {
          toolName,
          success: false,
          error: error?.message || 'Failed to get system health',
          executedAt: new Date().toISOString(),
          output: null
        };
      }
    }
  },
  {
    name: 'thermal_scan',
    description:
      'Scans all flood zones within radius from coordinates. Returns zones sorted by severity descending. Equivalent to drone thermal scanning a sector.',
    inputSchema: {
      lat: 'number',
      lng: 'number',
      radiusKm: 'number'
    },
    execute: async (input: { lat: number; lng: number; radiusKm: number }) => {
      const toolName = 'thermal_scan';
      try {
        const { lat, lng, radiusKm } = input || {};
        if (typeof lat !== 'number' || typeof lng !== 'number' || typeof radiusKm !== 'number') {
          return buildResult(toolName, false, null, 'lat, lng, and radiusKm are required');
        }

        const zonesSnap = await get(ref(rtdb, 'liveZones'));
        if (!zonesSnap.exists()) {
          return buildResult(toolName, true, { zonesFound: 0, zones: [] });
        }

        const zonesObj = zonesSnap.val() as Record<string, any>;
        const zonesInRadius = Object.entries(zonesObj)
          .map(([zoneId, zone]) => {
            const zoneLat = Number(zone?.lat ?? zone?.location?.lat);
            const zoneLng = Number(zone?.lng ?? zone?.location?.lng);
            const severity = normalizeSeverity(zone?.severity ?? zone?.riskScore);
            return {
              zoneId,
              ...zone,
              severity,
              distanceKm:
                Number.isFinite(zoneLat) && Number.isFinite(zoneLng)
                  ? haversineDistance(lat, lng, zoneLat, zoneLng)
                  : Number.POSITIVE_INFINITY
            };
          })
          .filter((zone) => Number.isFinite(zone.distanceKm) && zone.distanceKm <= radiusKm)
          .sort((a, b) => b.severity - a.severity);

        return buildResult(toolName, true, {
          zonesFound: zonesInRadius.length,
          zones: zonesInRadius
        });
      } catch (error: any) {
        return {
          toolName,
          success: false,
          error: error?.message || 'Failed to perform thermal scan',
          executedAt: new Date().toISOString(),
          output: null
        };
      }
    }
  }
];

export const getToolByName = (name: string): MCPTool | undefined =>
  toolRegistry.find((tool) => tool.name === name);
