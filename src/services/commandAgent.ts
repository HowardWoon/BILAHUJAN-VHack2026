import { useEffect, useState } from 'react';
import { get, onValue, ref, set } from 'firebase/database';
import { rtdb } from '../firebase';
import { AgentStatus, AgentStep, MissionLog } from '../types/swarm';
import { getToolByName, toolRegistry } from './mcpTools';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_INSTRUCTION = `You are BILAHUJAN Command Agent — an
autonomous flood triage AI for Malaysia operating a decentralised
swarm intelligence network. You coordinate citizen sensor nodes
like a drone swarm commander.

You have access to zonesRequiringDispatch in the mission context,
which lists all zones with severity >= 7.

CRITICAL RULE: If zonesRequiringDispatch is not empty in your context,
you MUST dispatch alerts for ALL of them. The absence of active sensor
nodes does NOT mean there are no floods — it means the data was
collected earlier. Historical severity data is still valid and requires
action. ALWAYS check zonesRequiringDispatch first before concluding
there are no zones to action.

MISSION RULES:
- ALWAYS call get_system_health FIRST to assess network status
- ALWAYS call get_active_nodes SECOND to discover available nodes
- ALWAYS call thermal_scan to find high-severity zones near active nodes
- Severity 1-4: Monitor only — no authority dispatch needed
- Severity 5-6: Flag for attention — optional dispatch to JPS only
- Severity 7-8: SEVERE — dispatch JPS and NADMA immediately
- Severity 9-10: CRITICAL — dispatch JPS, NADMA and APM immediately
- ALWAYS explain WHY before every action
- NEVER hardcode zone IDs — discover them from tools
- After all dispatches, call get_zone_status to verify
- End every mission with a clear summary of actions taken`;

let missionLogsListener: (() => void) | null = null;

const FALLBACK_SCAN_CENTER = {
  lat: 4.2105,
  lng: 101.9758,
  radiusKm: 350
};

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

async function callGemini(prompt: string, timeoutMs: number = 20000): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1500 }
      }),
      signal: controller.signal
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('Gemini request timeout');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    const message = (errorPayload as any)?.error?.message ?? response.statusText;
    throw new Error(`Gemini ${response.status}: ${message}`);
  }

  const json = await response.json();
  return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function extractJSON(text: string): any {
  const stripped = text.replace(/^```(?:json)?\s*/im, '').replace(/```\s*$/im, '').trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('No JSON found in Gemini response');
  }
  return JSON.parse(match[0]);
}

function getAuthoritiesBySeverity(severity: number): string[] {
  if (severity >= 9) {
    return ['JPS', 'NADMA', 'APM'];
  }
  if (severity >= 7) {
    return ['JPS', 'NADMA'];
  }
  if (severity >= 5) {
    return ['JPS'];
  }
  return [];
}

function buildFallbackPlan(context: any): any {
  const nodes = context?.activeNodes?.nodes ?? [];
  const firstNode = nodes[0];
  const lat = Number(firstNode?.location?.lat);
  const lng = Number(firstNode?.location?.lng);

  const scanInput =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng, radiusKm: 35 }
      : FALLBACK_SCAN_CENTER;

  return {
    reasoning:
      'Fallback planning engaged due unavailable Gemini response. Running deterministic MCP workflow for continuity.',
    expectedOutcome:
      'Assess current network and scan zones, then dispatch alerts for severe/critical zones when detected.',
    steps: [
      {
        stepNumber: 1,
        reasoning: 'Check platform health before field action.',
        toolName: 'get_system_health',
        toolInput: {}
      },
      {
        stepNumber: 2,
        reasoning: 'Discover currently active citizen sensor nodes.',
        toolName: 'get_active_nodes',
        toolInput: {}
      },
      {
        stepNumber: 3,
        reasoning: 'Perform sector thermal scan centered on latest active node or national fallback center.',
        toolName: 'thermal_scan',
        toolInput: scanInput
      }
    ]
  };
}

