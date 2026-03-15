export interface SensorNode {
  nodeId: string;
  reportId: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  lastSeen: string;
  reportCount: number;
  avgSeverity: number;
  currentSeverity: number;
  status: 'active' | 'idle' | 'offline';
  zoneId?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, string>;
  execute: (input: any) => Promise<MCPToolResult>;
}

export interface MCPToolResult {
  toolName: string;
  success: boolean;
  output: any;
  error?: string;
  executedAt: string;
}

export interface AgentStep {
  stepNumber: number;
  reasoning: string;
  toolName: string;
  toolInput: object;
  toolOutput: object;
  timestamp: string;
  status: 'pending' | 'running' | 'success' | 'failed';
}

export interface MissionLog {
  missionId: string;
  goal: string;
  startTime: string;
  endTime: string;
  steps: AgentStep[];
  summary: string;
  zonesActioned: number;
  alertsDispatched: number;
  status: 'completed' | 'partial' | 'failed';
}

export interface AgentStatus {
  isRunning: boolean;
  currentMissionId?: string;
  lastMissionId?: string;
  lastRunTime?: string;
  totalMissionsRun: number;
}

export interface SwarmNetworkStats {
  total: number;
  active: number;
  idle: number;
  offline: number;
  avgNetworkSeverity: number;
}
