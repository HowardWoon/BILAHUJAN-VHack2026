import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { runMission, useMissionLogs, useAgentStatus } from '../services/commandAgent';
import { MissionLog, AgentStep } from '../types/swarm';

const DEFAULT_GOAL = `Assess all active flood zones across Malaysia 
and dispatch emergency alerts for any zone with severity >= 7. 
Prioritize zones with submerged vehicles. Notify JPS for severity 
7-8, notify both NADMA and APM for severity 9-10. Provide 
step-by-step reasoning for every decision made.`;

interface MissionLogPanelProps {
  className?: string;
}

const MissionLogPanel = memo(function MissionLogPanel({ className }: MissionLogPanelProps) {
  const [currentSteps, setCurrentSteps] = useState<AgentStep[]>([]);
  const [currentSummary, setCurrentSummary] = useState('');
  const [currentStatus, setCurrentStatus] = useState<MissionLog['status'] | null>(null);
  const [zonesActioned, setZonesActioned] = useState(0);
  const [alertsDispatched, setAlertsDispatched] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missionLogs = useMissionLogs();
  const agentStatus = useAgentStatus();
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [currentSteps]);

  useEffect(() => {
    setIsRunning(agentStatus.isRunning);
  }, [agentStatus.isRunning]);

  const handleRunMission = useCallback(async () => {
    setIsRunning(true);
    setCurrentSteps([]);
    setCurrentSummary('');
    setCurrentStatus(null);
    setZonesActioned(0);
    setAlertsDispatched(0);
    setError(null);
    setShowHistory(false);

    try {
      const log = await runMission(DEFAULT_GOAL, (step: AgentStep) => {
        setCurrentSteps((prev) => {
          const idx = prev.findIndex((existingStep) => existingStep.stepNumber === step.stepNumber);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = step;
            return copy;
          }
          return [...prev, step];
        });
      });

      setCurrentSummary(log.summary);
      setCurrentStatus(log.status);
      setZonesActioned(log.zonesActioned);
      setAlertsDispatched(log.alertsDispatched);
    } catch (err: any) {
      setError(err.message ?? 'Mission failed');
    } finally {
      setIsRunning(false);
    }
  }, []);

  const renderedSteps = useMemo(
    () =>
      currentSteps.map((step) => (
        <div key={step.stepNumber} className="space-y-1 border-l-2 border-gray-800 pl-3">
          <div className="flex items-start gap-2">
            <span className="text-gray-600 shrink-0">[{String(step.stepNumber).padStart(2, '0')}]</span>
            <span
              className={
                step.status === 'running'
                  ? 'text-yellow-300 animate-pulse'
                  : step.status === 'success'
                  ? 'text-white'
                  : step.status === 'failed'
                  ? 'text-red-300'
                  : 'text-gray-400'
              }
            >
              {step.reasoning}
            </span>
          </div>

          {step.toolName && (
            <div className="pl-8 text-cyan-400 text-xs">
              → Calling: <span className="font-bold">{step.toolName}</span>
            </div>
          )}

          {Object.keys(step.toolInput ?? {}).length > 0 && (
            <div className="pl-8 text-gray-600 text-xs">
              ↳ Input: {JSON.stringify(step.toolInput).slice(0, 100)}
            </div>
          )}

          {(step.status === 'success' || step.status === 'failed') && (
            <div className={`pl-8 text-xs ${step.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
              {step.status === 'success' ? '✓ ' : '✗ '}
              {step.status === 'success'
                ? JSON.stringify(step.toolOutput).slice(0, 150)
                : ((step.toolOutput as any)?.error ?? 'Tool execution failed')}
            </div>
          )}

          {step.status === 'running' && (
            <div className="pl-8 text-yellow-600 text-xs flex items-center gap-1">
              <div className="w-2 h-2 border border-yellow-600 border-t-transparent rounded-full animate-spin" />
              executing...
            </div>
          )}

          <div className="pl-8 text-gray-700 text-xs">{new Date(step.timestamp).toLocaleTimeString()}</div>
        </div>
      )),
    [currentSteps]
  );

  const historyItems = useMemo(
    () =>
      missionLogs.map((log) => (
        <div
          key={log.missionId}
          className="p-3 bg-[#161B22] rounded-lg border border-gray-700 hover:border-gray-500 transition-all cursor-pointer"
          onClick={() => {
            setCurrentSteps(Array.isArray(log.steps) ? log.steps : []);
            setCurrentSummary(log.summary ?? '');
            setCurrentStatus(log.status);
            setZonesActioned(log.zonesActioned ?? 0);
            setAlertsDispatched(log.alertsDispatched ?? 0);
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-cyan-500 text-xs font-mono">{log.missionId}</span>
            <span
              className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                log.status === 'completed'
                  ? 'bg-green-900 text-green-300'
                  : log.status === 'partial'
                  ? 'bg-yellow-900 text-yellow-300'
                  : 'bg-red-900 text-red-300'
              }`}
            >
              {log.status}
            </span>
          </div>
          <div className="text-gray-500 text-xs truncate mb-1">{(log.goal ?? log.summary ?? 'Mission record').slice(0, 80)}...</div>
          <div className="flex gap-4">
            <span className="text-blue-400 text-xs">{log.zonesActioned} zones</span>
            <span className="text-orange-400 text-xs">{log.alertsDispatched} alerts</span>
            <span className="text-gray-700 text-xs">{new Date(log.startTime).toLocaleString()}</span>
          </div>
        </div>
      )),
    [missionLogs]
  );

  return (
    <div className={`bg-[#0D1117] rounded-xl border border-gray-700 overflow-hidden ${className ?? ''}`}>
      <div className="px-4 py-3 bg-[#161B22] border-b border-gray-700 space-y-1.5">
        {/* Row 1: name + status badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isRunning ? (
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-gray-600 flex-shrink-0" />
            )}
            <span className="font-mono text-xs font-bold text-white truncate">⚡ BILAHUJAN Command Agent</span>
          </div>
          <span className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${isRunning ? 'bg-green-900 text-green-300 animate-pulse' : 'bg-gray-800 text-gray-500'}`}>
            {isRunning ? '● RUNNING' : '○ IDLE'}
          </span>
        </div>
        {/* Row 2: version + missions count */}
        <div className="flex items-center gap-3 pl-4">
          <span className="text-gray-600 font-mono text-[10px]">v2.0 · Swarm Intelligence</span>
          <span className="text-gray-600 font-mono text-[10px]">{agentStatus.totalMissionsRun} missions run</span>
        </div>
      </div>

      <div className="px-4 py-3 bg-[#0D1117] border-b border-gray-700 flex items-center gap-3 flex-wrap">
        <button
          onClick={handleRunMission}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-all active:scale-95"
        >
          {isRunning ? (
            <>
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Running Mission...
            </>
          ) : (
            '▶ Run Auto-Mission'
          )}
        </button>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-all"
        >
          📋 {showHistory ? 'Hide History' : 'View History'}
        </button>
        {error && <span className="text-red-400 text-xs font-mono">✗ {error}</span>}
      </div>

      <div ref={terminalRef} className="p-4 overflow-y-auto h-80 font-mono text-sm space-y-4">
        {currentSteps.length === 0 && !isRunning ? (
          <div className="text-gray-600 text-center mt-12">
            <div className="text-3xl mb-3">🛰️</div>
            <div className="text-gray-500">Command Agent standing by.</div>
            <div className="text-xs mt-2 text-gray-700">
              Press "▶ Run Auto-Mission" to begin swarm intelligence scan across all Malaysian flood zones.
            </div>
          </div>
        ) : (
          renderedSteps
        )}

        {currentSummary && (
          <div className="mt-4 p-3 bg-[#161B22] rounded-lg border border-cyan-900">
            <div className="text-cyan-400 text-xs font-bold mb-2 flex items-center gap-1">📊 MISSION SUMMARY</div>
            <div className="text-gray-300 text-xs leading-relaxed">{currentSummary}</div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 bg-[#161B22] border-t border-gray-700 flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-gray-600 text-xs font-mono">ZONES ACTIONED</span>
          <span className="text-blue-400 font-bold font-mono text-lg">{zonesActioned}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-600 text-xs font-mono">ALERTS DISPATCHED</span>
          <span className="text-orange-400 font-bold font-mono text-lg">{alertsDispatched}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-gray-600 text-xs font-mono">STATUS</span>
          <span
            className={`px-2 py-1 rounded text-xs font-bold font-mono ${
              currentStatus === 'completed'
                ? 'bg-green-900 text-green-300'
                : currentStatus === 'partial'
                ? 'bg-yellow-900 text-yellow-300'
                : currentStatus === 'failed'
                ? 'bg-red-900 text-red-300'
                : 'bg-gray-800 text-gray-500'
            }`}
          >
            {currentStatus?.toUpperCase() ?? 'STANDBY'}
          </span>
        </div>
      </div>

      {showHistory && (
        <div className="border-t border-gray-700">
          <div className="px-4 py-2 bg-[#161B22]">
            <span className="text-gray-500 text-xs font-mono font-bold">MISSION HISTORY ({missionLogs.length} missions)</span>
          </div>
          <div className="max-h-64 overflow-y-auto p-3 space-y-2">
            {missionLogs.length === 0 ? (
              <div className="text-gray-700 text-xs font-mono text-center py-4">No missions run yet.</div>
            ) : (
              historyItems
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export { MissionLogPanel };
export default MissionLogPanel;
