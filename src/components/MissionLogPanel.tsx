import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { runMission, useAgentStatus, useMissionLogs } from '../services/commandAgent';
import { AgentStep, MissionLog } from '../types/swarm';

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
  const [viewMode, setViewMode] = useState<'compact' | 'expanded'>('compact');
  const [stepFilter, setStepFilter] = useState<'all' | 'running' | 'success' | 'failed'>('all');
  const [error, setError] = useState<string | null>(null);

  const missionLogs = useMissionLogs();
  const agentStatus = useAgentStatus();
  const terminalRef = useRef<HTMLDivElement>(null);
  const missionCount = Math.max(agentStatus.totalMissionsRun || 0, missionLogs.length);
  const lastMissionError = useMemo(() => {
    const latestFailed = missionLogs.find((log) => log.status === 'failed');
    if (!latestFailed) {
      return null;
    }
    const text = (latestFailed.summary || 'Mission failed without summary.').trim();
    return text.length > 90 ? `${text.slice(0, 90)}...` : text;
  }, [missionLogs]);

  const sortedSteps = useMemo(
    () => [...currentSteps].sort((left, right) => left.stepNumber - right.stepNumber),
    [currentSteps]
  );

  const filteredSteps = useMemo(() => {
    if (stepFilter === 'all') {
      return sortedSteps;
    }
    return sortedSteps.filter((step) => step.status === stepFilter);
  }, [sortedSteps, stepFilter]);

  const runningStepCount = useMemo(
    () => currentSteps.filter((step) => step.status === 'running').length,
    [currentSteps]
  );

  const successfulStepCount = useMemo(
    () => currentSteps.filter((step) => step.status === 'success').length,
    [currentSteps]
  );

  useEffect(() => {
    import('firebase/database')
      .then(({ ref: fbRef, set }) => {
        import('../firebase')
          .then(({ rtdb }) => {
            set(fbRef(rtdb, 'agentStatus/isRunning'), false).catch(() => {});
            set(fbRef(rtdb, 'agentStatus/currentMissionId'), null).catch(() => {});
            set(fbRef(rtdb, 'agentStatus/currentStep'), null).catch(() => {});
          })
          .catch(() => {});
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [currentSteps, currentSummary]);

  const handleRunMission = useCallback(async () => {
    setIsRunning(true);
    setCurrentSteps([]);
    setCurrentSummary('');
    setCurrentStatus(null);
    setZonesActioned(0);
    setAlertsDispatched(0);
    setError(null);
    setShowHistory(false);
    setStepFilter('all');

    try {
      const log = await runMission(DEFAULT_GOAL, (step: AgentStep) => {
        setCurrentSteps((previous) => {
          const index = previous.findIndex((existing) => existing.stepNumber === step.stepNumber);
          if (index >= 0) {
            const updated = [...previous];
            updated[index] = { ...step };
            return updated;
          }
          return [...previous, { ...step }];
        });
      });

      setCurrentSummary(log.summary);
      setCurrentStatus(log.status);
      setZonesActioned(log.zonesActioned);
      setAlertsDispatched(log.alertsDispatched);
    } catch (runError: any) {
      setError(runError?.message ?? 'Mission failed');
      setCurrentStatus('failed');
    } finally {
      setIsRunning(false);
    }
  }, []);

  const formatStepResult = useCallback((step: AgentStep): string => {
    if (step.status !== 'success') {
      return ((step.toolOutput as any)?.error as string) || 'Tool execution failed';
    }

    try {
      const output = step.toolOutput as any;
      if (output?.nodeCount !== undefined) return `${output.nodeCount} nodes discovered`;
      if (output?.zonesFound !== undefined) return `${output.zonesFound} zones found`;
      if (output?.dispatched === true) {
        return `Alert dispatched to ${output.authorities?.join(', ') || 'authorities'}`;
      }
      if (output?.networkHealth) {
        return `Network: ${output.networkHealth} | ${output.activeZones ?? 0} zones active`;
      }
      if (output?.updated === true) {
        return `Zone ${output.zoneId} updated to severity ${output.severity}`;
      }

      const compact = JSON.stringify(output);
      if (!compact) return 'Success';
      return compact.length > 80 ? `${compact.slice(0, 80)}...` : compact;
    } catch {
      return 'Success';
    }
  }, []);

  const renderedSteps = useMemo(
    () =>
      filteredSteps
        .map((step) => (
          <div key={`${step.stepNumber}-${step.timestamp}`} className="rounded-lg border border-gray-800 bg-[#0B1220] p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-mono text-gray-500 shrink-0">STEP {String(step.stepNumber).padStart(2, '0')}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wide shrink-0 ${
                    step.status === 'running'
                      ? 'bg-yellow-900/70 text-yellow-300'
                      : step.status === 'success'
                      ? 'bg-green-900/70 text-green-300'
                      : step.status === 'failed'
                      ? 'bg-red-900/70 text-red-300'
                      : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {step.status}
                </span>
              </div>
              <span className="text-[10px] text-gray-600 shrink-0">{new Date(step.timestamp).toLocaleTimeString()}</span>
            </div>

            <p
              className={
                step.toolName === 'planner.gemini'
                  ? 'text-violet-300 text-xs leading-relaxed'
                  : step.toolName === 'planner.fallback'
                  ? 'text-amber-300 text-xs leading-relaxed'
                  : step.status === 'running'
                  ? 'text-yellow-200 text-xs leading-relaxed'
                  : step.status === 'success'
                  ? 'text-gray-100 text-xs leading-relaxed'
                  : 'text-red-200 text-xs leading-relaxed'
              }
              style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
            >
              {step.reasoning}
            </p>

            {step.toolName && (
              <div
                className={`text-[11px] font-mono inline-flex items-center gap-1 px-2 py-1 rounded border ${
                  step.toolName === 'planner.gemini'
                    ? 'text-violet-300 border-violet-900 bg-violet-950/30'
                    : step.toolName === 'planner.fallback'
                    ? 'text-amber-300 border-amber-900 bg-amber-950/20'
                    : 'text-cyan-300 border-cyan-900 bg-cyan-950/20'
                }`}
              >
                <span>TOOL</span>
                <span className="font-bold truncate">{step.toolName}</span>
              </div>
            )}

            {viewMode === 'expanded' && Object.keys(step.toolInput ?? {}).length > 0 && (
              <details className="text-[11px]">
                <summary className="cursor-pointer text-gray-500 hover:text-gray-300">Input payload</summary>
                <div
                  className="mt-1 text-gray-400 break-words bg-[#05080D] border border-gray-800 rounded p-2"
                  style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                >
                  {JSON.stringify(step.toolInput).slice(0, 220)}
                </div>
              </details>
            )}

            {(step.status === 'success' || step.status === 'failed') && (
              <div
                className={`text-xs break-words rounded border p-2 ${
                  step.status === 'success'
                    ? 'text-green-300 border-green-900 bg-green-950/20'
                    : 'text-red-300 border-red-900 bg-red-950/20'
                }`}
                style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
              >
                <span className="font-mono mr-1">{step.status === 'success' ? '✓' : '✗'}</span>
                {formatStepResult(step)}
              </div>
            )}

            {step.status === 'running' && (
              <div className="text-yellow-600 text-xs flex items-center gap-1">
                <div className="w-2 h-2 border border-yellow-600 border-t-transparent rounded-full animate-spin" />
                executing...
              </div>
            )}
          </div>
        )),
    [filteredSteps, formatStepResult, viewMode]
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
            setShowHistory(false);
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
          <div className="text-gray-500 text-xs truncate mb-1">
            {(log.goal ?? log.summary ?? 'Mission record').slice(0, 80)}...
          </div>
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
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isRunning ? (
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-gray-600 flex-shrink-0" />
            )}
            <span className="font-mono text-lg font-bold text-white truncate">⚡ BILAHUJAN Command Agent</span>
          </div>

          {isRunning ? (
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-900 text-green-300 animate-pulse whitespace-nowrap">
              ● RUNNING
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-800 text-gray-500 whitespace-nowrap">
              ○ IDLE
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 pl-4">
          <span className="text-gray-400 font-mono text-sm font-semibold">v2.0 · Swarm Intelligence</span>
          {missionCount > 0 && (
            <span className="text-gray-400 font-mono text-xs font-medium">{missionCount} missions run</span>
          )}
        </div>
        {lastMissionError && (
          <div className="pl-4 pt-1 text-[10px] font-mono text-red-400/90 truncate" title={lastMissionError}>
            Last mission error: {lastMissionError}
          </div>
        )}
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

        <div className="inline-flex items-center rounded-lg border border-gray-700 overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode('compact')}
            className={`px-2.5 py-2 text-[11px] font-mono transition-all ${
              viewMode === 'compact'
                ? 'bg-cyan-900/30 text-cyan-300'
                : 'bg-[#0D1117] text-gray-400 hover:text-gray-200'
            }`}
          >
            Compact
          </button>
          <button
            type="button"
            onClick={() => setViewMode('expanded')}
            className={`px-2.5 py-2 text-[11px] font-mono transition-all border-l border-gray-700 ${
              viewMode === 'expanded'
                ? 'bg-cyan-900/30 text-cyan-300'
                : 'bg-[#0D1117] text-gray-400 hover:text-gray-200'
            }`}
          >
            Expanded
          </button>
        </div>

        {error && <span className="text-red-400 text-xs font-mono">✗ {error}</span>}
      </div>

      {(isRunning || currentStatus) && (
        <div className="px-4 py-2 bg-[#0D1117] border-b border-gray-800 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-lg border border-blue-900/50 bg-blue-950/20 px-2 py-1.5">
              <p className="text-[10px] text-blue-300/70 font-mono">STEPS</p>
              <p className="text-blue-300 font-bold font-mono text-base leading-tight">{currentSteps.length}</p>
            </div>
            <div className="rounded-lg border border-cyan-900/50 bg-cyan-950/20 px-2 py-1.5">
              <p className="text-[10px] text-cyan-300/70 font-mono">RUNNING</p>
              <p className="text-cyan-300 font-bold font-mono text-base leading-tight">{runningStepCount}</p>
            </div>
            <div className="rounded-lg border border-indigo-900/50 bg-indigo-950/20 px-2 py-1.5">
              <p className="text-[10px] text-indigo-300/70 font-mono">ZONES</p>
              <p className="text-indigo-300 font-bold font-mono text-base leading-tight">{zonesActioned}</p>
            </div>
            <div className="rounded-lg border border-orange-900/50 bg-orange-950/20 px-2 py-1.5">
              <p className="text-[10px] text-orange-300/70 font-mono">ALERTS</p>
              <p className="text-orange-300 font-bold font-mono text-base leading-tight">{alertsDispatched}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setStepFilter('all')}
                className={`px-2 py-1 rounded text-[10px] font-mono border transition-all ${
                  stepFilter === 'all'
                    ? 'text-cyan-300 border-cyan-700 bg-cyan-950/30'
                    : 'text-gray-500 border-gray-800 hover:text-gray-300'
                }`}
              >
                ALL {currentSteps.length}
              </button>
              {viewMode === 'expanded' && (
                <button
                  type="button"
                  onClick={() => setStepFilter('running')}
                  className={`px-2 py-1 rounded text-[10px] font-mono border transition-all ${
                    stepFilter === 'running'
                      ? 'text-yellow-300 border-yellow-700 bg-yellow-950/30'
                      : 'text-gray-500 border-gray-800 hover:text-gray-300'
                  }`}
                >
                  RUNNING {runningStepCount}
                </button>
              )}
              <button
                type="button"
                onClick={() => setStepFilter('success')}
                className={`px-2 py-1 rounded text-[10px] font-mono border transition-all ${
                  stepFilter === 'success'
                    ? 'text-green-300 border-green-700 bg-green-950/30'
                    : 'text-gray-500 border-gray-800 hover:text-gray-300'
                }`}
              >
                SUCCESS {successfulStepCount}
              </button>
              {viewMode === 'expanded' && (
                <button
                  type="button"
                  onClick={() => setStepFilter('failed')}
                  className={`px-2 py-1 rounded text-[10px] font-mono border transition-all ${
                    stepFilter === 'failed'
                      ? 'text-red-300 border-red-700 bg-red-950/30'
                      : 'text-gray-500 border-gray-800 hover:text-gray-300'
                  }`}
                >
                  FAILED {Math.max(currentSteps.length - successfulStepCount - runningStepCount, 0)}
                </button>
              )}
            </div>

            {isRunning && (
              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-green-900 bg-green-950/20">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
                <span className="text-green-400 text-xs font-mono">LIVE FEED</span>
              </div>
            )}
            {!isRunning && currentStatus && (
              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-gray-700 bg-gray-900/40">
                <span className="text-gray-400 text-xs font-mono">LAST RUN</span>
                <span className="text-gray-200 text-xs font-mono uppercase">{currentStatus}</span>
              </div>
            )}
          </div>

          {viewMode === 'expanded' && stepFilter !== 'all' && (
            <div className="text-[10px] text-gray-500 font-mono">
              Showing {filteredSteps.length} of {currentSteps.length} steps
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <div className="px-4 pt-2 bg-[#05080D] border-b border-gray-900">
          <div className="text-[10px] text-gray-500 font-mono">LIVE EXECUTION TIMELINE</div>
        </div>

        <div
          ref={terminalRef}
          className="p-4 overflow-visible overflow-x-hidden font-mono text-sm space-y-4 bg-[#05080D] min-h-[22rem]"
          style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
        >
          {currentSteps.length === 0 && isRunning === false ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-8">
              <div className="text-4xl mb-4">🛰️</div>
              <p className="text-gray-400 text-sm font-mono font-medium">Command Agent standing by</p>
              <p className="text-gray-600 text-xs font-mono mt-2 leading-relaxed max-w-xs">
                Press "▶ Run Auto-Mission" to begin autonomous swarm intelligence scan across all Malaysian flood zones.
              </p>
              <div className="mt-4 flex gap-2">
                <div className="w-2 h-2 bg-gray-700 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-700 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                <div className="w-2 h-2 bg-gray-700 rounded-full animate-pulse" style={{ animationDelay: '600ms' }} />
              </div>
            </div>
          ) : currentSteps.length === 0 && isRunning ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-8">
              <div className="w-8 h-8 border-2 border-cyan-400/40 border-t-cyan-300 rounded-full animate-spin mb-4" />
              <p className="text-cyan-300 text-sm font-mono font-semibold">Mission engine warming up</p>
              <p className="text-gray-500 text-xs font-mono mt-2 leading-relaxed max-w-xs">
                Preparing toolchain, syncing node intelligence, and generating mission steps...
              </p>
            </div>
          ) : (
            renderedSteps
          )}

          {currentSummary && (
            <div className="mt-3 p-3 bg-[#0D2137] rounded-lg border border-cyan-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-cyan-400 text-xs font-bold font-mono tracking-wider">📊 MISSION SUMMARY</span>
                <div className="flex-1 h-px bg-cyan-900" />
              </div>
              <div className="text-gray-200 text-xs leading-relaxed font-mono break-words whitespace-pre-wrap">
                {currentSummary}
              </div>
            </div>
          )}
        </div>

      </div>

      <div className="px-4 py-3 bg-[#161B22] border-t border-gray-700 flex items-center gap-4 flex-wrap overflow-hidden">
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
          <div className="p-3 space-y-2">
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
