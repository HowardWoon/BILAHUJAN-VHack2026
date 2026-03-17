# Map Screen - React Implementation

## Overview
The Map Screen is the **primary interface** for BILAHUJAN users to visualize live flood zones, search for incidents, and upload reports. It's built with **React**, **Google Maps API**, and **Tailwind CSS** — optimized for mobile-first use during emergencies.

---

## File Structure
```
src/screens/
  MapScreen.tsx                      (Main component)
  
src/components/
  StatusBar.tsx                      (Header)
  BottomNav.tsx                      (Tab navigation)
  
src/services/
  gemini.ts                          (AI image analysis)
  dataCollection.ts                  (Realtime monitoring)
  
src/data/
  floodZones.ts                      (Zone management)
  officialLogos.ts                   (Government logos)
```

---

## Key Screens

### 1. Map Display
**Component**: `MapScreen.tsx`

Features:
- **Live Zone Visualization** — All flood zones as red/orange/yellow markers/circles
- **Malaysia Bounds** — Map restricted to Malaysia region (auto-center, auto-zoom)
- **Severity Color Coding**:
  - 🔴 **Red** (Severity 7-10) — Critical, evacuate
  - 🟠 **Orange** (Severity 4-6) — Moderate, avoid
  - 🟡 **Yellow** (Severity 2-3) — Minor, caution
- **Click Zone Details** — Tap marker → see AlertDetailScreen
- **Search Bar** — Find location, validates Malaysian location
- **Location Permission** — Get user's current GPS for context

### 2. Scan Mode
Users can **scan a nearby location** for flooding:

```typescript
// User clicks "Scan Near Me" button
setIsScanning(true)

// Modal appears, user enters location
// User takes photo → ReportScreen
```

### 3. Report Submission (ReportScreen)
**File**: `src/screens/ReportScreen.tsx`

Flow:
1. **Search location** on embedded map
2. **Select location** by clicking map pin or searching
3. **Confirm location** (shows "Town, State" normalized name)
4. **Take photo** of flood scene
5. **Select authorities** (JPS, NADMA, APM)
6. **Submit report** → Firebase upload → Gemini analysis

---

## Data Model

### Flood Zone (Type: FloodZone)
```typescript
interface FloodZone {
  id: string;                          // e.g., "user_reported_1708123456_abc123"
  name: string;                        // Displayed name
  locationName: string;                // Normalized: "Town, State"
  state: string;                       // "Kuala Lumpur", "Selangor", etc.
  lat: number;
  lng: number;
  center: { lat: number; lng: number };
  severity: number;                    // 1-10 scale
  rainfall: number;                    // mm/hr estimated
  drainageBlockage: number;            // % blockage
  forecast: string;                    // AI prediction text
  eventType: string;                   // "Flash Flood", "Ponding", etc.
  waterDepth: string;                  // "Knee-level", "Roof-level", etc.
  aiAnalysisText: string;              // Gemini analysis
  aiConfidence: number;                // 0-100%
  reportId?: string;                   // Links to citizen report
  source: string;                      // "user" or "baseline"
  isWeatherFallbackZone?: boolean;     // Baseline weather zone
  status: string;                      // "active", "warning", "monitor"
  timestamp: number;                   // Last update time (ms)
}
```

---

## Key Functions

### Map Rendering
```typescript
// Get all live zones from Firebase
const zones = useFloodZones();  // Hook from floodZones.ts

// Render each zone as marker + circle
zones.map(zone => (
  <MarkerF
    position={{ lat: zone.lat, lng: zone.lng }}
    onClick={() => handleZoneClick(zone)}
    icon={getSeverityIcon(zone.severity)}
  />
))
```

### Location Search
```typescript
const handleSearch = (query: string) => {
  // Validate Malaysian location
  if (!isMalaysianLocation(query)) {
    setLocationWarning(getMalaysiaLocationWarning());
    return;
  }
  
  // Geocode in Malaysia bounds
  fetchGeocodeResults(query, 'Malaysia');
}
```

### Current Location
```typescript
// Auto-detect user's GPS location (if permitted)
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(position => {
    setCurrentLocation({
      lat: position.coords.latitude,
      lng: position.coords.longitude
    });
  });
}
```

---

## Severity Indicators

