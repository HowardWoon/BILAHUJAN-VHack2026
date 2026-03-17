import { db, rtdb } from '../firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  setDoc,
  getDocs,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { ref, set, onValue, update, get } from 'firebase/database';
import type { FloodZone } from '../data/floodZones';
import { FloodAnalysisResult } from './gemini';

// Collection names
const COLLECTIONS = {
  FLOOD_ZONES: 'floodZones',
  REPORTS: 'reports',
  ANALYSIS: 'analysisResults',
  SENSORS: 'sensorData',
  AUDIO_ANALYSIS: 'audioAnalysis',
  SYSTEM_LOGS: 'systemLogs'
};

// Real-time Database paths
const RTDB_PATHS = {
  LIVE_ZONES: 'liveZones',
  LIVE_REPORTS: 'liveReports',
  LIVE_SENSORS: 'liveSensors',
  HEARTBEAT: 'systemHeartbeat'
};

/**
 * Initialize 24/7 data collection system
 */
export const initializeDataCollection = () => {
  console.log('🔄 Initializing 24/7 data collection system...');
  
  // Start heartbeat monitoring
  startSystemHeartbeat();
  
  // Initialize listeners
  initializeRealtimeListeners();
  
  console.log('✅ Data collection system active');
};

/**
 * System heartbeat - updates every minute to show system is active
 */
let heartbeatInterval: NodeJS.Timeout | null = null;

const startSystemHeartbeat = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  const updateHeartbeat = () => {
    const heartbeatRef = ref(rtdb, `${RTDB_PATHS.HEARTBEAT}/status`);
    set(heartbeatRef, {
      lastUpdate: new Date().toISOString(),
      status: 'active',
      timestamp: Date.now()
    }).catch(err => console.error('Heartbeat error:', err));
  };

  // Initial heartbeat
  updateHeartbeat();
  
  // Update every minute
  heartbeatInterval = setInterval(updateHeartbeat, 60000);
};

/**
 * Save flood zone data to Firebase
 */
