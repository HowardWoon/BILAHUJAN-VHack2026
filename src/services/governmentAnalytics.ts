import { db, rtdb } from '../firebase';
import {
  calcAvgResponseTime,
  calcDrainageEfficiency,
  isRealZone,
  isZoneExpired,
  mean,
  normalizeStateName,
  normalizeToTownState,
  severityToBlockage,
  toTimestampMs,
  type AgentAlertLike
} from '../utils/floodCalculations';
import {
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where
} from 'firebase/firestore';
import { get, ref } from 'firebase/database';

export interface FloodStatistics {
  totalIncidents: number;
  averageSeverity: number;
  affectedAreas: number;
  mostAffectedRegion: string;
  drainageEfficiency: number;
  avgResponseTime: number;
  timeRange: { start: Date; end: Date };
}

export interface LocationAnalytics {
  location: string;
  state: string;
  alertZoneId?: string;
  incidentCount: number;
  avgSeverity: number;
  avgWaterLevel: number;
  avgDrainageBlockage: number;
  lastIncident: Date;
}

const WEATHER_WORDS = [
  'cloudy',
  'sunny',
  'rain',
  'drizzle',
  'thunder',
  'thunderstorm',
  'heavy rain',
  'clear',
  'foggy',
  'haze',
  'overcast',
  'shower',
  'storm'
];

// FIXED: BUG-7 — Rewritten to only reject actual weather words, empty strings,
// single chars, and pure numbers. Real place names ("Kuala Lumpur", "Chow Kit",
// "Wangsa Maju", "Sarawak") all pass. Also rejects "live weather:" / "live region"
// placeholder strings that Firebase stores in zone.name for state-level live zones.
function isValidLocationName(name: string): boolean {
  if (!name || name.trim().length < 2) return false;
  const lower = name.toLowerCase().trim();
  // Reject pure weather condition words (exact match or without hyphen/space)
  if (WEATHER_WORDS.some((word) => lower === word || lower === word.replace(' ', ''))) return false;
  // Reject "live weather:..." and "live region" placeholder strings
  if (/^live\s*(weather|region)\b/.test(lower)) return false;
  // Reject pure numbers (e.g. severity values accidentally stored as name)
  if (/^\d+(\.\d+)?$/.test(lower)) return false;
  return true;
}

// FIXED: BUG-4 — Identifies weather-fallback seed zones that should never count
// as real flood incidents in government analytics. Primary signal: severity < 2
// means the zone is a live-weather baseline with no actual flood data.
function isWeatherFallbackZone(zone: any): boolean {
  const sev = Number(zone?.severity ?? 0);
  if (sev < 2) return true;
  if ((zone?.source ?? '') === 'weather_fallback') return true;
  // State-level live zones whose specificLocation is a raw weather string
  // AND whose name exactly matches the state — pure weather baseline, not a hotspot
  const spec = (zone?.specificLocation ?? '').trim();
  if (/^live\s*weather\s*:/i.test(spec)) {
    const zoneName = (zone?.name ?? '').toLowerCase().trim();
    const stateName = (zone?.state ?? '').toLowerCase().trim();
    if (stateName && zoneName === stateName) return true;
  }
  return false;
}

const normalizeLocationLabel = (zone: any, state: string): string => {
  const rawLocation = (zone?.specificLocation || zone?.name || state || 'Unknown').replace(/\s*\(.*?\)\s*/g, ' ').trim();
  const escapedState = state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withoutState = rawLocation
    .replace(new RegExp(`,?\\s*${escapedState}\\s*$`, 'i'), '')
    .replace(/\s+/g, ' ')
    .trim();

  return withoutState || state;
};