async function planMission(
  goal: string,
  context: any
): Promise<{ plan: any; mode: 'gemini' | 'fallback'; reason?: string }> {
  const prompt = `${SYSTEM_INSTRUCTION}

CURRENT NETWORK STATUS:
${JSON.stringify(context, null, 2)}

MISSION GOAL: ${goal}

Based on the network status above, create a mission plan.
Return ONLY this exact JSON with no markdown, no explanation outside JSON:
{
  "reasoning": "your overall analysis of the current flood situation",
  "steps": [
    {
      "stepNumber": 1,
      "reasoning": "exactly why you are calling this tool right now",
      "toolName": "exact_tool_name_from_list",
      "toolInput": {}
    }
  ],
  "expectedOutcome": "what this mission will achieve for Malaysia"
}

Available tools: ${toolRegistry.map((tool) => tool.name).join(', ')}
Plan 5-8 steps minimum. Always start with get_system_health and get_active_nodes.
For every zone with severity >= 7, include a dispatch_alert step.`;

  try {
    const text = await callGemini(prompt, 15000);
    const parsed = extractJSON(text);

    if (!Array.isArray(parsed?.steps) || parsed.steps.length === 0) {
      return {
        plan: buildFallbackPlan(context),
        mode: 'fallback',
        reason: 'Gemini returned no executable steps'
      };
    }

    return { plan: parsed, mode: 'gemini' };
  } catch (error) {
    console.warn('planMission fallback triggered:', error);
    return {
      plan: buildFallbackPlan(context),
      mode: 'fallback',
      reason: error instanceof Error ? error.message : 'Unknown planning error'
    };
  }
}

async function generateSummary(goal: string, steps: AgentStep[]): Promise<string> {
  const successSteps = steps.filter((step) => step.status === 'success');
  const prompt = `You are BILAHUJAN Command Agent. Write a 3-sentence mission
summary for Malaysian emergency authorities.

Mission goal: ${goal}
Steps completed: ${successSteps.length} of ${steps.length}
Steps detail: ${JSON.stringify(
    successSteps.map((step) => ({ tool: step.toolName, output: step.toolOutput })),
    null,
    2
  )}

Write a clear, professional summary covering:
1. What flood conditions were found
2. What actions were taken and which authorities were notified
3. Current status and recommended next steps

Write as plain text, no bullet points, no markdown.`;

  try {
    return await callGemini(prompt, 12000);
  } catch {
    return `Mission completed using resilient execution mode. ${successSteps.length} step(s) executed successfully out of ${steps.length}. Continue monitoring severe zones and dispatch emergency agencies when severity exceeds threshold.`;
  }
}

async function persistMissionCount(): Promise<number> {
  try {
    const prevSnap = await get(ref(rtdb, 'agentStatus/totalMissionsRun'));
    const prev = prevSnap.exists() ? Number(prevSnap.val()) : 0;
    const next = Number.isFinite(prev) ? prev + 1 : 1;
    await set(ref(rtdb, 'agentStatus/totalMissionsRun'), next);
    return next;
  } catch {
    return 1;
  }
}

