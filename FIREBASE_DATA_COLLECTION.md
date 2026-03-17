# BILAHUJAN Data Collection & Storage Architecture

## Overview
BILAHUJAN implements a **real-time, event-driven data collection system** aligned with the Firebase Realtime Database and Firestore. The system is designed for:
- **Live zone monitoring** (flood incidents, weather baselines, user reports)
- **Report aggregation** (citizen submissions with geolocation and image analysis)
- **Government analytics** (state-level statistics, location analytics, infrastructure metrics)
- **Agent mission logging** (autonomous Command Agent task execution and dispatch records)

---

## Firebase Data Structure

### 1. **Realtime Database (`liveZones`)**

Each flood zone document contains:

```json
{
  "id": "user_reported_1708123456_abc123",
  "name": "Chow Kit, Kuala Lumpur",
  "locationName": "Chow Kit, Kuala Lumpur",
  "state": "Kuala Lumpur",
  "lat": 3.1456,
  "lng": 101.6789,
  "center": { "lat": 3.1456, "lng": 101.6789 },
  "severity": 7,
  "rainfall": 45,
  "drainageBlockage": 78,
  "source": "user",
  "reportId": "report_user_reported_1708123456_abc123_1708123456",
  "uploadedAt": 1708123456000,
  "firstReportedAt": 1708123456000,
  "startTime": "2026-02-17T10:30:00Z",
  "eventType": "Flash Flood",
  "waterDepth": "Knee-level",
  "aiAnalysisText": "...",
  "aiConfidence": 85,
  "status": "active",
  "timestamp": 1708123456000
}
```

**Key Changes (v2.0)**:
- ✅ `reportId` field links zone to citizen report
- ✅ `uploadedAt` / `firstReportedAt` timestamps for analytics
- ✅ `source: "user"` distinguishes real incidents from baselines
- ✅ `isWeatherFallbackZone` indicator for weather-only zones (not counted in real statistics)

---

### 2. **Realtime Database (`liveReports`)**

Each citizen report:

```json
{
  "id": "report_user_reported_1708123456_abc123_1708123456",
  "zoneId": "user_reported_1708123456_abc123",
  "state": "Kuala Lumpur",
  "locationName": "Chow Kit, Kuala Lumpur",
  "severity": 7,
  "source": "user",
  "timestamp": 1708123456000,
  "description": "Water rising fast at Chow Kit intersection"
}
```

---

### 3. **Realtime Database (`agentAlerts`)**

When Command Agent dispatches to authorities:

```json
{
  "zoneId": "user_reported_1708123456_abc123",
  "state": "Kuala Lumpur",
  "dispatchedAt": 1708123456000,
  "alertType": "CRITICAL",
  "recipients": ["JPS", "NADMA", "APM"]
}
```

---

### 4. **Cloud Firestore (`reports` collection)**

Long-term archive of all citizen submissions:

```json
{
  "state": "Kuala Lumpur",
  "location": {
    "lat": 3.1456,
    "lng": 101.6789,
    "address": "Chow Kit, Kuala Lumpur"
  },
  "analysisResult": { /* Gemini AI response object */ },
  "timestamp": 1708123456000,
  "severity": 7,
  "source": "user",
  "zoneId": "user_reported_1708123456_abc123",
  "reportId": "report_...",
  "reportCount": 1
}
```

---

## Data Collection Services

### 1. **dataCollection.ts** — Passive Monitoring

```typescript
export const startContinuousMonitoring = (zones: Record<string, FloodZone>) => {
  const realZoneCount = Object.values(zones)
    .filter((zone: any) => zone?.reportId != null)
    .length;
  
  console.log(`🔄 Continuous monitoring is passive mode (real zones: ${realZoneCount})`);
};
```

**Status**: System operates in **passive mode** — it no longer simulates sensor data. Real zones are counted only when they have a `reportId` (user-reported).

### 2. **governmentAnalytics.ts** — Real-Time Dashboard

Computes:
- **Total Incidents** = count of real zones (severity >= 2 + reportId present)
- **Average Severity** = mean severity across real zones only
- **Affected Areas** = count of unique states
- **Drainage Efficiency** = 100 - (average blockage × severity ratio)
- **Avg Response Time** = from first report to agent dispatch

