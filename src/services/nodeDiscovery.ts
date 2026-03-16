import { useEffect, useState } from 'react';
import { onValue, ref, set } from 'firebase/database';
import { rtdb } from '../firebase';
import { SensorNode, SwarmNetworkStats } from '../types/swarm';

const statusOrder: Record<SensorNode['status'], number> = {
  active: 0,
  idle: 1,
  offline: 2
};

const ACTIVE_NODE_WINDOW_MS = 60 * 60 * 1000;
const IDLE_NODE_WINDOW_MS = 24 * 60 * 60 * 1000;

function buildNode(reportId: string, data: any, index: number): SensorNode {
  let reportTimestamp: number;

  if (typeof data?.timestamp === 'number' && data.timestamp > 1_000_000_000_000) {
    reportTimestamp = data.timestamp;
  } else if (typeof data?.timestamp === 'number' && data.timestamp > 1_000_000_000) {
    reportTimestamp = data.timestamp * 1000;
  } else if (typeof data?.timestamp === 'string') {
    const parsed = new Date(data.timestamp).getTime();
    reportTimestamp = Number.isNaN(parsed) ? Date.now() : parsed;
  } else {
    reportTimestamp = Date.now();
  }

  const ageMs = Date.now() - reportTimestamp;
  const status: 'active' | 'idle' | 'offline' =
    ageMs < ACTIVE_NODE_WINDOW_MS ? 'active' : ageMs < IDLE_NODE_WINDOW_MS ? 'idle' : 'offline';

  const severity =
    typeof data?.analysisResult?.riskScore === 'number'
      ? data.analysisResult.riskScore
      : typeof data?.severity === 'number'
      ? data.severity
      : 0;

  return {
    nodeId: `NODE-${String(index + 1).padStart(3, '0')}`,
    reportId,
    location: data?.location ?? { lat: 0, lng: 0, address: 'Unknown Location' },
    lastSeen: new Date(reportTimestamp).toISOString(),
    reportCount: typeof data?.reportCount === 'number' ? data.reportCount : 1,
    avgSeverity: severity,
    currentSeverity: severity,
    status,
    zoneId: data?.zoneId
  };
}

export function useLiveNodes(): SensorNode[] {
  const [nodes, setNodes] = useState<SensorNode[]>([]);

  useEffect(() => {
    const unsubscribe = onValue(
      ref(rtdb, 'liveReports'),
      (snapshot) => {
        if (!snapshot.exists()) {
          setNodes([]);
          return;
        }

        const rawReports = snapshot.val() as Record<string, any>;
        const liveNodes = Object.entries(rawReports)
          .map(([reportId, data], index) => buildNode(reportId, data, index))
          .sort((left, right) => {
            const byStatus = statusOrder[left.status] - statusOrder[right.status];
            if (byStatus !== 0) {
              return byStatus;
            }
            return right.currentSeverity - left.currentSeverity;
          });

        setNodes(liveNodes);
      },
      (error) => {
        setNodes([]);
      }
    );

    return () => unsubscribe();
  }, []);

  return nodes;
}

export function useNodeStats(nodes: SensorNode[]): SwarmNetworkStats {
  const active = nodes.filter((node) => node.status === 'active').length;
  const idle = nodes.filter((node) => node.status === 'idle').length;
  const offline = nodes.filter((node) => node.status === 'offline').length;
  const avgNetworkSeverity =
    nodes.length > 0
      ? nodes.reduce((sum, node) => sum + node.currentSeverity, 0) / nodes.length
      : 0;

  return {
    total: nodes.length,
    active,
    idle,
    offline,
    avgNetworkSeverity
  };
}

export async function syncNodesToFirebase(nodes: SensorNode[]): Promise<void> {
  for (const node of nodes) {
    try {
      await set(ref(rtdb, `sensorNodes/${node.nodeId}`), {
        ...node,
        syncedAt: new Date().toISOString()
      });
    } catch {}
  }
}
