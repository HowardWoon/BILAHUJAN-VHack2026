import { useState, useEffect } from 'react';
import { getToolByName, toolRegistry } from './mcpTools';
import { MissionLog, AgentStep, AgentStatus } from '../types/swarm';
import { rtdb } from '../firebase';
import { ref, set, get, onValue } from 'firebase/database';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;
const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash'];

const SYSTEM_INSTRUCTION = `You are BILAHUJAN Command Agent — an 
autonomous flood triage AI for Malaysia operating a decentralised 
swarm intelligence network. You coordinate citizen sensor nodes 
like a drone swarm commander.

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

async function callGemini(prompt: string): Promise<string> {
  let lastError = 'Unknown Gemini error';

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1500 }
      })
    });

    if (res.ok) {
      const json = await res.json();
      return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    }

    const err = await res.json().catch(() => ({}));
    const message = (err as any)?.error?.message ?? res.statusText;

    if (res.status === 404) {
      lastError = `Model ${model} unavailable: ${message}`;
      continue;
    }

    throw new Error(`Gemini ${res.status}: ${message}`);
  }

  throw new Error(lastError);
}

function extractJSON(text: string): any {
  const stripped = text.replace(/^```(?:json)?\s*/im, '').replace(/```\s*$/im, '').trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found in Gemini response');
  return JSON.parse(match[0]);
}

async function planMission(goal: string, context: any): Promise<any> {
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

  const text = await callGemini(prompt);
  return extractJSON(text);
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
    return await callGemini(prompt);
  } catch {
    return `Mission completed. ${successSteps.length} steps executed successfully. Authorities have been notified of critical zones.`;
  }
}

export async function runMission(
  goal: string,
  onStepUpdate?: (step: AgentStep) => void
): Promise<MissionLog> {
  if (!GEMINI_API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY not configured. Add it to your .env file.');
  }

  const missionId = `MISSION-${Date.now()}`;
  const startTime = new Date().toISOString();
  const existingStatus = await getAgentStatus();

  try {
    await set(ref(rtdb, 'agentStatus'), {
      isRunning: true,
      currentMissionId: missionId,
      lastMissionId: existingStatus.lastMissionId || null,
      lastRunTime: startTime,
      totalMissionsRun: existingStatus.totalMissionsRun,
      currentStep: null
    });
  } catch {
    // non-fatal
  }

  const healthTool = getToolByName('get_system_health');
  const nodesTool = getToolByName('get_active_nodes');
  const healthResult = healthTool ? await healthTool.execute({}) : { output: {} };
  const nodesResult = nodesTool ? await nodesTool.execute({}) : { output: {} };

  const context = {
    systemHealth: healthResult.output,
    activeNodes: nodesResult.output,
    timestamp: new Date().toISOString()
  };

  let plan: any;
  try {
    plan = await planMission(goal, context);
  } catch (error: any) {
    throw new Error(`Mission planning failed: ${error.message}`);
  }

  const completedSteps: AgentStep[] = [];

  for (const planned of plan.steps) {
    const step: AgentStep = {
      stepNumber: planned.stepNumber,
      reasoning: planned.reasoning,
      toolName: planned.toolName,
      toolInput: planned.toolInput ?? {},
      toolOutput: {},
      timestamp: new Date().toISOString(),
      status: 'running'
    };

    onStepUpdate?.(step);

    const tool = getToolByName(planned.toolName);
    if (!tool) {
      step.status = 'failed';
      step.toolOutput = { error: `Tool "${planned.toolName}" not found in registry` };
    } else {
      try {
        const result = await tool.execute(planned.toolInput ?? {});
        step.toolOutput = result.output ?? {};
        step.status = result.success ? 'success' : 'failed';
        if (!result.success) {
          step.toolOutput = { error: result.error };
        }
      } catch (error: any) {
        step.status = 'failed';
        step.toolOutput = { error: error.message };
      }
    }

    step.timestamp = new Date().toISOString();
    completedSteps.push(step);
    onStepUpdate?.(step);

    try {
      await set(ref(rtdb, 'agentStatus/currentStep'), step);
    } catch {
      // non-fatal
    }

    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  const endTime = new Date().toISOString();
  const summary = await generateSummary(goal, completedSteps);

  const zonesActioned = completedSteps.filter(
    (step) =>
      step.status === 'success' &&
      ['get_zone_status', 'update_zone_severity', 'thermal_scan', 'scan_flood_zone'].includes(step.toolName)
  ).length;

  const alertsDispatched = completedSteps.filter(
    (step) => step.status === 'success' && step.toolName === 'dispatch_alert'
  ).length;

  const failedCount = completedSteps.filter((step) => step.status === 'failed').length;
  const missionStatus: MissionLog['status'] =
    failedCount === 0 ? 'completed' : failedCount < completedSteps.length ? 'partial' : 'failed';

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

  try {
    await set(ref(rtdb, `missionLogs/${missionId}`), log);
  } catch {
    // non-fatal
  }

  try {
    await set(ref(rtdb, 'agentStatus'), {
      isRunning: false,
      lastMissionId: missionId,
      lastRunTime: endTime,
      totalMissionsRun: existingStatus.totalMissionsRun + 1,
      currentMissionId: null,
      currentStep: null
    });
  } catch {
    // non-fatal
  }

  return log;
}

export async function autoAssessNewZone(
  zoneId: string,
  severity: number,
  location: string
): Promise<void> {
  if (severity < 5) return;

  const goal = severity >= 9
    ? `CRITICAL ALERT: New severity ${severity}/10 flood at ${location} (Zone ${zoneId}). This is a life-threatening situation. Immediately dispatch JPS, NADMA, and APM. Assess surrounding zones for cascade risk.`
    : severity >= 7
    ? `SEVERE FLOOD: New severity ${severity}/10 report at ${location}. Dispatch JPS and NADMA. Check adjacent zones for escalation.`
    : `MODERATE FLOOD: New severity ${severity}/10 at ${location}. Monitor and prepare response if escalates.`;

  try {
    await runMission(goal);
  } catch (e) {
    console.warn('Auto-assessment failed:', e);
  }
}

export async function getLastMission(): Promise<MissionLog | null> {
  try {
    const snap = await get(ref(rtdb, 'missionLogs'));
    if (!snap.exists()) return null;
    const logs = Object.values(snap.val()) as MissionLog[];
    return (
      logs.sort((left, right) => new Date(right.startTime).getTime() - new Date(left.startTime).getTime())[0] ?? null
    );
  } catch {
    return null;
  }
}

export async function getAgentStatus(): Promise<AgentStatus> {
  try {
    const snap = await get(ref(rtdb, 'agentStatus'));
    return snap.exists()
      ? (snap.val() as AgentStatus)
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

    const unsub = onValue(
      ref(rtdb, 'missionLogs'),
      (snap) => {
        if (!snap.exists()) {
          setLogs([]);
          return;
        }
        const all = Object.values(snap.val()) as MissionLog[];
        setLogs(
          all
            .sort((left, right) => new Date(right.startTime).getTime() - new Date(left.startTime).getTime())
            .slice(0, 10)
        );
      },
      { onlyOnce: false }
    );

    missionLogsListener = unsub;

    return () => {
      unsub();
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
    const unsub = onValue(
      ref(rtdb, 'agentStatus'),
      (snap) => {
        if (snap.exists()) {
          setStatus(snap.val() as AgentStatus);
        } else {
          setStatus({ isRunning: false, totalMissionsRun: 0 });
        }
      },
      (error) => {
        console.error('useAgentStatus listener error:', error);
        setStatus({ isRunning: false, totalMissionsRun: 0 });
      }
    );

    return () => unsub();
  }, []);

  return status;
}