### Visual Coding
| Severity | Color | Icon | Label |
|:---|:---|:---|:---|
| 9-10 | 🔴 Dark Red | Crisis Alert | CRITICAL |
| 7-8 | 🔴 Red | Warning | SEVERE |
| 5-6 | 🟠 Orange | Flood | MODERATE |
| 3-4 | 🟡 Yellow | Info | MINOR |
| 1-2 | 🟢 Green | Check Circle | NORMAL |

### Marker Customization
```typescript
const getSeverityIcon = (severity: number) => {
  if (severity >= 8) return redMarker;     // Critical
  if (severity >= 5) return orangeMarker;  // Moderate
  return yellowMarker;                     // Minor
}
```

---

## Real-Time Updates

### Firebase Listener
```typescript
// Listen for new zones added
const unsubscribe = onValue(ref(rtdb, 'liveZones'), snapshot => {
  const zones = snapshot.val();
  setFloodZones(zones);  // Map re-renders in <2s
});
```

### Performance
- **Update Latency**: 500ms-2s (debounced to avoid flicker)
- **Zone Limit**: Tested with 100+ zones — smooth on modern devices
- **Mobile**: Optimized for 4G/5G networks; graceful fallback on slow connections

---

## Location Normalization

All locations displayed as **"Town, State"** format:

```typescript
import { normalizeToTownState, deduplicateFTName } from '../utils/floodCalculations';

// User selects "5, Jalan Tun Perak, Kuala Lumpur"
const normalized = normalizeToTownState(address, geocodeComponents);
// Result: "Chow Kit, Kuala Lumpur"

// Special handling for federal territories
const deduplicated = deduplicateFTName(normalized);
// "Kuala Lumpur, Kuala Lumpur" → "Kuala Lumpur"
```

---

## Accessibility & Responsiveness

### Mobile Optimization
- ✅ Full-screen map on all screen sizes
- ✅ Bottom navigation instead of side menu
- ✅ Touch-friendly buttons (min 44x44 px)
- ✅ High contrast markers (visible in bright sunlight)

### Map Controls
- **Zoom**: Pinch to zoom (mobile) / scroll wheel (desktop)
- **Pan**: Drag map
- **Search**: Autocomplete from Malaysia towns list
- **Locate**: "Current Location" button restores zoom to user

---

## Testing

### Local Development
```bash
npm run dev
```

Test zones:
1. Open app → MapScreen tab
2. See pre-seeded zones (37 zones across 16 states)
3. Click zone marker → AlertDetailScreen
4. Tap "Scan Near Me" → ReportScreen
5. Submit test report → Zone appears in real-time

### Firebase Verification
1. Open Firebase Console
2. Go to `liveZones`
3. New zones appear <1 second after submission
4. Map updates within 2 seconds (debounce)

---

## Troubleshooting

| Issue | Cause | Solution |
|:---|:---|:---|
| **Map shows blank** | `VITE_GOOGLE_MAPS_API_KEY` not set | Add key to `.env` |
| **Zones don't appear** | Firebase not initialized | Check browser console for errors |
| **Search fails** | Non-Malaysian location rejected | Try "Kuala Lumpur" or city name |
| **Slow updates** | Network latency | Check Firebase read rules |

---

## Future Enhancements

- **AR Visualization** — Overlay flood zones on camera view
- **Predictive Routing** — Suggest flood-free routes
- **Community Chat** — Real-time communication between users in same zone
- **Drone Integration** — Accept aerial flood imagery from drones
          LatLng(3.1500, 101.6900),
          LatLng(3.1550, 101.6950),
          LatLng(3.1450, 101.7000),
          LatLng(3.1400, 101.6950),
        ],
      ),
      FloodZone(
        id: 'zone_2',
        name: 'Sri Hartamas',
        severity: 3,
        forecast: 'Light showers. Drainage systems operating normally.',
        points: const [
          LatLng(3.1600, 101.6500),
          LatLng(3.1650, 101.6550),
          LatLng(3.1550, 101.6600),
          LatLng(3.1500, 101.6550),
        ],
      ),
    ];
  }
}
```

### 3. Map Screen UI (`lib/screens/map_home_screen.dart`)

```dart
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../services/flood_data_service.dart';

class MapHomeScreen extends StatefulWidget {
  const MapHomeScreen({super.key});

  @override
  State<MapHomeScreen> createState() => _MapHomeScreenState();
}

class _MapHomeScreenState extends State<MapHomeScreen> {
  final Completer<GoogleMapController> _controller = Completer<GoogleMapController>();
  final FloodDataService _floodDataService = FloodDataService();
  