const normalizeLocationComparisonText = (value: string, state: string): string => {
  return (value || '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/[,:/\-]+/g, ' ')
    .toLowerCase()
    .replace(new RegExp(`\\b${state.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), ' ')
    .replace(/\b(malaysia|bandar|daerah|pekan|mukim|kampung|kg|jalan|jln|taman|seri|sri|bukit|kota|pusat|kawasan|felda|lembah|padang|simpang|kuala|ayer|air|kebun|lorong|besar|utara|selatan|timur|barat|live|weather|state|overview)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const getZoneStateKey = (zone: any): string => (zone?.state || zone?.region || 'unknown').toString().toLowerCase().replace(/\s+/g, ' ').trim();

const canonicalZoneKey = (zone: any): string => {
  const state = (zone?.state || zone?.region || '').toString().trim();
  const label = normalizeLocationComparisonText(normalizeLocationLabel(zone, state || 'Unknown'), state || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const normalizedState = getZoneStateKey(zone);
  return `${normalizedState}::${label}`;
};

const REALTIME_ZONE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

const isRealtimeZone = (zone: any): boolean => {
  if (zone?.isHistorical || zone?.status === 'resolved') {
    return false;
  }

  const timestamp = toTimestampMs(zone?.timestamp ?? zone?.lastUpdated ?? zone?.reportedAt);
  if (!timestamp) {
    return false;
  }

  return Date.now() - timestamp <= REALTIME_ZONE_MAX_AGE_MS;
};

const areSimilarLocationKeys = (left: string, right: string): boolean => {
  if (!left || !right) return false;
  if (left === right) return true;

  const minLengthForContainment = 4;
  if (
    (left.length >= minLengthForContainment && right.includes(left)) ||
    (right.length >= minLengthForContainment && left.includes(right))
  ) {
    return true;
  }

  const leftTokens = new Set(left.split(' ').filter((token) => token.length >= 3));
  const rightTokens = new Set(right.split(' ').filter((token) => token.length >= 3));
  if (leftTokens.size === 0 || rightTokens.size === 0) return false;

  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) overlap += 1;
  });

  const score = overlap / Math.max(leftTokens.size, rightTokens.size);
  return score >= 0.6;
};

type CanonicalZoneEntry = {
  stateKey: string;
  locationKey: string;
  zone: any;
  score: number;
};

const dedupeAndSortZoneEntries = (zones: any[], score: (zone: any) => number): CanonicalZoneEntry[] => {
  const sortedZones = [...zones].sort((left, right) => score(right) - score(left));
  const grouped: CanonicalZoneEntry[] = [];

  sortedZones.forEach((zone) => {
    const stateKey = getZoneStateKey(zone);
    const key = canonicalZoneKey(zone);
    if (!key) return;

    const [, locationKey = ''] = key.split('::');
    const zoneScore = score(zone);

    const existing = grouped.find(
      (entry) => entry.stateKey === stateKey && areSimilarLocationKeys(entry.locationKey, locationKey)
    );

    if (!existing) {
      grouped.push({ stateKey, locationKey, zone, score: zoneScore });
      return;
    }

    if (zoneScore > existing.score) {
      existing.zone = zone;
      existing.score = zoneScore;
      existing.locationKey = locationKey;
    }
  });

  return grouped.sort((left, right) => right.score - left.score);
};

const dedupeAndSortZoneNames = (zones: any[], score: (zone: any) => number): string[] => {
  const entries = dedupeAndSortZoneEntries(zones, score);
  const seenDisplayNames = new Set<string>();

  return entries
    .map(({ zone }) => {
      const state = zone?.state || zone?.region || 'Unknown';
      return normalizeLocationLabel(zone, state) || state;
    })
    .filter((displayName) => {
      const displayKey = displayName.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!displayKey || seenDisplayNames.has(displayKey)) {
        return false;
      }
      seenDisplayNames.add(displayKey);
      return true;
    });
};

const prioritizeSpecificZonesByState = (zones: any[]): any[] => {
  const stateHasSpecificSignals = new Set<string>();

  zones.forEach((zone) => {
    const zoneId = String(zone?.id || '');
    if (zoneId.startsWith('live_town_') || zoneId.startsWith('user_reported_')) {
      stateHasSpecificSignals.add(getZoneStateKey(zone));
    }
  });

  return zones.filter((zone) => {
    const stateKey = getZoneStateKey(zone);
    const zoneId = String(zone?.id || '');
    const isStateLevelLive = zoneId.startsWith('live_') && !zoneId.startsWith('live_town_');

    if (stateHasSpecificSignals.has(stateKey) && isStateLevelLive) {
      return false;
    }

    return true;
  });
};

export interface TimeSeriesData {
  date: string;
  incidentCount: number;
  avgSeverity: number;
  totalReports: number;
}

export interface InfrastructureInsights {
  drainageEfficiency: number;
  criticalZones: string[];
  maintenanceNeeded: string[];
  responseTime: number;
}

const getZoneSeverity = (zone: any): number => {
  const candidates = [
    zone?.severity,
    zone?.currentSeverity,
    zone?.riskScore,
    zone?.analysisResult?.riskScore
  ];

  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return 0;
};

const isGenericLocationLabel = (value: string): boolean => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === 'unknown' || normalized === 'n/a' || normalized === 'na') return true;
  if (normalized === 'malaysia') return true;
  if (/^malaysia\s*,/.test(normalized)) return true;
  return false;
};

const getZoneAnalyticsLocation = (zone: any): { state: string; location: string } | null => {
  const state = normalizeStateName((zone?.state || zone?.region || 'Unknown').toString().trim()) || 'Unknown';
  const locationSource = (
    zone?.locationName?.trim() ||
    zone?.specificLocation?.trim() ||
    zone?.name?.trim() ||
    zone?.state ||
    'Unknown'
  );

  let location = normalizeToTownState(String(locationSource), undefined).trim();

  if (isGenericLocationLabel(location)) {
    location = normalizeToTownState(state, undefined).trim() || state;
  }

  if (state.toLowerCase() === 'unknown' && isGenericLocationLabel(location)) {
    return null;
  }

  return { state, location };
};

export const getFloodStatistics = async (
  startDate: Date,
  endDate: Date
): Promise<FloodStatistics> => {
  try {
    const zonesSnap = await get(ref(rtdb, 'liveZones'));
    const alertsSnap = await get(ref(rtdb, 'agentAlerts'));

    const zones = zonesSnap.exists() ? (Object.values(zonesSnap.val()) as any[]) : [];
    const agentAlerts = alertsSnap.exists() ? (Object.values(alertsSnap.val()) as AgentAlertLike[]) : [];

    const allZones = zones;
    const incidentZones = allZones.filter((zone: any) => {
      const source = String(zone?.source || '').toLowerCase();
      const hasUserEvidence =
        zone?.reportId != null ||
        zone?.uploadedAt != null ||
        source === 'user' ||
        source === 'citizen_scan';

      return (
        hasUserEvidence &&
        source !== 'baseline' &&
        source !== 'seed' &&
        source !== 'hardcoded'
      );
    });

    const realZones = incidentZones.filter((zone: any) => isRealZone(zone) && !isZoneExpired(zone));

    if (incidentZones.length === 0) {
      return {
        totalIncidents: 0,
        averageSeverity: 0,
        affectedAreas: 0,
        mostAffectedRegion: 'Unknown',
        drainageEfficiency: 100,
        avgResponseTime: 0,
        timeRange: { start: startDate, end: endDate }
      };
    }

    const totalIncidents = incidentZones.length;
    const avgSeverity = mean(incidentZones.map((zone: any) => Number(zone?.severity || 0)));
    const uniqueAreas = new Set(incidentZones.map((zone: any) => zone?.state).filter(Boolean));

    const severeRatio = realZones.filter((zone: any) => Number(zone?.severity || 0) >= 4).length / Math.max(incidentZones.length, 1);
    const avgBlockage = realZones.reduce((sum: number, zone: any) => {
      return sum + severityToBlockage(Number(zone?.severity || 0));
    }, 0) / Math.max(realZones.length, 1);
    const drainageEfficiency = realZones.length === 0
      ? 100
      : Math.max(0, Math.min(100, Math.round(100 - (avgBlockage * severeRatio))));

    const locationMap: Record<
      string,
      {
        zones: any[];
        state: string;
        location: string;
      }
    > = {};

    realZones.forEach((zone: any) => {
      const analyticsLocation = getZoneAnalyticsLocation(zone);
      if (!analyticsLocation) {
        return;
      }

      const { state, location } = analyticsLocation;
      const mapKey = `${state.toLowerCase()}::${location.toLowerCase()}`;

      if (!locationMap[mapKey]) {
        locationMap[mapKey] = {
          zones: [],
          state,
          location
        };
      }

      locationMap[mapKey].zones.push(zone);
    });

    const locationRows = Object.values(locationMap)
      .map((data) => {
        const count = data.zones.length;
        const totalSeverity = data.zones.reduce((sum: number, zone: any) => {
          const severity = typeof zone?.severity === 'number' ? zone.severity : 0;
          return sum + severity;
        }, 0);

        return {
          location: data.location,
          avgSeverity: count > 0 ? Number((totalSeverity / count).toFixed(1)) : 0
        };
      })
      .sort((left, right) => right.avgSeverity - left.avgSeverity);

    const mostAffectedRegion = locationRows.length > 0
      ? locationRows[0].location
      : 'Unknown';

    const avgResponseTime = calcAvgResponseTime(incidentZones, agentAlerts);

    return {
      totalIncidents,
      averageSeverity: Number(avgSeverity.toFixed(1)),
      affectedAreas: uniqueAreas.size,
      mostAffectedRegion,
      drainageEfficiency,
      avgResponseTime,
      timeRange: { start: startDate, end: endDate }
    };
  } catch (error) {
    console.error('getFloodStatistics error:', error);
    return {
      totalIncidents: 0,
      averageSeverity: 0,
      affectedAreas: 0,
      mostAffectedRegion: 'Error',
      drainageEfficiency: 0,
      avgResponseTime: 0,
      timeRange: { start: startDate, end: endDate }
    };
  }
};

export const getLocationAnalytics = async (): Promise<LocationAnalytics[]> => {
  try {
    const zonesSnap = await get(ref(rtdb, 'liveZones'));
    if (!zonesSnap.exists()) {
      return [];
    }

    const allZones = Object.values(zonesSnap.val()) as any[];
    const zones = allZones.filter((zone: any) => isRealZone(zone) && !isZoneExpired(zone));

    const locationMap: Record<
      string,
      {
        zones: any[];
        state: string;
        location: string;
        topZoneId?: string;
        topSeverity: number;
      }
    > = {};

    zones.forEach((zone: any) => {
      const analyticsLocation = getZoneAnalyticsLocation(zone);
      if (!analyticsLocation) {
        return;
      }

      const { state, location } = analyticsLocation;
      const mapKey = `${state.toLowerCase()}::${location.toLowerCase()}`;

      if (!locationMap[mapKey]) {
        locationMap[mapKey] = {
          zones: [],
          state,
          location,
          topZoneId: zone?.id,
          topSeverity: 0
        };
      }

      locationMap[mapKey].zones.push(zone);

      const severity = typeof zone?.severity === 'number' ? zone.severity : 0;
      if (severity > locationMap[mapKey].topSeverity) {
        locationMap[mapKey].topSeverity = severity;
        locationMap[mapKey].topZoneId = zone?.id;
      }
    });

    return Object.values(locationMap)
      .map((data) => {
        const count = data.zones.length;
        const totalSeverity = data.zones.reduce((sum: number, zone: any) => {
          const severity = typeof zone?.severity === 'number' ? zone.severity : 0;
          return sum + severity;
        }, 0);

        const totalWater = data.zones.reduce((sum: number, zone: any) => {
          const severity = typeof zone?.severity === 'number' ? zone.severity : 0;
          return sum + (severity >= 8 ? 80 : severity >= 4 ? 50 : 20);
        }, 0);

        const totalDrainage = data.zones.reduce((sum: number, zone: any) => {
          const blockage = typeof zone?.drainageBlockage === 'number'
            ? zone.drainageBlockage
            : severityToBlockage(Number(zone?.severity || 1));
          return sum + blockage;
        }, 0);

        const lastTimestamp = Math.max(...data.zones.map((zone: any) => toTimestampMs(zone?.timestamp)));

        return {
          location: data.location,
          state: data.state,
          alertZoneId: data.topZoneId,
          incidentCount: count,
          avgSeverity: count > 0 ? Number((totalSeverity / count).toFixed(1)) : 0,
          avgWaterLevel: count > 0 ? totalWater / count : 0,
          avgDrainageBlockage: count > 0 ? totalDrainage / count : 0,
          lastIncident: new Date(lastTimestamp || Date.now())
        };
      })
      .sort((left, right) => right.avgSeverity - left.avgSeverity);
  } catch (error) {
    console.error('getLocationAnalytics error:', error);
    return [];
  }
};

export const getTimeSeriesData = async (days: number = 30): Promise<TimeSeriesData[]> => {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const zonesRef = collection(db, 'floodZones');
    const reportsRef = collection(db, 'reports');

    const zonesQuery = query(
      zonesRef,
      where('timestamp', '>=', Timestamp.fromDate(startDate)),
      orderBy('timestamp', 'asc')
    );

    const reportsQuery = query(
      reportsRef,
      where('timestamp', '>=', Timestamp.fromDate(startDate)),
      orderBy('timestamp', 'asc')
    );

    const [zonesSnapshot, reportsSnapshot] = await Promise.all([
      getDocs(zonesQuery),
      getDocs(reportsQuery)
    ]);

    const dailyData: Record<string, { incidents: number; severity: number; reports: number }> = {};

    zonesSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const date = new Date(data.timestamp?.toDate()).toISOString().split('T')[0];

      if (!dailyData[date]) {
        dailyData[date] = { incidents: 0, severity: 0, reports: 0 };
      }

      dailyData[date].incidents += 1;
      dailyData[date].severity += data.severity || 0;
    });

    reportsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const date = new Date(data.timestamp?.toDate()).toISOString().split('T')[0];

      if (!dailyData[date]) {
        dailyData[date] = { incidents: 0, severity: 0, reports: 0 };
      }

      dailyData[date].reports += 1;
    });

    return Object.entries(dailyData).map(([date, data]) => ({
      date,
      incidentCount: data.incidents,
      avgSeverity: data.incidents > 0 ? data.severity / data.incidents : 0,
      totalReports: data.reports
    }));
  } catch (error) {
    console.error('Error getting time series data:', error);
    return [];
  }
};

export const getInfrastructureInsights = async (): Promise<InfrastructureInsights> => {
  try {
    const zonesSnap = await get(ref(rtdb, 'liveZones'));
    const alertsSnap = await get(ref(rtdb, 'agentAlerts'));
    if (!zonesSnap.exists()) {
      return {
        drainageEfficiency: 100,
        criticalZones: [],
        maintenanceNeeded: [],
        responseTime: 15
      };
    }

    const zones = (Object.values(zonesSnap.val()) as any[])
      .filter(isRealtimeZone)
      .filter((zone: any) => isRealZone(zone) && !isZoneExpired(zone));
    const agentAlerts = alertsSnap.exists() ? (Object.values(alertsSnap.val()) as AgentAlertLike[]) : [];

    const criticalEntries = dedupeAndSortZoneEntries(
      zones.filter((zone) => getZoneSeverity(zone) >= 8),
      (zone) => getZoneSeverity(zone)
    );

    const criticalZones = dedupeAndSortZoneNames(
      criticalEntries.map((entry) => entry.zone),
      (zone) => getZoneSeverity(zone)
    );

    const maintenanceCandidates = zones.filter((zone) => (zone?.drainageBlockage ?? 0) >= 65);
    const maintenanceWithoutCriticalOverlap = maintenanceCandidates.filter((zone) => {
      const stateKey = getZoneStateKey(zone);
      const key = canonicalZoneKey(zone);
      const [, locationKey = ''] = key.split('::');

      return !criticalEntries.some(
        (entry) => entry.stateKey === stateKey && areSimilarLocationKeys(entry.locationKey, locationKey)
      );
    });

    const maintenanceNeeded = dedupeAndSortZoneNames(
      maintenanceWithoutCriticalOverlap,
      (zone) => (typeof zone?.drainageBlockage === 'number' ? zone.drainageBlockage : 0)
    );

    const drainageEfficiency = calcDrainageEfficiency(zones);
    const responseTime = calcAvgResponseTime(zones, agentAlerts);

    return {
      drainageEfficiency,
      criticalZones,
      maintenanceNeeded,
      responseTime: Number.isFinite(responseTime) ? responseTime : 0
    };
  } catch (error) {
    console.error('getInfrastructureInsights error:', error);
    return {
      drainageEfficiency: 0,
      criticalZones: [],
      maintenanceNeeded: [],
      responseTime: 15
    };
  }
};

export const exportDataForGovernment = async (
  startDate: Date,
  endDate: Date
): Promise<{
  statistics: FloodStatistics;
  locationAnalytics: LocationAnalytics[];
  timeSeries: TimeSeriesData[];
  infrastructure: InfrastructureInsights;
  metadata: {
    exportDate: string;
    dataSource: string;
    privacyCompliant: boolean;
  };
}> => {
  try {
    const daySpan = Math.max(
      1,
      Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
    );

    const [statistics, locationAnalytics, timeSeries, infrastructure] = await Promise.all([
      getFloodStatistics(startDate, endDate),
      getLocationAnalytics(),
      getTimeSeriesData(daySpan),
      getInfrastructureInsights()
    ]);

    return {
      statistics,
      locationAnalytics,
      timeSeries,
      infrastructure,
      metadata: {
        exportDate: new Date().toISOString(),
        dataSource: 'BILAHUJAN App - Anonymous Flood Monitoring',
        privacyCompliant: true
      }
    };
  } catch (error) {
    console.error('Error exporting data:', error);
    throw error;
  }
};

export const generateCSVReport = async (startDate: Date, endDate: Date): Promise<string> => {
  const data = await exportDataForGovernment(startDate, endDate);

  let csv = 'BILAHUJAN Flood Data Report\n';
  csv += `Export Date,${data.metadata.exportDate}\n`;
  csv += `Date Range,${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}\n\n`;

  csv += 'SUMMARY STATISTICS\n';
  csv += `Total Incidents,${data.statistics.totalIncidents}\n`;
  csv += `Average Severity,${data.statistics.averageSeverity.toFixed(2)}\n`;
  csv += `Affected Areas,${data.statistics.affectedAreas}\n`;
  csv += `Most Affected Region,${data.statistics.mostAffectedRegion}\n\n`;

  csv += 'LOCATION ANALYTICS\n';
  csv += 'Location,State,Incident Count,Avg Severity,Avg Water Level,Avg Drainage Blockage\n';
  data.locationAnalytics.forEach((location) => {
    csv += `${location.location},${location.state},${location.incidentCount},${location.avgSeverity.toFixed(1)},${location.avgWaterLevel.toFixed(1)},${location.avgDrainageBlockage.toFixed(1)}\n`;
  });

  csv += '\nINFRASTRUCTURE INSIGHTS\n';
  csv += `Drainage Efficiency,${data.infrastructure.drainageEfficiency}%\n`;
  csv += `Critical Zones,${data.infrastructure.criticalZones.join('; ')}\n`;
  csv += `Maintenance Needed,${data.infrastructure.maintenanceNeeded.join('; ')}\n`;
  csv += `Avg Response Time,${data.infrastructure.responseTime} minutes\n`;

  return csv;
};