**Filters out**:
- ❌ Weather baselines (`isWeatherFallbackZone: true`)
- ❌ Seed zones (`source: "baseline"` or `"seed"`)
- ❌ Zones with `severity < 2`

---

## Location Name Normalization

All places are normalized using `normalizeToTownState()`:

```typescript
// Input: "5, Jalan Tun Perak, 50050, Kuala Lumpur, Malaysia"
// Output: "Chow Kit, Kuala Lumpur"
```

**Utility**: `src/utils/floodCalculations.ts`
- `normalizeStateName()` — state name standardization
- `deduplicateFTName()` — fixes "Kuala Lumpur, Kuala Lumpur" → "Kuala Lumpur"
- `normalizeToTownState()` — full address to "Town, State" format
- `trimToCity()` — fallback for display

---

## Report Submission Flow

1. **User uploads photo** → ReportScreen
2. **Gemini analyzes image** → `analyzeFloodImage()` in gemini.ts
3. **Result saved to Firebase** → `liveZones/{zoneId}` + `liveReports/{reportId}`
4. **Government Dashboard updates** → real-time listeners sync analytics
5. **If severity >= 7** → Command Agent dispatches → `agentAlerts/{zoneId}`

---

## Data Cleanup Utilities

**File**: `src/utils/cleanupSeedZones.ts`

Maintenance functions:

```typescript
await purgeHardcodedSeedZones();          // Remove baseline zones
await fixFederalTerritoryDuplicates();     // "Kuala Lumpur, Kuala Lumpur" → "Kuala Lumpur"
await deduplicateBaselineZones();          // Remove duplicate monitoring zones
await resetBaselineSeverities();           // Baseline zones always severity 1
await migrateLocationNames();              // Re-geocode and update location names
```

5. **Sensor Data** (`saveSensorData`)
   - High-frequency sensor readings
   - Uses Realtime Database for speed
   - Sampled to Firestore (10% of readings) for historical analysis
   - RTDB Path: `liveSensors/{zoneId}/{sensorType}`

6. **System Logs** (`logSystemActivity`)
   - Activity logging for monitoring
   - Collection: `systemLogs`
   - Tracks all major system events

### 3. Integration Points

#### **App.tsx**
- Initializes data collection system on app start
- Starts continuous monitoring with current flood zones
- Automatic cleanup on app unmount

#### **floodZones.ts**
- `updateFloodZone()` - Automatically saves updates to Firebase
- `addFloodZone()` - Automatically saves new zones to Firebase

#### **ReportScreen.tsx**
- `handleSubmit()` - Saves user reports to Firebase
- Saves analysis results with location data
- Updates linked to zones

#### **MapScreen.tsx**
- Audio analysis automatically saved to Firebase
- Includes location data when available

### 4. Real-time Listeners
The system listens for updates from Firebase and dispatches events:
- `firebaseZonesUpdate` - When flood zones are updated
- `firebaseReportsUpdate` - When new reports are submitted

## Firebase Database Structure

### Firestore Collections
```
/floodZones/{zoneId}
  - All flood zone data
  - Updated with serverTimestamp

/reports/{reportId}
  - User submitted reports
  - Status: pending | processing | completed

/analysisResults/{analysisId}
  - AI analysis results
  - Linked to images and locations

/audioAnalysis/{analysisId}
  - Voice-based reports
  - Includes audio blobs

/sensorData/{sensorId}
  - Historical sensor readings (sampled)
  - Various sensor types

/systemLogs/{logId}
  - Activity logs
  - Timestamps and metadata
```

### Realtime Database Paths
```
/liveZones/{zoneId}
  - Real-time flood zone data
  - Low latency updates

/liveReports/{reportId}
  - Real-time report status
  - Live monitoring

/liveSensors/{zoneId}/{sensorType}
  - High-frequency sensor data
  - Latest readings

/systemHeartbeat/status
  - System health check
  - Updated every 60 seconds
```

## How to Use

### Starting the System
The system starts automatically when the app loads. No manual intervention needed.