  Set<Polygon> _polygons = {};

  // Initial camera position (Kuala Lumpur)
  static const CameraPosition _kualaLumpur = CameraPosition(
    target: LatLng(3.140853, 101.693207),
    zoom: 13.5,
  );

  // Restrict map to Malaysia bounds
  static final CameraTargetBounds _malaysiaBounds = CameraTargetBounds(
    LatLngBounds(
      southwest: const LatLng(1.0, 99.0),
      northeast: const LatLng(7.0, 120.0),
    ),
  );

  @override
  void initState() {
    super.initState();
    _loadFloodData();
  }

  Future<void> _loadFloodData() async {
    final zones = await _floodDataService.fetchFloodData();
    final Set<Polygon> newPolygons = {};

    for (var zone in zones) {
      Color fillColor;
      Color strokeColor;

      // Severity Color Coding
      if (zone.severity >= 8) {
        fillColor = Colors.red.withOpacity(0.3);
        strokeColor = Colors.red.withOpacity(0.6);
      } else if (zone.severity >= 4) {
        fillColor = Colors.orange.withOpacity(0.3);
        strokeColor = Colors.orange.withOpacity(0.6);
      } else {
        fillColor = Colors.green.withOpacity(0.3);
        strokeColor = Colors.green.withOpacity(0.6);
      }

      newPolygons.add(
        Polygon(
          polygonId: PolygonId(zone.id),
          points: zone.points,
          fillColor: fillColor,
          strokeColor: strokeColor,
          strokeWidth: 2,
          consumeTapEvents: true,
          onTap: () => _showZoneDetails(zone),
        ),
      );
    }

    setState(() {
      _polygons = newPolygons;
    });
  }

  void _showZoneDetails(FloodZone zone) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return Container(
          padding: const EdgeInsets.all(24),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    zone.name,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: zone.severity >= 8 
                          ? Colors.red.shade100 
                          : zone.severity >= 4 
                              ? Colors.orange.shade100 
                              : Colors.green.shade100,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      'Level \${zone.severity}',
                      style: TextStyle(
                        color: zone.severity >= 8 
                            ? Colors.red.shade700 
                            : zone.severity >= 4 
                                ? Colors.orange.shade700 
                                : Colors.green.shade700,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Text(
                'Forecast & Status',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                zone.forecast,
                style: const TextStyle(fontSize: 16),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF6B59D3), // Primary Purple
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: const Text(
                    'Close',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // 1. Full Screen Map
          GoogleMap(
            mapType: MapType.normal,
            initialCameraPosition: _kualaLumpur,
            cameraTargetBounds: _malaysiaBounds,
            polygons: _polygons,
            myLocationEnabled: true,
            myLocationButtonEnabled: false, // We use custom button
            zoomControlsEnabled: false,
            onMapCreated: (GoogleMapController controller) {
              _controller.complete(controller);
            },
          ),

          // 2. Custom Search Bar (Top)
          Positioned(
            top: 60,
            left: 16,
            right: 16,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              height: 56,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.9),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                children: [
                  const Icon(Icons.search, color: Colors.grey),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: TextField(
                      decoration: InputDecoration(
                        hintText: 'Search location...',
                        border: InputBorder.none,
                      ),
                    ),
                  ),
                  const Icon(Icons.mic, color: Colors.grey),
                ],
              ),
            ),
          ),

          // 3. Map Controls (Right)
          Positioned(
            top: 140,
            right: 16,
            child: Column(
              children: [
                _buildMapControlButton(Icons.my_location, () async {
                  // Logic to animate camera to user location
                }),
                const SizedBox(height: 8),
                _buildMapControlButton(Icons.layers, () {
                  // Logic to toggle map layers
                }),
              ],
            ),
          ),

          // 4. Scan Near Me Button (Bottom Center)
          Positioned(
            bottom: 100, // Above bottom nav bar
            left: 0,
            right: 0,
            child: Center(
              child: ElevatedButton.icon(
                onPressed: () {
                  // Navigate to Camera Scan Screen
                },
                icon: const Icon(Icons.photo_camera),
                label: const Text(
                  'Scan Near Me',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF6B59D3), // Primary Purple
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(30),
                  ),
                  elevation: 8,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMapControlButton(IconData icon, VoidCallback onPressed) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.9),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: IconButton(
        icon: Icon(icon, color: Colors.grey.shade700),
        onPressed: onPressed,
      ),
    );
  }
}
```
