# Firebase Setup Guide for BILAHUJAN

## Overview
BILAHUJAN uses **Firebase Realtime Database** for live flood zone monitoring and **Cloud Firestore** for long-term report archiving. This guide explains the setup and monitoring strategy.

---

## Quick Setup

### 1. Prerequisites
- Firebase project created (e.g., `bilahujan-vhack`)
- Node.js 18+
- `.env` file with `VITE_GEMINI_API_KEY` and `VITE_GOOGLE_MAPS_API_KEY`

### 2. Install Dependencies
```bash
npm install
npm install firebase
```

### 3. Verify Firebase Configuration
The app initializes Firebase automatically on startup. Check your browser console for:
```
✅ Firebase initialized for project: bilahujan-vhack
```

---

## Database Structure

### Realtime Database (`/liveZones`)
**Real-time flood zones** — updates every 500ms when new reports arrive.

```json
{
  "user_reported_1708123456_abc123": {
    "id": "user_reported_1708123456_abc123",
    "name": "Chow Kit, Kuala Lumpur",
    "state": "Kuala Lumpur",
    "lat": 3.1456,
    "lng": 101.6789,
    "severity": 7,
    "reportId": "report_...",
    "uploadedAt": 1708123456000,
    "startTime": "2026-02-17T10:30:00Z",
    "source": "user"
  }
}
```

### Realtime Database (`/liveReports`)
**All citizen reports** — indexed by report ID, linked to zones via `zoneId`.

### Realtime Database (`/agentAlerts`)
**Agent dispatch records** — when Command Agent notifies authorities.

### Firestore Collection (`reports`)
**Historical archive** of all reports for analytics and compliance.

---

## Database Rules

### Production (Realtime Database)

```json
{
  "rules": {
    "liveZones": {
      ".read": true,
      ".write": "auth.uid != null && root.child('mods').child(auth.uid).exists()",
      "$zoneId": {
        ".validate": "newData.hasChildren(['id', 'state', 'lat', 'lng', 'severity'])"
      }
    },
    "liveReports": {
      ".read": true,
      ".write": "auth !== null"
    },
    "agentAlerts": {
      ".read": "auth.uid != null && root.child('mods').child(auth.uid).exists()",
      ".write": "auth.uid != null && root.child('mods').child(auth.uid).exists()"
    },
    ".read": false,
    ".write": false
  }
}
```

### Development (Test Mode - 30 days)
```json
{
  "rules": {
    ".read": "now < 1743206400000",
    ".write": "now < 1743206400000"
  }
}
```

⚠️ **ALWAYS update rules before production deployment**

---

## Monitoring Real-Time Updates

### Check Live Zones
1. Open [Firebase Console](https://console.firebase.google.com/)
2. Select `bilahujan-vhack` project
3. Go to **Realtime Database**
4. Click `liveZones` → view all active zones
5. New zones appear within 1 second of submission

### Check Reports
- Navigate to `liveReports` 
- Each report ID links to a `zoneId`
- Search by state to filter incidents

---

## Deployment Verification

After `npm run deploy`:

```bash
firebase hosting:channel:list
```

Verify your app is live at:
```
https://bilahujan-vhack.web.app
```

Test data collection:
1. Open the website
2. Submit a test report from ReportScreen
3. Go to Firebase Console → `liveZones` → verify zone appears

---

## Troubleshooting

| Issue | Solution |
|:---|:---|
| **"Permission denied on read of /liveZones"** | Check database rules — must allow `.read: true` for public access |
| **Reports not appearing in Firebase** | Verify `VITE_GEMINI_API_KEY` is set; check browser console for errors |
| **"CORS error with Gemini API"** | Not a CORS issue — Gemini API is called from backend only (via ReportScreen) |
| **Zones not appearing on map** | Check Government Dashboard — it filters real zones (severity >= 2 + reportId present) |

---

## Data Retention

- **Live Zones**: Kept until severity = 1 or 30 days elapsed
- **Reports**: Archived in Firestore permanently
- **Agent Alerts**: Kept for compliance auditing

---

## Next Steps

See [FIREBASE_DATA_COLLECTION.md](./FIREBASE_DATA_COLLECTION.md) for complete data flow documentation.
}
```

#### Check Sensor Data (within 5 minutes):
1. Open Firebase Console → Realtime Database
2. Navigate to `liveSensors`
3. You should see sensor readings for zones with severity >= 3

#### Submit a Test Report:
1. In your app, go to Report tab
2. Take/upload a flood photo
3. Fill in location and departments
4. Click Submit
5. Check Firebase Console:
   - Firestore → `reports` collection (new document added)
   - Realtime Database → `liveReports` (new entry)

### 7. Monitor Your Data

#### Firebase Console Views:

**Firestore Database** (Historical Data):
- `/floodZones` - All flood zones
- `/reports` - User reports
- `/analysisResults` - AI analysis results
- `/audioAnalysis` - Voice reports
- `/sensorData` - Sensor readings (sampled)
- `/systemLogs` - Activity logs

**Realtime Database** (Live Data):
- `/liveZones` - Real-time zone updates
- `/liveReports` - Live report status
- `/liveSensors` - Current sensor readings
- `/systemHeartbeat` - System health

### 8. View Your Data

You can view the data from the Firebase Console screenshot you shared:
- Current storage: **8B** (very minimal)
- Downloads: **0B** so far
- Costs: Still on free tier!

### 9. Troubleshooting

#### No data appearing?
```bash
# Check browser console for errors
# Common issues:
# - Firebase not initialized (check firebase.ts)
# - Database not enabled (follow steps 1-2)
# - Network errors (check internet connection)
```

#### Heartbeat not updating?
```bash
# App must be running
# Check console for: "🔄 Initializing 24/7 data collection system..."
# If not showing, restart the app
```

#### Permission denied errors?
```bash
# Update Firebase rules (see step 3)
# Make sure test mode is enabled
# Rules must allow public read/write for testing
```

### 10. Production Checklist

Before deploying to production:

- [ ] Enable Firebase Authentication
- [ ] Update Firestore security rules
- [ ] Update Realtime Database rules
- [ ] Set up Firebase App Check
- [ ] Configure CORS for Firebase Storage
- [ ] Set up backup/export policies
- [ ] Monitor usage and costs
- [ ] Set up billing alerts
- [ ] Enable Firebase Analytics
- [ ] Set up Cloud Functions for automation

### 11. Cost Management

Free tier limits (Spark Plan):
- **Firestore**: 50K reads, 20K writes, 1GB storage per day
- **Realtime Database**: 100 concurrent connections, 1GB download per month
- **Storage**: 5GB total

Current implementation is optimized:
- Sensor data sampled to Firestore (10% only)
- High-frequency data uses Realtime DB
- Heartbeat updates minimized (1/minute)

Estimated monthly cost on free tier: **$0**

When scaling, consider upgrading to Blaze (pay-as-you-go) plan.

### 12. Next Steps

1. ✅ Enable Firestore & Realtime Database
2. ✅ Start the app and verify data collection
3. ✅ Submit test reports
4. ✅ Monitor Firebase Console
5. 📊 Build analytics dashboard
6. 🔔 Set up automated alerts
7. 👥 Add user authentication
8. 📱 Deploy to production

---

## Support Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Realtime Database Rules](https://firebase.google.com/docs/database/security)
- [Firebase Pricing](https://firebase.google.com/pricing)

## Need Help?

Check the logs in your browser console for detailed information:
- `✅` - Success messages
- `❌` or errors - Something went wrong
- `🔄` - Process starting/running
- `📊` - Data collection events

Your 24/7 data collection system is ready! 🚀
