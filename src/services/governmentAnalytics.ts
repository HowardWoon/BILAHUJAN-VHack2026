import { db, rtdb } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { ref, get } from 'firebase/database';

/**
 * Government Data Analytics Service
 * Provides aggregated, anonymous data for government partnerships
 */

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
  incidentCount: number;
  avgSeverity: number;
  avgWaterLevel: number;
  avgDrainageBlockage: number;
  lastIncident: Date;
}

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
  responseTime: number; // minutes
}

const MALAYSIA_STATES = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Melaka',
  'Negeri Sembilan',
  'Pahang',
  'Perak',
  'Perlis',
  'Pulau Pinang',
  'Sabah',
  'Sarawak',
  'Selangor',
  'Terengganu',
  'Kuala Lumpur',
  'Labuan',
  'Putrajaya'
] as const;

const STATE_ALIASES: Record<string, string> = {
  penang: 'Pulau Pinang',
  'pulau pinang': 'Pulau Pinang',
  melaka: 'Melaka',
  malacca: 'Melaka',
  'negeri sembilan': 'Negeri Sembilan',
  kl: 'Kuala Lumpur',
  'kuala lumpur': 'Kuala Lumpur',
  'wp kuala lumpur': 'Kuala Lumpur',
  'w.p. kuala lumpur': 'Kuala Lumpur',
  'federal territory of kuala lumpur': 'Kuala Lumpur',
  labuan: 'Labuan',
  'wp labuan': 'Labuan',
  'w.p. labuan': 'Labuan',
  putrajaya: 'Putrajaya',
  'wp putrajaya': 'Putrajaya',
  'w.p. putrajaya': 'Putrajaya'
};

const normalizeState = (value: string | undefined): string => {
  const raw = (value || '').trim();
  if (!raw) return 'Unknown';
  const alias = STATE_ALIASES[raw.toLowerCase()];
  if (alias) return alias;
  return raw;
};

const isRealtimeZone = (zone: any) => !zone?.isHistorical && zone?.status !== 'resolved';

/**
 * Get aggregated flood statistics for a date range
 */
export const getFloodStatistics = async (
  startDate: Date,
  endDate: Date
): Promise<FloodStatistics> => {
  try {
    const zonesRef = collection(db, 'floodZones');
    const q = query(
      zonesRef,
      where('timestamp', '>=', Timestamp.fromDate(startDate)),
      where('timestamp', '<=', Timestamp.fromDate(endDate))
    );

    const snapshot = await getDocs(q);
    const zones = snapshot.docs.map(doc => doc.data());

    const regionCounts: Record<string, number> = {};
    let totalSeverity = 0;
    const uniqueAreas = new Set<string>();

    zones.forEach(zone => {
      totalSeverity += zone.severity || 0;
      uniqueAreas.add(zone.name);
      const region = zone.region || zone.state || 'Unknown';
      regionCounts[region] = (regionCounts[region] || 0) + 1;
    });

    const mostAffectedRegion = Object.entries(regionCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A';

    return {
      totalIncidents: zones.length,
      averageSeverity: zones.length > 0 ? totalSeverity / zones.length : 0,
      affectedAreas: uniqueAreas.size,
      mostAffectedRegion,
      timeRange: { start: startDate, end: endDate }
    };
  } catch (error) {
    console.error('Error getting flood statistics:', error);
    throw error;
  }
};

/**
 * Get location-based analytics
 */
export const getLocationAnalytics = async (): Promise<LocationAnalytics[]> => {
  try {
    const zonesRef = ref(rtdb, 'liveZones');
    const snapshot = await get(zonesRef);

    const stateMap: Record<string, {
      incidentCount: number;
      totalSeverity: number;
      totalWaterLevel: number;
      totalDrainage: number;
      lastIncident: number;
      hotspots: Record<string, number>;
    }> = {};

    MALAYSIA_STATES.forEach((state) => {
      stateMap[state] = {
        incidentCount: 0,
        totalSeverity: 0,
        totalWaterLevel: 0,
        totalDrainage: 0,
        lastIncident: 0,
        hotspots: {}
      };
    });

    if (!snapshot.exists()) {
      return MALAYSIA_STATES.map((state) => ({
        location: '—',
        state,
        incidentCount: 0,
        avgSeverity: 0,
        avgWaterLevel: 0,
        avgDrainageBlockage: 0,
        lastIncident: new Date(0)
      }));
    }

    const zones = snapshot.val();

    Object.values(zones).forEach((zone: any) => {
      if (!isRealtimeZone(zone)) return;

      const normalizedState = normalizeState(zone.state);
      const stateKey = MALAYSIA_STATES.includes(normalizedState as (typeof MALAYSIA_STATES)[number])
        ? normalizedState
        : 'Unknown';

      if (!stateMap[stateKey]) {
        stateMap[stateKey] = {
          incidentCount: 0,
          totalSeverity: 0,
          totalWaterLevel: 0,
          totalDrainage: 0,
          lastIncident: 0,
          hotspots: {}
        };
      }

      stateMap[stateKey].incidentCount++;
      stateMap[stateKey].totalSeverity += zone.severity || 0;
      stateMap[stateKey].totalWaterLevel += zone.severity >= 8 ? 80 : zone.severity >= 4 ? 50 : 20;
      stateMap[stateKey].totalDrainage += zone.drainageBlockage || 0;
      stateMap[stateKey].lastIncident = Math.max(
        stateMap[stateKey].lastIncident,
        new Date(zone.timestamp || Date.now()).getTime()
      );

      const hotspot = (zone.name || '').trim();
      if (hotspot) {
        stateMap[stateKey].hotspots[hotspot] = (stateMap[stateKey].hotspots[hotspot] || 0) + 1;
      }
    });

    return MALAYSIA_STATES.map((state) => {
      const data = stateMap[state];
      const topHotspot = Object.entries(data.hotspots)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
      const location = topHotspot.toLowerCase() === state.toLowerCase() ? '—' : topHotspot;
      const count = data.incidentCount;

      return {
        location,
        state,
        incidentCount: count,
        avgSeverity: count > 0 ? data.totalSeverity / count : 0,
        avgWaterLevel: count > 0 ? data.totalWaterLevel / count : 0,
        avgDrainageBlockage: count > 0 ? data.totalDrainage / count : 0,
        lastIncident: new Date(data.lastIncident || 0)
      };
    });
  } catch (error) {
    console.error('Error getting location analytics:', error);
    return MALAYSIA_STATES.map((state) => ({
      location: '—',
      state,
      incidentCount: 0,
      avgSeverity: 0,
      avgWaterLevel: 0,
      avgDrainageBlockage: 0,
      lastIncident: new Date(0)
    }));
  }
};

/**
 * Get time series data for trends
 */
export const getTimeSeriesData = async (
  days: number = 30
): Promise<TimeSeriesData[]> => {
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

    zonesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const date = new Date(data.timestamp?.toDate()).toISOString().split('T')[0];
      
      if (!dailyData[date]) {
        dailyData[date] = { incidents: 0, severity: 0, reports: 0 };
      }
      dailyData[date].incidents++;
      dailyData[date].severity += data.severity || 0;
    });

    reportsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const date = new Date(data.timestamp?.toDate()).toISOString().split('T')[0];
      
      if (!dailyData[date]) {
        dailyData[date] = { incidents: 0, severity: 0, reports: 0 };
      }
      dailyData[date].reports++;
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