export const saveFloodZone = async (zone: FloodZone): Promise<string> => {
  try {
    // Save to Firestore for historical data
    const zoneDoc = doc(db, COLLECTIONS.FLOOD_ZONES, zone.id);
    await setDoc(zoneDoc, {
      ...zone,
      timestamp: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    // Save to Realtime Database for live updates
    const liveZoneRef = ref(rtdb, `${RTDB_PATHS.LIVE_ZONES}/${zone.id}`);
    await set(liveZoneRef, {
      ...zone,
      timestamp: Date.now()
    });

    // Log the activity
    await logSystemActivity('flood_zone_update', {
      zoneId: zone.id,
      severity: zone.severity,
      location: zone.name
    });

    console.log(`✅ Flood zone ${zone.id} saved to Firebase`);
    return zone.id;
  } catch (error) {
    console.error('Error saving flood zone:', error);
    throw error;
  }
};

/**
 * Save user report to Firebase
 */
export interface UserReport {
  id?: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  details: string;
  imageUrl?: string;
  notifiedDepts?: string[];
  analysisResult?: FloodAnalysisResult;
  timestamp?: any;
  status: 'pending' | 'processing' | 'completed';
}

export const saveUserReport = async (report: UserReport): Promise<string> => {
  try {
    // Save to Firestore
    const reportsRef = collection(db, COLLECTIONS.REPORTS);
    const docRef = await addDoc(reportsRef, {
      ...report,
      timestamp: serverTimestamp(),
      status: report.status || 'pending'
    });

    // Save to Realtime Database for live monitoring
    const liveReportRef = ref(rtdb, `${RTDB_PATHS.LIVE_REPORTS}/${docRef.id}`);
    await set(liveReportRef, {
      ...report,
      id: docRef.id,
      timestamp: Date.now()
    });

    // Log the activity
    await logSystemActivity('user_report', {
      reportId: docRef.id,
      location: report.location.address,
      hasDepts: !!report.notifiedDepts?.length
    });

    console.log(`✅ User report ${docRef.id} saved to Firebase`);
    return docRef.id;
  } catch (error) {
    console.error('Error saving report:', error);
    throw error;
  }
};

/**
 * Save analysis result to Firebase
 */
export const saveAnalysisResult = async (
  analysisResult: FloodAnalysisResult,
  imageUrl: string,
  location?: { lat: number; lng: number; address: string }
): Promise<string> => {
  try {
    const analysisRef = collection(db, COLLECTIONS.ANALYSIS);
    const docRef = await addDoc(analysisRef, {
      ...analysisResult,
      imageUrl,
      location,
      timestamp: serverTimestamp(),
      processedAt: new Date().toISOString()
    });

    // Log the activity
    await logSystemActivity('analysis_completed', {
      analysisId: docRef.id,
      severity: analysisResult.severity,
      riskScore: analysisResult.riskScore
    });

    console.log(`✅ Analysis result ${docRef.id} saved to Firebase`);
    return docRef.id;
  } catch (error) {
    console.error('Error saving analysis:', error);
    throw error;
  }
};

/**
 * Save audio analysis to Firebase
 */
export interface AudioAnalysisData {
  location?: { lat: number; lng: number; address: string };
  analysis: any;
  audioUrl?: string;
  duration?: number;
}

export const saveAudioAnalysis = async (data: AudioAnalysisData): Promise<string> => {
  try {
    const audioRef = collection(db, COLLECTIONS.AUDIO_ANALYSIS);
    const docRef = await addDoc(audioRef, {
      ...data,
      timestamp: serverTimestamp()
    });

    await logSystemActivity('audio_analysis', {
      analysisId: docRef.id,
      location: data.location?.address || 'unknown'
    });

    console.log(`✅ Audio analysis ${docRef.id} saved to Firebase`);
    return docRef.id;
  } catch (error) {
    console.error('Error saving audio analysis:', error);
    throw error;
  }
};

/**
 * Save sensor data (simulated for now, can be replaced with real sensors)
 */
export interface SensorData {
  zoneId: string;
  type: 'water_level' | 'rainfall' | 'flow_rate' | 'temperature' | 'humidity';
  value: number;
  unit: string;
  location: { lat: number; lng: number };
}

export const saveSensorData = async (sensorData: SensorData): Promise<void> => {
  try {
    // Use Realtime Database for high-frequency sensor data
    const sensorRef = ref(rtdb, `${RTDB_PATHS.LIVE_SENSORS}/${sensorData.zoneId}/${sensorData.type}`);
    await set(sensorRef, {
      ...sensorData,
      timestamp: Date.now()
    });

    // Also save to Firestore for historical analysis (with sampling)
    // Only save every 10th reading to avoid overwhelming Firestore
    if (Math.random() < 0.1) {
      const sensorsRef = collection(db, COLLECTIONS.SENSORS);
      await addDoc(sensorsRef, {
        ...sensorData,
        timestamp: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error saving sensor data:', error);
  }
};

/**
 * Log system activity
 */
export const logSystemActivity = async (
  activityType: string,
  metadata: Record<string, any>
): Promise<void> => {
  try {
    const logsRef = collection(db, COLLECTIONS.SYSTEM_LOGS);
    await addDoc(logsRef, {
      activityType,
      metadata,
      timestamp: serverTimestamp(),
      date: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

/**
 * Initialize realtime listeners for incoming data
 */
const initializeRealtimeListeners = () => {
  // Listen for live zone updates
  const liveZonesRef = ref(rtdb, RTDB_PATHS.LIVE_ZONES);
  onValue(liveZonesRef, (snapshot) => {
    if (snapshot.exists()) {
      const zones = snapshot.val();
      window.dispatchEvent(new CustomEvent('firebaseZonesUpdate', { detail: zones }));
    }
  });

  // Listen for live reports
  const liveReportsRef = ref(rtdb, RTDB_PATHS.LIVE_REPORTS);
  onValue(liveReportsRef, (snapshot) => {
    if (snapshot.exists()) {
      const reports = snapshot.val();
      window.dispatchEvent(new CustomEvent('firebaseReportsUpdate', { detail: reports }));
    }
  });
};

/**
 * Continuous monitoring - simulates sensor data collection
 * Call this to start continuous background data collection
 */
let monitoringInterval: NodeJS.Timeout | null = null;

export const startContinuousMonitoring = (zones: Record<string, FloodZone>) => {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }

  const realZoneCount = Object.values(zones).filter((zone: any) => zone?.reportId != null).length;
  console.log(`🔄 Continuous monitoring is passive mode (real zones: ${realZoneCount})`);
};

/**
 * Stop continuous monitoring
 */
export const stopContinuousMonitoring = () => {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('⏸️ Continuous monitoring stopped');
  }
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
};

/**
 * Get recent reports from Firebase
 */
export const getRecentReports = async (limitCount: number = 10): Promise<UserReport[]> => {
  try {
    const reportsRef = collection(db, COLLECTIONS.REPORTS);
    const q = query(reportsRef, orderBy('timestamp', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as UserReport));
  } catch (error) {
    console.error('Error fetching reports:', error);
    return [];
  }
};

/**
 * Get flood zones from Firebase
 */
export const getFloodZonesFromFirebase = async (): Promise<Record<string, FloodZone>> => {
  try {
    const zonesRef = ref(rtdb, RTDB_PATHS.LIVE_ZONES);
    const snapshot = await get(zonesRef);
    
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return {};
  } catch (error) {
    console.error('Error fetching zones:', error);
    return {};
  }
};

/**
 * Update report status
 */
export const updateReportStatus = async (
  reportId: string, 
  status: 'pending' | 'processing' | 'completed'
): Promise<void> => {
  try {
    const reportDoc = doc(db, COLLECTIONS.REPORTS, reportId);
    await updateDoc(reportDoc, {
      status,
      updatedAt: serverTimestamp()
    });

    // Also update in realtime database
    const liveReportRef = ref(rtdb, `${RTDB_PATHS.LIVE_REPORTS}/${reportId}`);
    await update(liveReportRef, {
      status,
      updatedAt: Date.now()
    });

    console.log(`✅ Report ${reportId} status updated to ${status}`);
  } catch (error) {
    console.error('Error updating report status:', error);
    throw error;
  }
};