export async function runMission(
  goal: string,
  onStepUpdate?: (step: AgentStep) => void
): Promise<MissionLog> {
  const missionId = `MISSION-${Date.now()}`;
  const startTime = new Date().toISOString();
  const existingStatus = await withTimeout(getAgentStatus(), 5000, 'getAgentStatus').catch(() => ({
    isRunning: false,
    totalMissionsRun: 0,
    lastMissionId: null,
    currentMissionId: null,
    lastRunTime: null,
    currentStep: null
  }));
  const completedSteps: AgentStep[] = [];

  let missionStatus: MissionLog['status'] = 'failed';
  let summary = 'Mission failed before execution.';
  let zonesActioned = 0;
  let alertsDispatched = 0;
  let endTime = new Date().toISOString();

  await set(ref(rtdb, 'agentStatus'), {
    isRunning: true,
    currentMissionId: missionId,
    lastMissionId: existingStatus.lastMissionId || null,
    lastRunTime: startTime,
    totalMissionsRun: existingStatus.totalMissionsRun,
    currentStep: null
  }).catch(() => {});

  try {
    const bootstrapStep: AgentStep = {
      stepNumber: 0,
      reasoning: 'Bootstrapping mission runtime, checking Firebase connectivity, and preparing MCP tools.',
      toolName: 'mission.bootstrap',
      toolInput: {},
      toolOutput: {},
      timestamp: new Date().toISOString(),
      status: 'running'
    };
    onStepUpdate?.({ ...bootstrapStep });

    const healthTool = getToolByName('get_system_health');
    const nodesTool = getToolByName('get_active_nodes');
    const healthResult = healthTool
      ? await withTimeout(healthTool.execute({}), 8000, 'get_system_health')
      : { success: false, output: {}, error: 'get_system_health tool missing' };
    const nodesResult = nodesTool
      ? await withTimeout(nodesTool.execute({}), 8000, 'get_active_nodes')
      : { success: false, output: {}, error: 'get_active_nodes tool missing' };

    bootstrapStep.status = 'success';
    bootstrapStep.toolOutput = {
      healthOk: Boolean((healthResult as any)?.success),
      nodesOk: Boolean((nodesResult as any)?.success)
    };
    bootstrapStep.timestamp = new Date().toISOString();
    completedSteps.push({ ...bootstrapStep });
    onStepUpdate?.({ ...bootstrapStep });

    const zonesSnap = await withTimeout(get(ref(rtdb, 'liveZones')), 8000, 'get_live_zones');
    const allZones = zonesSnap.exists()
      ? Object.entries(zonesSnap.val() as Record<string, any>)
      : [];

    const criticalZones = allZones
      .filter(([, zone]) => (zone?.severity ?? 0) >= 9)
      .map(([zoneId, zone]) => ({
        zoneId,
        name: zone?.name,
        state: zone?.state,
        severity: zone?.severity,
        eventType: zone?.eventType
      }));

    const severeZonesFromDb = allZones
      .filter(([, zone]) => {
        const severity = Number(zone?.severity ?? 0);
        return severity >= 7 && severity < 9;
      })
      .map(([zoneId, zone]) => ({
        zoneId,
        name: zone?.name,
        state: zone?.state,
        severity: zone?.severity,
        eventType: zone?.eventType
      }));

    const zonesRequiringDispatch = [...criticalZones, ...severeZonesFromDb];
    const highSeverityZones = zonesRequiringDispatch;

    const context = {
      systemHealth: healthResult.output,
      activeNodes: nodesResult.output,
      totalZonesInSystem: allZones.length,
      criticalZones,
      severeZones: severeZonesFromDb,
      zonesRequiringDispatch,
      highSeverityZones,
      totalZones: allZones.length,
      instruction:
        zonesRequiringDispatch.length > 0
          ? `IMPORTANT: There are ${criticalZones.length} critical and ${severeZonesFromDb.length} severe zones in the database that REQUIRE immediate authority dispatch. Even if active nodes are 0, these zones have verified severity data and MUST be actioned.`
          : 'No high-severity zones currently detected.',
      timestamp: new Date().toISOString()
    };

    const planning = await planMission(goal, context);
    const plan = planning.plan;
    const safeSteps = Array.isArray(plan?.steps) ? plan.steps : [];

    const plannerStep: AgentStep = {
      stepNumber: completedSteps.length + 1,
      reasoning:
        planning.mode === 'gemini'
          ? 'Planner ready: Gemini mission plan generated successfully.'
          : `Planner fallback activated: ${planning.reason || 'Gemini unavailable'}. Executing resilient deterministic workflow.`,
      toolName: planning.mode === 'gemini' ? 'planner.gemini' : 'planner.fallback',
      toolInput: {},
      toolOutput: {
        plannerMode: planning.mode,
        reason: planning.reason || null
      },
      timestamp: new Date().toISOString(),
      status: 'success'
    };

    completedSteps.push(plannerStep);
    onStepUpdate?.({ ...plannerStep });

    for (const planned of safeSteps) {
      const step: AgentStep = {
        stepNumber: Number(planned.stepNumber) || completedSteps.length + 1,
        reasoning: planned.reasoning,
        toolName: planned.toolName,
        toolInput: planned.toolInput ?? {},
        toolOutput: {},
        timestamp: new Date().toISOString(),
        status: 'running'
      };

      onStepUpdate?.({ ...step });

      const tool = getToolByName(planned.toolName);
      if (!tool) {
        step.status = 'failed';
        step.toolOutput = { error: `Tool "${planned.toolName}" not found in registry` };
        step.timestamp = new Date().toISOString();
        onStepUpdate?.({ ...step });
        completedSteps.push(step);
        continue;
      }

      try {
        const result = await withTimeout(
          tool.execute(planned.toolInput ?? {}),
          10000,
          planned.toolName || 'tool'
        );
        step.status = result.success ? 'success' : 'failed';
        step.toolOutput = result.output ?? {};
        step.timestamp = new Date().toISOString();
        if (!result.success) {
          step.toolOutput = { error: result.error ?? 'Tool execution failed' };
        }
        onStepUpdate?.({ ...step });
      } catch (error: any) {
        step.status = 'failed';
        step.toolOutput = { error: error?.message ?? 'Tool execution failed' };
        step.timestamp = new Date().toISOString();
        onStepUpdate?.({ ...step });
      }

      completedSteps.push(step);
      await set(ref(rtdb, 'agentStatus/currentStep'), step).catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 700));
    }

    const thermalStep = completedSteps.find(
      (step) => step.status === 'success' && step.toolName === 'thermal_scan'
    );

    const scannedZones: any[] = Array.isArray((thermalStep?.toolOutput as any)?.zones)
      ? ((thermalStep?.toolOutput as any)?.zones as any[])
      : [];

    const scannedSevereZones = scannedZones.filter((zone: any) => Number(zone?.severity ?? 0) >= 7).slice(0, 3);
    const dispatchedZoneIds = new Set<string>();

    let nextStepNumber = completedSteps.length + 1;

    for (const zone of scannedSevereZones) {
      const severity = Number(zone?.severity ?? 0);
      const authorities = getAuthoritiesBySeverity(severity);

      if (authorities.length === 0) {
        continue;
      }

      const dispatchStep: AgentStep = {
        stepNumber: nextStepNumber,
        reasoning: `Dispatching emergency alert for severe zone ${zone?.zoneId ?? 'UNKNOWN'} at severity ${severity}.`,
        toolName: 'dispatch_alert',
        toolInput: {
          zoneId: zone?.zoneId,
          authorities,
          severity,
          reason: 'Auto-dispatch from fallback mission after thermal scan severity threshold exceeded.'
        },
        toolOutput: {},
        timestamp: new Date().toISOString(),
        status: 'running'
      };

      onStepUpdate?.({ ...dispatchStep });

      const dispatchTool = getToolByName('dispatch_alert');
      if (!dispatchTool) {
        dispatchStep.status = 'failed';
        dispatchStep.toolOutput = { error: 'dispatch_alert tool not found in registry' };
      } else {
        try {
          const result = await withTimeout(
            dispatchTool.execute(dispatchStep.toolInput as any),
            10000,
            'dispatch_alert'
          );
          dispatchStep.status = result.success ? 'success' : 'failed';
          dispatchStep.toolOutput = result.output ?? {};
          if (!result.success) {
            dispatchStep.toolOutput = { error: result.error ?? 'Tool execution failed' };
          }
        } catch (error: any) {
          dispatchStep.status = 'failed';
          dispatchStep.toolOutput = { error: error?.message ?? 'Tool execution failed' };
        }
      }

      dispatchStep.timestamp = new Date().toISOString();
      onStepUpdate?.({ ...dispatchStep });
      if (dispatchStep.status === 'success' && typeof zone?.zoneId === 'string') {
        dispatchedZoneIds.add(zone.zoneId);
      }
      completedSteps.push(dispatchStep);
      await set(ref(rtdb, 'agentStatus/currentStep'), dispatchStep).catch(() => {});

      nextStepNumber += 1;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    for (const zone of zonesRequiringDispatch) {
      const zoneId = typeof zone?.zoneId === 'string' ? zone.zoneId : '';
      if (!zoneId || dispatchedZoneIds.has(zoneId)) {
        continue;
      }

      const severity = Number(zone?.severity ?? 0);
      const authorities = getAuthoritiesBySeverity(severity);
      if (authorities.length === 0) {
        continue;
      }

      const dispatchStep: AgentStep = {
        stepNumber: nextStepNumber,
        reasoning: `Dispatching authority alerts from mission context for ${zone?.name || zoneId} (${zone?.state || 'Unknown'}) at severity ${severity}.`,
        toolName: 'dispatch_alert',
        toolInput: {
          zoneId,
          authorities,
          severity,
          reason: 'Mandatory context-driven dispatch for high-severity zone.'
        },
        toolOutput: {},
        timestamp: new Date().toISOString(),
        status: 'running'
      };

      onStepUpdate?.({ ...dispatchStep });

      const dispatchTool = getToolByName('dispatch_alert');
      if (!dispatchTool) {
        dispatchStep.status = 'failed';
        dispatchStep.toolOutput = { error: 'dispatch_alert tool not found in registry' };
      } else {
        try {
          const result = await withTimeout(dispatchTool.execute(dispatchStep.toolInput as any), 10000, 'dispatch_alert');
          dispatchStep.status = result.success ? 'success' : 'failed';
          dispatchStep.toolOutput = result.output ?? {};
          if (!result.success) {
            dispatchStep.toolOutput = { error: result.error ?? 'Tool execution failed' };
          }
        } catch (error: any) {
          dispatchStep.status = 'failed';
          dispatchStep.toolOutput = { error: error?.message ?? 'Tool execution failed' };
        }
      }

      dispatchStep.timestamp = new Date().toISOString();
      onStepUpdate?.({ ...dispatchStep });
      if (dispatchStep.status === 'success') {
        dispatchedZoneIds.add(zoneId);
      }
      completedSteps.push(dispatchStep);
      await set(ref(rtdb, 'agentStatus/currentStep'), dispatchStep).catch(() => {});

      nextStepNumber += 1;
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    const verifyZone = scannedSevereZones[0]?.zoneId ?? zonesRequiringDispatch[0]?.zoneId;
    if (verifyZone) {
      const verifyStep: AgentStep = {
        stepNumber: nextStepNumber,
        reasoning: `Verifying latest state for actioned zone ${verifyZone}.`,
        toolName: 'get_zone_status',
        toolInput: { zoneId: verifyZone },
        toolOutput: {},
        timestamp: new Date().toISOString(),
        status: 'running'
      };

      onStepUpdate?.({ ...verifyStep });
      const verifyTool = getToolByName('get_zone_status');

      if (!verifyTool) {
        verifyStep.status = 'failed';
        verifyStep.toolOutput = { error: 'get_zone_status tool not found in registry' };
      } else {
        try {
          const result = await withTimeout(
            verifyTool.execute({ zoneId: verifyZone }),
            10000,
            'get_zone_status'
          );
          verifyStep.status = result.success ? 'success' : 'failed';
          verifyStep.toolOutput = result.output ?? {};
          if (!result.success) {
            verifyStep.toolOutput = { error: result.error ?? 'Tool execution failed' };
          }
        } catch (error: any) {
          verifyStep.status = 'failed';
          verifyStep.toolOutput = { error: error?.message ?? 'Tool execution failed' };
        }
      }

      verifyStep.timestamp = new Date().toISOString();
      onStepUpdate?.({ ...verifyStep });
      completedSteps.push(verifyStep);
      await set(ref(rtdb, 'agentStatus/currentStep'), verifyStep).catch(() => {});
    }

    endTime = new Date().toISOString();
    const toolDrivenZonesActioned = completedSteps.filter(
      (step) =>
        step.status === 'success' &&
        ['get_zone_status', 'update_zone_severity', 'thermal_scan', 'scan_flood_zone'].includes(step.toolName)
    ).length;

    zonesActioned = Math.max(toolDrivenZonesActioned, dispatchedZoneIds.size);

    alertsDispatched = completedSteps.filter(
      (step) => step.status === 'success' && step.toolName === 'dispatch_alert'
    ).length;

    const failedCount = completedSteps.filter((step) => step.status === 'failed').length;
    missionStatus =
      failedCount === 0 ? 'completed' : failedCount < completedSteps.length ? 'partial' : 'failed';

    summary = await withTimeout(generateSummary(goal, completedSteps), 12000, 'generateSummary');
  } catch (error: any) {
    endTime = new Date().toISOString();
    missionStatus = 'failed';
    summary = `Mission aborted: ${error?.message ?? 'Unknown error'}`;
  }

  const log: MissionLog = {
    missionId,
    goal,
    startTime,
    endTime,
    steps: completedSteps,
    summary,
    zonesActioned,
    alertsDispatched,
    status: missionStatus
  };

  await set(ref(rtdb, `missionLogs/${missionId}`), log).catch(() => {});

  const totalMissionsRun = await persistMissionCount();

  await set(ref(rtdb, 'agentStatus'), {
    isRunning: false,
    lastMissionId: missionId,
    lastRunTime: endTime,
    totalMissionsRun,
    currentMissionId: null,
    currentStep: null
  }).catch(() => {});

  return log;
}

