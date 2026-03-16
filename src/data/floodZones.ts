import { useState, useEffect } from 'react';
import { saveFloodZone } from '../services/dataCollection';
import { ref, onValue, remove, get } from 'firebase/database';
import { rtdb } from '../firebase';

export interface FloodZone {
  id: string;
  name: string;
  specificLocation: string;
  state: string;
  region: string;
  center: { lat: number; lng: number };
  severity: number;
  forecast: string;
  color: string;
  paths: { lat: number; lng: number }[];
  sources: string[];
  lastUpdated: string;
  drainageBlockage: number; // 0-100
  rainfall: number; // mm/hr
  aiConfidence: number; // 0-100
  aiAnalysisText: string;
  aiAnalysis: {
    waterDepth: string;
    currentSpeed: string;
    riskLevel: string;
    historicalContext: string;
  };
  aiRecommendation: {
    impassableRoads: string;
    evacuationRoute: string;
    evacuationCenter: string;
  };
  estimatedStartTime?: string;
  estimatedEndTime?: string;
  eventType?: string;
  terrain?: { type: string; label: string };
  historical?: { frequency: string; status: string };
  notifiedDepts?: string[];
  status?: 'active' | 'resolved';
}

const HOURS_BY_SEVERITY = {
  critical: 18,
  moderate: 10,
  low: 4
} as const;

