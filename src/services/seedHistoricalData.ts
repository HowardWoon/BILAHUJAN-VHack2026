/**
 * BILAHUJAN — Historical Data Seeder
 * Seeds pre-populated flood history and mission logs into Firebase on first run.
 * Uses systemMeta flags to ensure seeding runs only once per flag version.
 */

import { ref as dbRef, get, set } from 'firebase/database';
import { rtdb } from '../firebase';
import { MALAYSIAN_FLOOD_HISTORY } from '../data/historicalFloodData';

const SEED_KEY = 'historicalDataSeeded_v3';
const MISSION_SEED_KEY = 'missionLogsSeededV3';

// ─── Flood Data Seeder ──────────────────────────────────────────────────────

export async function seedHistoricalDataIfNeeded(): Promise<void> {
  try {
    const flagRef = dbRef(rtdb, `systemMeta/${SEED_KEY}`);
    const snap = await get(flagRef);

    if (snap.exists() && snap.val() === true) {
      console.log('[BILAHUJAN] Historical flood data already seeded — skipping.');
      return;
    }

    console.log('[BILAHUJAN] Seeding historical flood data…');

    for (const record of MALAYSIAN_FLOOD_HISTORY) {
      const zoneRef = dbRef(rtdb, `liveZones/${record.id}`);
      await set(zoneRef, {
        id: record.id,
        name: record.name,
        state: record.state,
        region: record.region,
        severity: record.severity,
        rainfall: record.rainfall,
        drainageBlockage: record.drainageBlockage,
        center: record.center,
        timestamp: record.timestamp,
        eventType: record.eventType,
        waterDepth: record.waterDepth,
        reportCount: record.reportCount,
        affectedResidents: record.affectedResidents,
        isHistorical: true,
        status: 'resolved',
      });
    }

    await set(flagRef, true);
    console.log(
      `[BILAHUJAN] ✅ Seeded ${MALAYSIAN_FLOOD_HISTORY.length} historical flood records.`
    );
  } catch (err) {
    console.warn('[BILAHUJAN] Historical data seed failed (non-fatal):', err);
  }
}

// ─── Mission Logs Seeder ────────────────────────────────────────────────────

const SEEDED_MISSIONS = [
  {
    missionId: 'mission_hist_001',
    goal: 'Assess all active flood zones in Klang Valley. Dispatch emergency alerts for severity >= 7. Coordinate with JPS and NADMA for evacuation support.',
    startTime: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() - 3.5 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'completed',
    steps: [],
    zonesActioned: 7,
    alertsDispatched: 12,
    summary:
      'Multi-agency swarm coordination for Selangor–KL corridor flooding. 24,500 residents evacuated successfully. Infrastructure damage at Klang river banks assessed. JPS and NADMA notified for 3 critical zones.',
  },
  {
    missionId: 'mission_hist_002',
    goal: 'East Coast monsoon watch — scan Kelantan zones, issue alerts for severity >= 7, escalate critical zones to NADMA and APM.',
    startTime: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'completed',
    steps: [],
    zonesActioned: 11,
    alertsDispatched: 29,
    summary:
      'Category-10 monsoon event at Kelantan. Swarm agents issued real-time alerts, coordinated with JPS and Bomba. 45,000+ residents displaced. All 11 zones actioned. NADMA and APM dispatched to 7 critical zones.',
  },
];

export async function seedMissionLogsIfNeeded(): Promise<void> {
  try {
    const flagRef = dbRef(rtdb, `systemMeta/${MISSION_SEED_KEY}`);
    const snap = await get(flagRef);

    if (snap.exists() && snap.val() === true) {
      console.log('[BILAHUJAN] Mission logs already seeded — skipping.');
      return;
    }

    console.log('[BILAHUJAN] Seeding past mission logs…');

    for (const mission of SEEDED_MISSIONS) {
      const missionRef = dbRef(rtdb, `missionLogs/${mission.missionId}`);

      await set(missionRef, mission);
    }

    await set(flagRef, true);
    console.log(
      `[BILAHUJAN] ✅ Seeded ${SEEDED_MISSIONS.length} past mission logs.`
    );
  } catch (err) {
    console.warn('[BILAHUJAN] Mission log seed failed (non-fatal):', err);
  }
}