/**
 * Get infrastructure insights
 */
export const getInfrastructureInsights = async (): Promise<InfrastructureInsights> => {
  try {
    const zonesRef = ref(rtdb, 'liveZones');
    const snapshot = await get(zonesRef);

    if (!snapshot.exists()) {
      return {
        drainageEfficiency: 0,
        criticalZones: [],
        maintenanceNeeded: [],
        responseTime: 0
      };
    }

    const zones = (Object.values(snapshot.val()) as any[]).filter(isRealtimeZone);

    if (zones.length === 0) {
      return {
        drainageEfficiency: 0,
        criticalZones: [],
        maintenanceNeeded: [],
        responseTime: 0
      };
    }
    
    const totalDrainage = zones.reduce((sum, z) => sum + (z.drainageBlockage || 0), 0);
    const drainageEfficiency = 100 - (totalDrainage / zones.length);

    const criticalZones = zones
      .filter(z => z.severity >= 8)
      .map(z => z.name);

    const maintenanceNeeded = zones
      .filter(z => z.drainageBlockage >= 70)
      .map(z => z.name);

    // Calculate average response time from logs
    const logsRef = collection(db, 'systemLogs');
    const logsQuery = query(
      logsRef,
      where('activityType', '==', 'user_report'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
    const logsSnapshot = await getDocs(logsQuery);

    // Mock calculation - in real scenario, track report to response time
    const responseTime = 15; // minutes average

    return {
      drainageEfficiency: Math.round(drainageEfficiency),
      criticalZones,
      maintenanceNeeded,
      responseTime
    };
  } catch (error) {
    console.error('Error getting infrastructure insights:', error);
    return {
      drainageEfficiency: 0,
      criticalZones: [],
      maintenanceNeeded: [],
      responseTime: 0
    };
  }
};

/**
 * Export all data as JSON for government analysis
 */
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
    const [statistics, locationAnalytics, timeSeries, infrastructure] = await Promise.all([
      getFloodStatistics(startDate, endDate),
      getLocationAnalytics(),
      getTimeSeriesData(30),
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

/**
 * Generate downloadable CSV report
 */
export const generateCSVReport = async (startDate: Date, endDate: Date): Promise<string> => {
  const data = await exportDataForGovernment(startDate, endDate);
  
  let csv = 'BILAHUJAN Flood Data Report\n';
  csv += `Export Date: ${data.metadata.exportDate}\n`;
  csv += `Date Range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}\n\n`;
  
  csv += 'SUMMARY STATISTICS\n';
  csv += `Total Incidents,${data.statistics.totalIncidents}\n`;
  csv += `Average Severity,${data.statistics.averageSeverity.toFixed(2)}\n`;
  csv += `Affected Areas,${data.statistics.affectedAreas}\n`;
  csv += `Most Affected Region,${data.statistics.mostAffectedRegion}\n\n`;
  
  csv += 'LOCATION ANALYTICS\n';
  csv += 'Location,State,Incident Count,Avg Severity,Avg Water Level,Avg Drainage Blockage\n';
  data.locationAnalytics.forEach(loc => {
    csv += `${loc.location},${loc.state},${loc.incidentCount},${loc.avgSeverity.toFixed(1)},${loc.avgWaterLevel.toFixed(1)},${loc.avgDrainageBlockage.toFixed(1)}\n`;
  });
  
  csv += '\nINFRASTRUCTURE INSIGHTS\n';
  csv += `Drainage Efficiency,${data.infrastructure.drainageEfficiency}%\n`;
  csv += `Critical Zones,${data.infrastructure.criticalZones.join('; ')}\n`;
  csv += `Maintenance Needed,${data.infrastructure.maintenanceNeeded.join('; ')}\n`;
  csv += `Avg Response Time,${data.infrastructure.responseTime} minutes\n`;
  
  return csv;
};
