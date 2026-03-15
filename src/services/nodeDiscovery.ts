import { useState, useEffect } from 'react';
import { rtdb } from '../firebase';
import { ref, onValue, set } from 'firebase/database';
import { SensorNode, SwarmNetworkStats } from '../types/swarm';

const statusOrder: Record<SensorNode['status'], number> = {
  active: 0,
  idle: 1,
  offline: 2
};

function buildNode(reportId: string, data: any, index: number): SensorNode {
  const timestamp = typeof data?.timestamp === 'number' ? data.timestamp : 0;
  const ageMs = Date.now() - timestamp;
  const status = ageMs < 300000 ? 'active' : ageMs < 600000 ? 'idle' : 'offline';

  return {
    nodeId: `NODE-${String(index + 1).padStart(3, '0')}`,
    reportId,
    location: data?.location ?? { lat: 0, lng: 0, address: 'Unknown' },
    lastSeen: new Date(timestamp).toISOString(),
    reportCount: data?.reportCount ?? 1,
    avgSeverity: data?.analysisResult?.riskScore ?? 0,
    currentSeverity: data?.analysisResult?.riskScore ?? 0,
    status,
    zoneId: data?.zoneId
  };
}

export function useLiveNodes(): SensorNode[] {
  const [nodes, setNodes] = useState<SensorNode[]>([]);

  useEffect(() => {
    const unsub = onValue(
      ref(rtdb, 'liveReports'),
      (snap) => {
        if (!snap.exists()) {
          setNodes([]);
          return;
        }

        const raw = snap.val() as Record<string, any>;
        const built = Object.entries(raw)
          .map(([id, data], index) => buildNode(id, data, index))
          .sort((left, right) => statusOrder[left.status] - statusOrder[right.status]);

        setNodes(built);
      },
      (error) => {
        console.error('useLiveNodes listener error:', error);
        setNodes([]);
      }
    );

    return () => unsub();
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
    } catch (error) {
      console.error('syncNodesToFirebase error:', error);
    }
  }
}