export async function autoAssessNewZone(
  zoneId: string,
  severity: number,
  location: string
): Promise<void> {
  if (severity < 5) {
    return;
  }

  const goal =
    severity >= 9
      ? `CRITICAL ALERT: New severity ${severity}/10 flood at ${location} (Zone ${zoneId}). This is a life-threatening situation. Immediately dispatch JPS, NADMA, and APM. Assess surrounding zones for cascade risk.`
      : severity >= 7
      ? `SEVERE FLOOD: New severity ${severity}/10 report at ${location}. Dispatch JPS and NADMA. Check adjacent zones for escalation.`
      : `MODERATE FLOOD: New severity ${severity}/10 at ${location}. Monitor and prepare response if escalates.`;

  try {
    await runMission(goal);
  } catch (error) {
    console.warn('Auto-assessment failed:', error);
  }
}

export async function getLastMission(): Promise<MissionLog | null> {
  try {
    const snapshot = await get(ref(rtdb, 'missionLogs'));
    if (!snapshot.exists()) {
      return null;
    }

    const logs = Object.values(snapshot.val()) as MissionLog[];
    return (
      logs.sort(
        (left, right) =>
          new Date(right.startTime).getTime() - new Date(left.startTime).getTime()
      )[0] ?? null
    );
  } catch {
    return null;
  }
}

