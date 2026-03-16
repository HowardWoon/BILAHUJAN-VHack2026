import { db, rtdb } from '../firebase';
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

function isValidLocationName(name: string): boolean {
  if (!name || name.trim().length < 2) {
    return false;
  }

  const lower = name.toLowerCase().trim();
  return !WEATHER_WORDS.some((word) => lower === word || lower === word.replace(' ', ''));
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

const toTimestampMs = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }

  if (typeof value === 'string') {
    if (/^\d+$/.test(value.trim())) {
      const numeric = Number(value.trim());
      if (Number.isFinite(numeric)) {
        return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
      }
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  if (value && typeof value === 'object') {
    const maybeSeconds = (value as any).seconds;
    if (typeof maybeSeconds === 'number' && Number.isFinite(maybeSeconds)) {
      return maybeSeconds * 1000;
    }
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  return 0;
};

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

export const getFloodStatistics = async (
  startDate: Date,
  endDate: Date
): Promise<FloodStatistics> => {
  try {
    const zonesSnap = await get(ref(rtdb, 'liveZones'));
    const reportsSnap = await get(ref(rtdb, 'liveReports'));

    const zones = zonesSnap.exists() ? (Object.values(zonesSnap.val()) as any[]) : [];
    const reports = reportsSnap.exists() ? (Object.values(reportsSnap.val()) as any[]) : [];

    const startMs = startDate.getTime();
    const endMs = endDate.getTime();

    const filteredZones = zones.filter((zone: any) => {
      const timestamp = toTimestampMs(zone?.timestamp);
      return timestamp >= startMs && timestamp <= endMs;
    });

    const activeZones = filteredZones.length > 0 ? filteredZones : zones;

    if (activeZones.length === 0) {
      return {
        totalIncidents: 0,
        averageSeverity: 0,
        affectedAreas: 0,
        mostAffectedRegion: 'No Data',
        timeRange: { start: startDate, end: endDate }
      };
    }

    const meaningfulZones = activeZones.filter((zone: any) => {
      return (
        (zone?.severity ?? 0) >= 2 ||
        zone?.isUserReport === true ||
        zone?.isHistorical === true ||
        zone?.analysisResult != null ||
        zone?.source === 'citizen_scan'
      );
    });

    const zonesForAvg = meaningfulZones.length > 0 ? meaningfulZones : activeZones;
    const totalSeverity = zonesForAvg.reduce((sum: number, zone: any) => {
      const severity = typeof zone?.severity === 'number' ? zone.severity : 1;
      return sum + severity;
    }, 0);

    const avgSeverity = zonesForAvg.length > 0 ? totalSeverity / zonesForAvg.length : 0;
    const uniqueAreas = new Set(activeZones.map((zone: any) => zone?.state || zone?.name).filter(Boolean));

    const regionCounts: Record<string, number> = {};
    activeZones.forEach((zone: any) => {
      const region = zone?.region || zone?.state || 'Unknown';
      regionCounts[region] = (regionCounts[region] || 0) + 1;
    });

    const mostAffectedRegion =
      Object.entries(regionCounts).sort(([, left], [, right]) => right - left)[0]?.[0] || 'N/A';

    return {
      totalIncidents: activeZones.length + reports.length,
      averageSeverity: avgSeverity,
      affectedAreas: uniqueAreas.size,
      mostAffectedRegion,
      timeRange: { start: startDate, end: endDate }
    };
  } catch (error) {
    console.error('getFloodStatistics error:', error);
    return {
      totalIncidents: 0,
      averageSeverity: 0,
      affectedAreas: 0,
      mostAffectedRegion: 'Error',
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

    const zones = prioritizeSpecificZonesByState(
      (Object.values(zonesSnap.val()) as any[]).filter(isRealtimeZone)
    );

    const stateMap: Record<
      string,
      {
        zones: any[];
        topLocation: string;
        topZoneId?: string;
        topSeverity: number;
      }
    > = {};

    zones.forEach((zone: any) => {
      const state = zone?.state || zone?.region || 'Unknown';
      const candidateName = zone?.name || zone?.address || state;
      const safeTopLocation = isValidLocationName(candidateName) ? candidateName : (zone?.address || state);

      if (!stateMap[state]) {
        stateMap[state] = {
          zones: [],
          topLocation: safeTopLocation,
          topZoneId: zone?.id,
          topSeverity: 0
        };
      }

      stateMap[state].zones.push(zone);

      const severity = typeof zone?.severity === 'number' ? zone.severity : 0;
      if (severity > stateMap[state].topSeverity) {
        stateMap[state].topSeverity = severity;
        stateMap[state].topLocation = safeTopLocation;
        stateMap[state].topZoneId = zone?.id;
      }
    });

    return Object.entries(stateMap)
      .map(([state, data]) => {
        const bestLocation =
          [...data.zones]
            .sort((left: any, right: any) => (right?.severity ?? 0) - (left?.severity ?? 0))
            .map((zone: any) => zone?.name || zone?.address || '')
            .find((name: string) => isValidLocationName(name) && name.trim().toLowerCase() !== state.trim().toLowerCase()) ??
          data.topLocation;

        const count = data.zones.length;
        const totalSeverity = data.zones.reduce((sum: number, zone: any) => {
          const severity = typeof zone?.severity === 'number' ? zone.severity : 1;
          return sum + severity;
        }, 0);

        const totalWater = data.zones.reduce((sum: number, zone: any) => {
          const severity = typeof zone?.severity === 'number' ? zone.severity : 0;
          return sum + (severity >= 8 ? 80 : severity >= 4 ? 50 : 20);
        }, 0);

        const totalDrainage = data.zones.reduce((sum: number, zone: any) => {
          const blockage = typeof zone?.drainageBlockage === 'number' ? zone.drainageBlockage : 0;
          return sum + blockage;
        }, 0);

        const lastTimestamp = Math.max(...data.zones.map((zone: any) => toTimestampMs(zone?.timestamp)));

        return {
          location: bestLocation,
          state,
          alertZoneId: data.topZoneId,
          incidentCount: count,
          avgSeverity: count > 0 ? totalSeverity / count : 0,
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
    if (!zonesSnap.exists()) {
      return {
        drainageEfficiency: 100,
        criticalZones: [],
        maintenanceNeeded: [],
        responseTime: 15
      };
    }

    const zones = (Object.values(zonesSnap.val()) as any[]).filter(isRealtimeZone);

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

    const avgBlockage =
      zones.length > 0
        ? zones.reduce((sum, zone) => sum + (zone?.drainageBlockage ?? 10), 0) / zones.length
        : 0;

    const drainageEfficiency = Math.round(Math.max(0, 100 - avgBlockage));

    let responseTime = 15;
    try {
      const missionSnap = await get(ref(rtdb, 'missionLogs'));
      if (missionSnap.exists()) {
        const missions = Object.values(missionSnap.val()) as any[];
        const completed = missions.filter(
          (mission) => mission?.status === 'completed' && mission?.startTime && mission?.endTime
        );

        if (completed.length > 0) {
          const avgMs =
            completed.reduce((sum: number, mission: any) => {
              return (
                sum +
                (new Date(mission.endTime).getTime() - new Date(mission.startTime).getTime())
              );
            }, 0) / completed.length;

          responseTime = Math.max(1, Math.round(avgMs / 60000));
        }
      }
    } catch {
      responseTime = 15;
    }

    if (!Number.isFinite(responseTime) || responseTime <= 0) {
      responseTime = 15;
    }

    return {
      drainageEfficiency,
      criticalZones,
      maintenanceNeeded,
      responseTime
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