const parseDateSafely = (value?: string): Date | null => {
  if (!value) return null;
  if (value === 'N/A' || value === 'Unknown') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const resolveColorBySeverity = (severity: number): FloodZone['color'] => {
  if (severity >= 8) return 'red';
  if (severity >= 4) return 'orange';
  return 'green';
};

const estimateFloodEndTime = (severity: number, startReference: Date): Date => {
  const hours =
    severity >= 8
      ? HOURS_BY_SEVERITY.critical
      : severity >= 4
      ? HOURS_BY_SEVERITY.moderate
      : HOURS_BY_SEVERITY.low;

  return new Date(startReference.getTime() + hours * 60 * 60 * 1000);
};

const normalizeFloodLifecycle = (zone: FloodZone): FloodZone => {
  const now = new Date();
  const safeSeverity = Number.isFinite(zone.severity) ? Math.max(0, Math.min(10, zone.severity)) : 0;
  const lastUpdatedDate = parseDateSafely(zone.lastUpdated) ?? now;
  const startDate = parseDateSafely(zone.estimatedStartTime) ?? lastUpdatedDate;
  const suppliedEndDate = parseDateSafely(zone.estimatedEndTime);

  const computedEndDate = safeSeverity >= 4
    ? suppliedEndDate ?? estimateFloodEndTime(safeSeverity, startDate)
    : suppliedEndDate;

  const hasExpired = !!computedEndDate && computedEndDate.getTime() <= now.getTime();

  if (hasExpired && safeSeverity >= 4) {
    return {
      ...zone,
      severity: 0,
      color: 'green',
      status: 'resolved',
      forecast: 'Flood event estimated to have ended. Monitoring for new reports.',
      lastUpdated: now.toISOString(),
      estimatedStartTime: startDate.toISOString(),
      estimatedEndTime: computedEndDate.toISOString(),
      eventType: zone.eventType || 'Flood Event'
    };
  }

  return {
    ...zone,
    severity: safeSeverity,
    color: resolveColorBySeverity(safeSeverity),
    status: safeSeverity >= 4 ? 'active' : (zone.status === 'resolved' ? 'resolved' : 'active'),
    estimatedStartTime: safeSeverity >= 4 ? startDate.toISOString() : zone.estimatedStartTime,
    estimatedEndTime: safeSeverity >= 4 && computedEndDate ? computedEndDate.toISOString() : zone.estimatedEndTime
  };
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const canonicalTownName = (value: string, state: string): string => {
  const normalized = (value || '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/[,:/\-]+/g, ' ')
    .toLowerCase()
    .replace(new RegExp(`\\b${escapeRegExp(state.toLowerCase())}\\b`, 'g'), ' ')
    .replace(/\b(malaysia|bandar|daerah|pekan|mukim|kampung|kg|jalan|jln|taman|seri|sri|bukit|kota|pusat|kawasan|felda|lembah|padang|simpang|kuala|ayer|air|kebun|lorong|besar|utara|selatan|timur|barat|live|weather|state|overview)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized) {
    return normalized;
  }

  return (value || '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/[,:/\-]+/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};

const canonicalTokenSet = (value: string): Set<string> => {
  return new Set(
    value
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  );
};

const areEquivalentTownNames = (left: string, right: string): boolean => {
  if (!left || !right) return false;
  if (left === right) return true;

  const minLengthForContainment = 4;
  if (
    (left.length >= minLengthForContainment && right.includes(left)) ||
    (right.length >= minLengthForContainment && left.includes(right))
  ) {
    return true;
  }

  const leftTokens = canonicalTokenSet(left);
  const rightTokens = canonicalTokenSet(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return false;

  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) overlap++;
  });

  const score = overlap / Math.max(leftTokens.size, rightTokens.size);
  return score >= 0.6;
};

const generateOrganicShape = (lat: number, lng: number, radius: number, points: number = 12) => {
  const paths = [];
  // Use a fixed seed based on lat/lng so the shape is consistent across renders
  const seed = lat * lng;
  const random = (i: number) => {
    const x = Math.sin(seed + i) * 10000;
    return x - Math.floor(x);
  };

  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    // Add randomness to radius for organic shape
    const r = radius * (0.6 + random(i) * 0.8);
    paths.push({
      lat: lat + r * Math.cos(angle),
      lng: lng + r * Math.sin(angle) * 1.2, // slightly wider longitude
    });
  }
  return paths;
};

export const createZone = (
  id: string, 
  name: string, 
  specificLocation: string,
  state: string,
  region: string,
  lat: number, 
  lng: number, 
  severity: number, 
  forecast: string, 
  radius: number = 0.05,
  sources: string[] = ['Weather API']
): FloodZone => {
  const color = severity >= 8 ? 'red' : severity >= 4 ? 'orange' : 'green';
  
  // Seeded random data based on lat/lng to keep it consistent but varied
  const seed = lat + lng;
  const drainageBlockage = Math.floor(severity * 10 + (seed % 10));
  const rainfall = Math.floor(severity * 5 + (seed % 20));
  const aiConfidence = Math.floor(85 + (seed % 15));
  
  const waterDepth = severity >= 8 ? `${(severity * 0.1).toFixed(1)}m` : severity >= 4 ? '0.2m' : '0m';
  const currentSpeed = severity >= 8 ? 'rapid current' : severity >= 4 ? 'moderate current' : 'still water';
  const riskLevel = severity >= 8 ? 'Ground floors at risk.' : severity >= 4 ? 'Roads partially flooded.' : 'Normal conditions.';
  
  const historicalContext = severity >= 8 ? 'Matches Dec 2021 pattern' : 'Typical monsoon levels';
  
  const impassableRoads = severity >= 8 ? `Jalan ${name} impassable.` : severity >= 4 ? `Jalan ${name} partially flooded.` : 'All roads clear.';
  const evacuationRoute = `via Jalan ${specificLocation.split(' ')[0] || 'Utama'}`;
  const evacuationCenter = `SMK ${name}`;
  
  const aiAnalysisText = severity >= 8 
    ? "Critical infrastructure failure. Evacuation advised for low-lying sectors due to uncontrolled drainage blockage."
    : severity >= 4
    ? "Moderate risk detected. Localized flooding possible in depression areas. Monitor water levels closely."
    : "Conditions normal. No immediate flood risk detected in this sector.";

  // Generate mock estimated times based on severity
  const now = new Date();
  const estimatedStartTime = severity >= 4 ? new Date(now.getTime() - Math.random() * 1000 * 60 * 60 * 2).toLocaleString() : 'N/A';
  const estimatedEndTime = severity >= 4 ? new Date(now.getTime() + Math.random() * 1000 * 60 * 60 * 12).toLocaleString() : 'N/A';

  const terrainTypes = ['Low', 'Flat', 'Hilly', 'Steep'];
  const terrainLabels = ['Depression', 'Plains', 'Slopes', 'High Ground'];
  const terrainIndex = Math.floor(Math.abs(seed) % 4);
  
  const historicalFreqs = ['0×/yr', '1×/yr', '2×/yr', '3+×/yr'];
  const historicalStatuses = ['Inactive', 'Monitor', 'Active', 'Critical'];
  const historicalIndex = Math.floor(Math.abs(seed * 2) % 4);

  return {
    id,
    name,
    specificLocation,
    state,
    region,
    center: { lat, lng },
    severity,
    forecast,
    color,
    paths: generateOrganicShape(lat, lng, radius, 14),
    sources,
    // Mock a recent update time
    lastUpdated: new Date(Date.now() - Math.random() * 1000 * 60 * 15).toISOString(),
    drainageBlockage: Math.min(100, drainageBlockage),
    rainfall,
    aiConfidence: Math.min(100, aiConfidence),
    aiAnalysisText,
    aiAnalysis: {
      waterDepth,
      currentSpeed,
      riskLevel,
      historicalContext,
    },
    aiRecommendation: {
      impassableRoads,
      evacuationRoute,
      evacuationCenter,
    },
    estimatedStartTime,
    estimatedEndTime,
    eventType: severity >= 8 ? 'Flash Flood' : severity >= 4 ? 'Heavy Rain' : 'Normal',
    terrain: { type: terrainTypes[terrainIndex], label: terrainLabels[terrainIndex] },
    historical: { frequency: historicalFreqs[historicalIndex], status: historicalStatuses[historicalIndex] }
  };
};

/**
 * Reconcile the official live-weather severity with community user-report severity
 * into one authoritative severity for a state/location.
 *
 * Rules:
 *  1. No user reports         → live weather alone (source of truth).
 *  2. Both agree (flood / clear) → weighted avg: live 60 %, user 40 %.
 *  3. Live=flood, user=clear  → live weather wins (official data).
 *  4. Live=clear, user=flood + is raining
 *                             → rain corroborates report (flash flood / drainage)
 *                             → weight: live 30 %, user 70 %.
 *  5. Live=clear, user=flood + NO rain
 *                             → possible stale upload or localised drainage issue;
 *                             → average both but cap at 6 (RISING WATER max)
 *                               so we never show FLOOD NOW without weather confirmation.
 */
export const reconcileStateSeverity = (
  liveSeverity: number,
  userMaxSeverity: number,
  isRaining: boolean,
  userReportCount: number
): number => {
  if (userReportCount === 0) return liveSeverity;

  const liveFlooding = liveSeverity >= 4;
  const userFlooding = userMaxSeverity >= 4;

  // Both signals agree
  if (liveFlooding === userFlooding) {
    return Math.round(liveSeverity * 0.6 + userMaxSeverity * 0.4);
  }

  // Official weather says flood, community says clear → trust official data
  if (liveFlooding && !userFlooding) {
    return liveSeverity;
  }

  // Community says flood, live weather says clear
  if (isRaining) {
    // Rainfall corroborates the user report → weight toward community evidence
    return Math.round(liveSeverity * 0.3 + userMaxSeverity * 0.7);
  } else {
    // No rain → acknowledge but cap at RISING WATER (6); don't alarm with FLOOD NOW
    return Math.min(Math.round(liveSeverity * 0.5 + userMaxSeverity * 0.5), 6);
  }
};

let floodZonesCache: Record<string, FloodZone> | null = null;

export const getFloodZones = (): Record<string, FloodZone> => {
  if (!floodZonesCache) {
    // All zones start at severity 0 (CLEAR). Real severity is set only by live AI refresh.
    floodZonesCache = {
      kl: createZone('kl', 'Kuala Lumpur', 'Masjid Jamek', 'Kuala Lumpur', 'Federal Territory', 3.14, 101.69, 0, 'No active flood alerts. Tap refresh for live data.', 0.04, ['Weather API']),
      shahAlam: createZone('shahAlam', 'Shah Alam', 'Taman Sri Muda', 'Selangor', 'Central Region', 3.07, 101.51, 0, 'No active flood alerts. Tap refresh for live data.', 0.05, ['Weather API']),
      kajang: createZone('kajang', 'Kajang', 'Taman Jenaris', 'Selangor', 'Central Region', 2.99, 101.79, 0, 'No active flood alerts. Tap refresh for live data.', 0.03, ['Weather API']),
      seriKembangan: createZone('seriKembangan', 'Seri Kembangan', 'Jalan Besar', 'Selangor', 'Central Region', 3.03, 101.71, 0, 'No active flood alerts. Tap refresh for live data.', 0.02, ['Weather API']),
      seremban: createZone('seremban', 'Seremban', 'Taman Ampangan', 'Negeri Sembilan', 'Central Region', 2.72, 101.94, 0, 'No active flood alerts. Tap refresh for live data.', 0.04, ['Weather API']),
      jb: createZone('jb', 'Johor Bahru', 'Jalan Wong Ah Fook', 'Johor', 'Southern Region', 1.49, 103.74, 0, 'No active flood alerts. Tap refresh for live data.', 0.05, ['Weather API']),
      batu_pahat: createZone('batu_pahat', 'Batu Pahat', 'Pekan Batu Pahat', 'Johor', 'Southern Region', 1.85, 102.93, 0, 'No active flood alerts. Tap refresh for live data.', 0.04, ['Weather API']),
      muar: createZone('muar', 'Muar', 'Pagoh', 'Johor', 'Southern Region', 2.04, 102.57, 0, 'No active flood alerts. Tap refresh for live data.', 0.03, ['Weather API']),
      melaka: createZone('melaka', 'Melaka', 'Banda Hilir', 'Melaka', 'Southern Region', 2.19, 102.25, 0, 'No active flood alerts. Tap refresh for live data.', 0.04, ['Weather API']),
      alor_gajah: createZone('alor_gajah', 'Alor Gajah', 'Pekan Alor Gajah', 'Melaka', 'Southern Region', 2.38, 102.21, 0, 'No active flood alerts. Tap refresh for live data.', 0.03, ['Weather API']),
      kuantan: createZone('kuantan', 'Kuantan', 'Sungai Lembing', 'Pahang', 'East Coast', 3.81, 103.32, 0, 'No active flood alerts. Tap refresh for live data.', 0.06, ['Weather API']),
      temerloh: createZone('temerloh', 'Temerloh', 'Pekan Temerloh', 'Pahang', 'East Coast', 3.45, 102.42, 0, 'No active flood alerts. Tap refresh for live data.', 0.05, ['Weather API']),
      cameron: createZone('cameron', 'Cameron Highlands', 'Tanah Rata', 'Pahang', 'East Coast', 4.46, 101.38, 0, 'No active flood alerts. Tap refresh for live data.', 0.04, ['Weather API']),
      kt: createZone('kt', 'Kuala Terengganu', 'Pantai Batu Buruk', 'Terengganu', 'East Coast', 5.33, 103.15, 0, 'No active flood alerts. Tap refresh for live data.', 0.05, ['Weather API']),
      dungun: createZone('dungun', 'Dungun', 'Paka', 'Terengganu', 'East Coast', 4.75, 103.42, 0, 'No active flood alerts. Tap refresh for live data.', 0.04, ['Weather API']),
      kb: createZone('kb', 'Kota Bharu', 'Pasir Mas', 'Kelantan', 'East Coast', 6.12, 102.23, 0, 'No active flood alerts. Tap refresh for live data.', 0.07, ['Weather API']),
      tanah_merah: createZone('tanah_merah', 'Tanah Merah', 'Pekan Tanah Merah', 'Kelantan', 'East Coast', 5.80, 102.15, 0, 'No active flood alerts. Tap refresh for live data.', 0.05, ['Weather API']),
      gua_musang: createZone('gua_musang', 'Gua Musang', 'Bandar Gua Musang', 'Kelantan', 'East Coast', 4.88, 101.97, 0, 'No active flood alerts. Tap refresh for live data.', 0.04, ['Weather API']),
      ipoh: createZone('ipoh', 'Ipoh', 'Taman Canning', 'Perak', 'Northern Region', 4.59, 101.09, 0, 'No active flood alerts. Tap refresh for live data.', 0.04, ['Weather API']),
      taiping: createZone('taiping', 'Taiping', 'Kamunting', 'Perak', 'Northern Region', 4.85, 100.74, 0, 'No active flood alerts. Tap refresh for live data.', 0.04, ['Weather API']),
      teluk_intan: createZone('teluk_intan', 'Teluk Intan', 'Pekan Teluk Intan', 'Perak', 'Northern Region', 3.97, 101.02, 0, 'No active flood alerts. Tap refresh for live data.', 0.04, ['Weather API']),
      penang: createZone('penang', 'Penang Island', 'Georgetown', 'Penang', 'Northern Region', 5.35, 100.28, 0, 'No active flood alerts. Tap refresh for live data.', 0.04, ['Weather API']),
      butterworth: createZone('butterworth', 'Butterworth', 'Seberang Perai', 'Penang', 'Northern Region', 5.40, 100.36, 0, 'No active flood alerts. Tap refresh for live data.', 0.04, ['Weather API']),
      alorSetar: createZone('alorSetar', 'Alor Setar', 'Anak Bukit', 'Kedah', 'Northern Region', 6.12, 100.36, 0, 'No active flood alerts. Tap refresh for live data.', 0.05, ['Weather API']),
      sungai_petani: createZone('sungai_petani', 'Sungai Petani', 'Bandar Puteri Jaya', 'Kedah', 'Northern Region', 5.65, 100.49, 0, 'No active flood alerts. Tap refresh for live data.', 0.04, ['Weather API']),
      perlis: createZone('perlis', 'Kangar', 'Pekan Kangar', 'Perlis', 'Northern Region', 6.44, 100.20, 0, 'No active flood alerts. Tap refresh for live data.', 0.04, ['Weather API']),
      putrajaya: createZone('putrajaya', 'Putrajaya', 'Presint 1', 'Putrajaya', 'Federal Territory', 2.92, 101.69, 0, 'No active flood alerts. Tap refresh for live data.', 0.03, ['Weather API']),
      labuan: createZone('labuan', 'Labuan', 'Bandar Labuan', 'Labuan', 'Federal Territory', 5.28, 115.24, 0, 'No active flood alerts. Tap refresh for live data.', 0.04, ['Weather API']),
      kuching: createZone('kuching', 'Kuching', 'Batu Kawa', 'Sarawak', 'East Malaysia', 1.55, 110.35, 0, 'No active flood alerts. Tap refresh for live data.', 0.06, ['Weather API']),
      sibu: createZone('sibu', 'Sibu', 'Jalan Lanang', 'Sarawak', 'East Malaysia', 2.30, 111.82, 0, 'No active flood alerts. Tap refresh for live data.', 0.05, ['Weather API']),
      bintulu: createZone('bintulu', 'Bintulu', 'Kidurong', 'Sarawak', 'East Malaysia', 3.17, 113.04, 0, 'No active flood alerts. Tap refresh for live data.', 0.04, ['Weather API']),
      miri: createZone('miri', 'Miri', 'Lutong', 'Sarawak', 'East Malaysia', 4.41, 114.01, 0, 'No active flood alerts. Tap refresh for live data.', 0.05, ['Weather API']),
      sri_aman: createZone('sri_aman', 'Sri Aman', 'Pekan Sri Aman', 'Sarawak', 'East Malaysia', 1.24, 111.46, 0, 'No active flood alerts. Tap refresh for live data.', 0.05, ['Weather API']),
      kk: createZone('kk', 'Kota Kinabalu', 'Likas', 'Sabah', 'East Malaysia', 5.98, 116.07, 0, 'No active flood alerts. Tap refresh for live data.', 0.05, ['Weather API']),
      sandakan: createZone('sandakan', 'Sandakan', 'Batu Sapi', 'Sabah', 'East Malaysia', 5.83, 118.11, 0, 'No active flood alerts. Tap refresh for live data.', 0.04, ['Weather API']),
      tawau: createZone('tawau', 'Tawau', 'Bandar Tawau', 'Sabah', 'East Malaysia', 4.25, 117.89, 0, 'No active flood alerts. Tap refresh for live data.', 0.04, ['Weather API']),
      keningau: createZone('keningau', 'Keningau', 'Pekan Keningau', 'Sabah', 'East Malaysia', 5.34, 116.16, 0, 'No active flood alerts. Tap refresh for live data.', 0.04, ['Weather API']),
    };
  }
  return floodZonesCache;
};

/**
 * Remove all live_town_* zones for a given state from Firebase RTDB and local cache.
 * Call this before writing new town zones from a refresh so stale high-severity entries
 * don't persist and make states appear incorrectly red.
 */
export const clearStateLiveTownZones = async (state: string): Promise<void> => {
  const stateSlug = state.toLowerCase().replace(/\s+/g, '_');
  try {
    const liveZonesRef = ref(rtdb, 'liveZones');
    const snapshot = await get(liveZonesRef);
    if (snapshot.exists()) {
      const raw = snapshot.val() as Record<string, any>;
      const toDelete = Object.keys(raw).filter(
        (id) =>
          (id.startsWith('live_town_') && id.endsWith(`_${stateSlug}`)) ||
          id === `live_${stateSlug}`
      );
      await Promise.all(toDelete.map((id) => remove(ref(rtdb, `liveZones/${id}`))));
      if (floodZonesCache) {
        toDelete.forEach((id) => { delete floodZonesCache![id]; });
      }
      if (toDelete.length > 0) {
        console.log(`[BILAHUJAN] Cleared ${toDelete.length} stale live_town zones for ${state}`);
      }
    }
  } catch (err) {
    console.warn('[BILAHUJAN] clearStateLiveTownZones failed (non-fatal):', err);
  }
};

export const updateFloodZone = (id: string, updates: Partial<FloodZone>) => {
  if (floodZonesCache && floodZonesCache[id]) {
    floodZonesCache[id] = normalizeFloodLifecycle({ ...floodZonesCache[id], ...updates });
    
    // Save to Firebase
    saveFloodZone(floodZonesCache[id]).catch(err => 
      console.error('Error saving zone to Firebase:', err)
    );
  }
};

export const addFloodZone = (zone: FloodZone): string => {
  if (!floodZonesCache) {
    getFloodZones();
  }

  if (floodZonesCache) {
    // Find if a zone with the same ID or same name+state already exists
    const incomingNameKey = canonicalTownName(zone.name, zone.state);
    const incomingSpecificKey = canonicalTownName(zone.specificLocation || zone.name, zone.state);

    const existingZoneId =
      floodZonesCache[zone.id]
        ? zone.id
        : Object.keys(floodZonesCache).find(id => {
            const existing = floodZonesCache![id];
            const existingNameKey = canonicalTownName(existing.name, existing.state);
            const existingSpecificKey = canonicalTownName(existing.specificLocation || existing.name, existing.state);

            return existing.state === zone.state &&
              (
                (incomingNameKey && (areEquivalentTownNames(incomingNameKey, existingNameKey) || areEquivalentTownNames(incomingNameKey, existingSpecificKey))) ||
                (incomingSpecificKey && (areEquivalentTownNames(incomingSpecificKey, existingNameKey) || areEquivalentTownNames(incomingSpecificKey, existingSpecificKey)))
              );
          });

    if (existingZoneId) {
      const existing = floodZonesCache[existingZoneId];
      const isLiveWeatherZone = zone.id.startsWith('live_');

      const updatedZone = normalizeFloodLifecycle({
        ...existing,
        // Live weather refresh → replace severity (Google Weather is the source of truth for weather).
        // User uploads → take the higher value (cumulative community reports).
        severity: isLiveWeatherZone
          ? zone.severity
          : Math.max(existing.severity, zone.severity),
        forecast: zone.forecast,
        lastUpdated: new Date().toISOString(),
        drainageBlockage: isLiveWeatherZone
          ? zone.drainageBlockage
          : Math.max(existing.drainageBlockage, zone.drainageBlockage),
        rainfall: isLiveWeatherZone
          ? zone.rainfall
          : Math.max(existing.rainfall, zone.rainfall),
        aiConfidence: Math.max(existing.aiConfidence, zone.aiConfidence),
        aiAnalysisText: zone.aiAnalysisText,
        aiAnalysis: zone.aiAnalysis,
        aiRecommendation: zone.aiRecommendation,
        estimatedStartTime: zone.estimatedStartTime || existing.estimatedStartTime,
        estimatedEndTime: zone.estimatedEndTime || existing.estimatedEndTime,
        eventType: zone.eventType || existing.eventType,
        sources: Array.from(new Set([...existing.sources, ...zone.sources])),
        notifiedDepts: zone.notifiedDepts
          ? Array.from(new Set([...(existing.notifiedDepts || []), ...zone.notifiedDepts]))
          : existing.notifiedDepts
      });
      floodZonesCache[existingZoneId] = updatedZone;
      saveFloodZone(updatedZone).catch(err =>
        console.error('Error saving updated zone to Firebase:', err)
      );
      window.dispatchEvent(new CustomEvent('floodZonesUpdated'));
      return existingZoneId;
    } else {
      const normalizedZone = normalizeFloodLifecycle(zone);
      floodZonesCache[zone.id] = normalizedZone;
      saveFloodZone(normalizedZone).catch(err =>
        console.error('Error saving new zone to Firebase:', err)
      );
      window.dispatchEvent(new CustomEvent('floodZonesUpdated'));
      return zone.id;
    }
  }
  return zone.id;
};

export const useFloodZones = () => {
  const [zones, setZones] = useState<Record<string, FloodZone>>(getFloodZones());

  useEffect(() => {
    // Listen to local window events (for same-tab updates)
    const handleUpdate = () => {
      setZones({ ...getFloodZones() });
    };
    window.addEventListener('floodZonesUpdated', handleUpdate);
    window.addEventListener('floodAlert', handleUpdate);

    // Listen to Firebase RTDB liveZones for cross-device / cross-tab sync — data only, no notifications
    const liveZonesRef = ref(rtdb, 'liveZones');
    const unsubscribeFirebase = onValue(liveZonesRef, (snapshot) => {
      if (snapshot.exists()) {
        const rawFirebaseZones = snapshot.val() as Record<string, FloodZone & { isHistorical?: boolean; status?: string }>;
        // Strip parentheticals like "(Default)" from zone names for clean display
        const firebaseZones: Record<string, FloodZone> = {};
        for (const [id, zone] of Object.entries(rawFirebaseZones)) {
          if ((zone as any).isHistorical || (zone as any).status === 'resolved') {
            continue;
          }
          firebaseZones[id] = normalizeFloodLifecycle({
            ...zone,
            name: zone.name.replace(/\s*\(.*?\)\s*/g, '').trim() || zone.name
          });
        }
        // Completely replace local cache with Firebase data
        floodZonesCache = firebaseZones;
        setZones({ ...floodZonesCache });
        // Notify components that zone data changed (UI update only, no alert popups)
        window.dispatchEvent(new CustomEvent('floodZonesUpdated'));
      }
      // If Firebase has no data yet, keep the local defaults as fallback
    });

    return () => {
      window.removeEventListener('floodZonesUpdated', handleUpdate);
      window.removeEventListener('floodAlert', handleUpdate);
      unsubscribeFirebase();
    };
  }, []);

  return zones;
};
