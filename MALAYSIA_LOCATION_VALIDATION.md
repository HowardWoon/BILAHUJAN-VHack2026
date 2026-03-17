# Malaysia Location Validation & Normalization

## Overview
BILAHUJAN implements **strict Malaysian location validation** across all user input fields and **automatic location normalization** to ensure consistent display across the platform.

---

## Validation System

### Input Fields with Validation

| Screen | Field | Validation | Error Handling |
|:---|:---|:---|:---|
| **ReportScreen** | Location search bar | Must be Malaysian location | Red warning banner + search disabled |
| **ReportScreen** | Map click selection | Geocodes coordinates to Malaysian address | Falls back to coordinates if outside MY |
| **MapScreen** | Search bar | Must be Malaysian location | Red warning banner |

### Accepted Patterns ✅
```
✅ Malaysian States: Johor, Selangor, Penang, Kuala Lumpur, Sabah, Sarawak, etc.
✅ Major Cities: Kuala Lumpur, Johor Bahru, Ipoh, George Town, Kota Kinabalu, Kuching
✅ Towns: Kajang, Klang, Ampang, Cheras, Puchong, Subang Jaya, Shah Alam
✅ Landmarks: Petronas Twin Towers, Masjid Jamek, Marina Bay Sand
✅ Common Areas: Tasek Jaya, Bandar Sri Damansara, Taman Jaya
```

### Rejected Patterns ❌
```
❌ Foreign Countries: Singapore, Indonesia, Thailand, USA, UK
❌ Foreign Cities: Jakarta, Bangkok, Manila, Tokyo, Dubai, Hong Kong
❌ Country Codes: SG, ID, TH, CN, JP, KR, US, UK
❌ Non-Malaysian Words: "pizza", "restaurant", "hospital" (unless part of MY location)
```

---

## Location Normalization

### Transform Function
`normalizeToTownState(fullAddress, geocodeComponents)` → "Town, State"

**Input → Output Examples:**

| Input | Output |
|:---|:---|
| `"5, Jalan Tun Perak, 50050, Kuala Lumpur, Malaysia"` | `"Chow Kit, Kuala Lumpur"` |
| `"Johor Bahru, Johor"` | `"Johor Bahru, Johor"` |
| `"Kuala Lumpur, Kuala Lumpur"` | `"Kuala Lumpur"` (deduplicated) |
| `"Putrajaya, Putrajaya"` | `"Putrajaya"` (deduplicated) |
| `"Labuan, Labuan"` | `"Labuan Town"` (deduplicated) |
| `"George Town, Pulau Pinang"` | `"George Town, Penang"` |
| `"21500, Klang"` | `"Klang, Selangor"` |

**Location stored in Firebase:**
```json
{
  "locationName": "Chow Kit, Kuala Lumpur",
  "state": "Kuala Lumpur"
}
```

---

## Utility Functions

**File**: `src/utils/floodCalculations.ts`

```typescript
// Normalize state names (handles variations)
export const normalizeStateName = (raw: string): string
// Example: "Pulau Pinang" → "Penang"

// Fix federal territory duplicates
export const deduplicateFTName = (locationName: string): string
// Example: "Kuala Lumpur, Kuala Lumpur" → "Kuala Lumpur"

// Full address to "Town, State" format
export const normalizeToTownState = (
  fullAddress: string,
  geocodeComponents?: AddressComponent[]
): string
// Uses Google Geocode API results to extract town and state

// Get capital of state
export const getMainTown = (state: string): string
// Example: "Johor" → "Johor Bahru", "Selangor" → "Shah Alam"
```

---

## Validation Workflow

### 1. **User enters location** (ReportScreen)
```typescript
if (!isMalaysianLocation(searchQuery)) {
  setLocationWarning(getMalaysiaLocationWarning());
  return;
}
```