export async function getAgentStatus(): Promise<AgentStatus> {
  try {
    const snapshot = await get(ref(rtdb, 'agentStatus'));
    return snapshot.exists()
      ? (snapshot.val() as AgentStatus)
      : {
          isRunning: false,
          totalMissionsRun: 0
        };
  } catch {
    return { isRunning: false, totalMissionsRun: 0 };
  }
}

export function useMissionLogs(): MissionLog[] {
  const [logs, setLogs] = useState<MissionLog[]>([]);

  useEffect(() => {
    if (missionLogsListener) {
      missionLogsListener();
      missionLogsListener = null;
    }

    const unsubscribe = onValue(
      ref(rtdb, 'missionLogs'),
      (snapshot) => {
        if (!snapshot.exists()) {
          setLogs([]);
          return;
        }

        const allLogs = Object.values(snapshot.val()) as MissionLog[];
        setLogs(
          allLogs
            .sort(
              (left, right) =>
                new Date(right.startTime).getTime() - new Date(left.startTime).getTime()
            )
            .slice(0, 10)
        );
      },
      { onlyOnce: false }
    );

    missionLogsListener = unsubscribe;

    return () => {
      unsubscribe();
      missionLogsListener = null;
    };
  }, []);

  return logs;
}

export function useAgentStatus(): AgentStatus {
  const [status, setStatus] = useState<AgentStatus>({
    isRunning: false,
    totalMissionsRun: 0
  });

  useEffect(() => {
    const unsubscribe = onValue(
      ref(rtdb, 'agentStatus'),
      (snapshot) => {
        if (snapshot.exists()) {
          setStatus(snapshot.val() as AgentStatus);
        } else {
          setStatus({ isRunning: false, totalMissionsRun: 0 });
        }
      },
      (error) => {
        console.error('useAgentStatus listener error:', error);
        setStatus({ isRunning: false, totalMissionsRun: 0 });
      }
    );

    return () => unsubscribe();
  }, []);

  return status;
}