### Monitoring Data
1. **Firebase Console**: Go to your Firebase project console
   - Firestore Database: View historical data
   - Realtime Database: View live streaming data
   - Storage: View uploaded images

2. **Check Console Logs**: The app logs all Firebase operations
   - Look for `✅` emojis for successful saves
   - System status updates every 5 minutes

### Key Functions You Can Use

```typescript
// Save a flood zone
import { saveFloodZone } from './services/dataCollection';
await saveFloodZone(zone);

// Save a user report
import { saveUserReport } from './services/dataCollection';
await saveUserReport({
  location: { lat, lng, address },
  details: "Flooding observed",
  status: "pending"
});

// Get recent reports
import { getRecentReports } from './services/dataCollection';
const reports = await getRecentReports(10);

// Update report status
import { updateReportStatus } from './services/dataCollection';
await updateReportStatus(reportId, 'completed');
```

## Data Collection Intervals

- **Heartbeat**: Every 60 seconds
- **Sensor Data**: Every 5 minutes
- **User Reports**: Immediate on submission
- **Zone Updates**: Immediate on change
- **Analysis Results**: Immediate on completion

## Important Notes

1. **Firebase Setup Required**:
   - Ensure Firestore is enabled in Firebase Console
   - Enable Realtime Database in Firebase Console
   - Set up security rules for production

2. **Network Dependency**:
   - System requires internet connection
   - Failed saves are logged to console
   - Consider adding offline persistence if needed

3. **Cost Considerations**:
   - Firestore: Pay per read/write
   - Realtime Database: Pay per GB downloaded
   - Storage: Pay per GB stored
   - Current implementation optimized to minimize costs

4. **Security Rules**:
   - Currently using default rules
   - **IMPORTANT**: Set up proper security rules before production!

## Sample Security Rules

### Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read to all, write for authenticated users
    match /floodZones/{zoneId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /reports/{reportId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /analysisResults/{analysisId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /audioAnalysis/{analysisId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /systemLogs/{logId} {
      allow read: if request.auth != null;
      allow write: if true;
    }
  }
}
```

### Realtime Database Rules
```json
{
  "rules": {
    "liveZones": {
      ".read": true,
      ".write": true
    },
    "liveReports": {
      ".read": true,
      ".write": true
    },
    "liveSensors": {
      ".read": true,
      ".write": true
    },
    "systemHeartbeat": {
      ".read": true,
      ".write": true
    }
  }
}
```

## Testing the System

1. **Check Heartbeat**:
   - Open Firebase Realtime Database
   - Navigate to `systemHeartbeat/status`
   - Should update every minute

2. **Submit a Report**:
   - Use the report screen
   - Check Firestore `reports` collection
   - Check Realtime Database `liveReports`

3. **Monitor Sensor Data**:
   - Open Realtime Database
   - Navigate to `liveSensors`
   - Should update every 5 minutes for active zones

## Troubleshooting

### Data Not Appearing in Firebase
1. Check console for errors
2. Verify Firebase config in `firebase.ts`
3. Check Firebase Console for database activation
4. Verify internet connection

### Heartbeat Not Updating
1. Check if app is running
2. Look for JavaScript errors in console
3. Verify Realtime Database is enabled

### Reports Not Saving
1. Check console logs for save errors
2. Verify form has all required fields
3. Check Firebase security rules

## Next Steps

1. **Enable Authentication**: Add Firebase Auth for user tracking
2. **Add Offline Support**: Implement offline persistence
3. **Create Dashboard**: Build admin dashboard to view all data
4. **Set Up Alerts**: Configure Firebase Cloud Functions for automated alerts
5. **Add Analytics**: Track usage patterns and system performance
6. **Optimize Costs**: Review and optimize database queries

## Support

For issues or questions about the 24/7 data collection system:
1. Check console logs for detailed error messages
2. Review Firebase Console for database state
3. Verify all imports are correct
4. Ensure Firebase packages are installed

## Required npm Packages

Make sure these are installed:
```bash
npm install firebase
```

All Firebase packages are included in the main `firebase` package (v9+).

---

**Status**: ✅ System is now collecting data 24/7!
**Last Updated**: February 26, 2026