### 2. **Geocode address to coordinates**
```typescript
const response = await fetch(
  `https://maps.googleapis.com/maps/api/geocode/json`
  + `?address=${encodeURIComponent(query)},Malaysia`
  + `&region=MY&components=country:MY`
  + `&key=${VITE_GOOGLE_MAPS_API_KEY}`
);
```

### 3. **Extract and normalize components**
```typescript
const components = response.results[0].address_components;
const locationName = normalizeToTownState(
  response.results[0].formatted_address,
  components
);
const state = normalizeStateName(
  components.find(c => c.types.includes('administrative_area_level_1'))?.long_name
);
```

### 4. **Store in zone**
```json
{
  "locationName": "Chow Kit, Kuala Lumpur",
  "state": "Kuala Lumpur",
  "lat": 3.1456,
  "lng": 101.6789
}
```

---

## Government Dashboard Filtering

The dashboard **uses locationName for display**:

```typescript
const location = normalizeToTownState(loc.location || '', locationAnalytics.components);
const primaryLabel = deduplicateFTName(townState);
```

This ensures all zones are displayed in consistent "Town, State" format.

---

## Malaysian Town Registry

**File**: `src/utils/floodCalculations.ts`

Pre-defined towns for each state aid in normalization:

```typescript
export const MALAYSIA_TOWNS: Record<string, string[]> = {
  'Johor': ['Johor Bahru', 'Batu Pahat', 'Muar', 'Kluang', ...],
  'Selangor': ['Shah Alam', 'Petaling Jaya', 'Klang', ...],
  'Kuala Lumpur': ['Chow Kit', 'Titiwangsa', 'Kepong', ...],
  // ... 16 states total
};
```

When ReportScreen receives a coordinate without a town name, the system:
1. Searches MALAYSIA_TOWNS for matching location
2. Falls back to geocoding API
3. Uses state capital as last resort

---

## Testing Location Validation

### Test Malaysian Locations (Should Pass)
```
✅ Kuala Lumpur
✅ Petaling Jaya, Selangor
✅ Johor Bahru
✅ George Town, Penang
✅ Chow Kit
```

### Test Non-Malaysian Locations (Should Fail)
```
❌ Singapore
❌ Bangkok
❌ Jakarta
❌ Hong Kong
```

### Validation Logic
1. **Empty/Short Input**: Valid (user still typing)
2. **Non-Malaysian Keywords**: Immediate warning
3. **Malaysian Keywords**: Accepted
4. **Common Malaysian Location Words**: Accepted
5. **Ambiguous Long Strings**: Warning after 5+ characters

## Warning Message

When a non-Malaysian location is detected, users see:

```
⚠️ This app only covers locations in Malaysia. Please enter a Malaysian location (e.g., Kuala Lumpur, Johor, Penang).
```

The warning appears as a red banner with:
- Warning icon (⚠️)
- Clear explanation
- Examples of valid Malaysian locations
- Professional styling (red background, border, text)

## Technical Implementation

### Files Created
- `src/utils/locationValidator.ts` - Core validation logic with 150+ Malaysian locations

### Files Modified
- `src/screens/MapScreen.tsx` - Added validation to 3 search inputs
- `src/screens/ReportScreen.tsx` - Added validation to location search

### Key Functions
```typescript
isMalaysianLocation(location: string): boolean
// Returns true if location is Malaysian or still being typed

getMalaysiaLocationWarning(): string
// Returns the warning message to display

getMalaysianLocationExamples(): string[]
// Returns example Malaysian locations for help
```

## User Experience

### Real-Time Feedback
- Warning appears instantly as user types
- Warning disappears when input becomes valid
- Warning clears when input is empty
- No blocking - users can still search (search may fail, but app guides them)

### Smart Validation
- Allows short incomplete inputs (2-3 chars)
- Recognizes Malaysian location patterns
- Catches obvious non-Malaysian keywords
- Helpful error messages with examples

## Coverage

### Comprehensive Malaysian Locations Database
- **13 States + 3 Federal Territories**
- **200+ Cities and Towns**
- **Common Malaysian Location Words**
- **Major Urban Areas**: KL, JB, Penang, Ipoh, etc.
- **East Malaysia**: Sabah, Sarawak locations
- **Tourist Areas**: Cameron Highlands, Langkawi, etc.

### Common Non-Malaysian Blocklist
- **20+ Country Names**
- **30+ Major International Cities**
- **Country Codes**
- **Specific user-reported issues** (KSA from screenshot)

## Testing Examples

### Valid Inputs (No Warning)
```
Kuala Lumpur ✅
Johor ✅
Shah Alam ✅
Taman Desa ✅
Jalan Sultan ✅
k ✅ (too short, still typing)
kl ✅ (recognized abbreviation)
kajang ✅
```

### Invalid Inputs (Shows Warning)
```
ksa ❌ (Saudi Arabia code)
singapore ❌ (different country)
jakarta ❌ (Indonesia)
bangkok ❌ (Thailand)
new york ❌ (USA)
london ❌ (UK)
```

## Deployment

✅ **Deployed to**: https://bilahujan-app.web.app/
✅ **Status**: Live and active
✅ **Build**: Successful (1.33 MB bundle)
✅ **Coverage**: All location text inputs validated

## Benefits

### For Users
- Clear guidance on app coverage
- Immediate feedback on input mistakes
- Better understanding of app scope (Malaysia only)
- Reduces failed searches

### For Data Quality
- Ensures location data is Malaysia-focused
- Prevents database pollution with foreign locations
- Improves analytics accuracy
- Better government data sales value

### For Support
- Reduces user confusion
- Fewer "location not found" complaints
- Self-service help (warning shows examples)
- Professional user experience

## Future Enhancements (Optional)

1. **Autocomplete**: Suggest Malaysian locations as user types
2. **GPS Boundary Check**: Warn if user's GPS is outside Malaysia
3. **Language Support**: Malaysian-specific validation (Malay language)
4. **District/Postcode Validation**: More granular location validation
5. **Analytics**: Track most commonly attempted non-Malaysian locations

---

**Implementation Date**: February 26, 2026
**Status**: ✅ Complete and Live
**Coverage**: 4+ location input fields validated
**Database**: 200+ Malaysian locations, 50+ non-Malaysian keywords
