import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Polygon, Circle } from '@react-google-maps/api';

const GOOGLE_MAPS_LIBRARIES: ('places')[] = ['places'];

// Approximate state-level circle radii in metres for visibility at country zoom
const STATE_RADIUS_M: Record<string, number> = {
  'Sarawak':          160000,
  'Sabah':            130000,
  'Pahang':            90000,
  'Perak':             75000,
  'Johor':             70000,
  'Kelantan':          65000,
  'Terengganu':        60000,
  'Kedah':             50000,
  'Selangor':          45000,
  'Negeri Sembilan':   40000,
  'Penang':            22000,
  'Melaka':            18000,
  'Perlis':            12000,
  'Kuala Lumpur':      14000,
  'Putrajaya':          8000,
  'Labuan':             6000,
};

// Fallback geographic centres for each state — used when Firebase zone has missing/zero centre coords
const STATE_CENTERS: Record<string, { lat: number; lng: number }> = {
  'Sarawak':          { lat: 2.50,  lng: 113.50 },
  'Sabah':            { lat: 5.98,  lng: 116.07 },
  'Pahang':           { lat: 3.81,  lng: 103.32 },
  'Perak':            { lat: 4.59,  lng: 101.09 },
  'Johor':            { lat: 1.49,  lng: 103.74 },
  'Kelantan':         { lat: 6.12,  lng: 102.23 },
  'Terengganu':       { lat: 5.33,  lng: 103.15 },
  'Kedah':            { lat: 6.12,  lng: 100.36 },
  'Selangor':         { lat: 3.07,  lng: 101.51 },
  'Negeri Sembilan':  { lat: 2.72,  lng: 101.94 },
  'Penang':           { lat: 5.35,  lng: 100.28 },
  'Melaka':           { lat: 2.19,  lng: 102.25 },
  'Perlis':           { lat: 6.44,  lng: 100.20 },
  'Kuala Lumpur':     { lat: 3.14,  lng: 101.69 },
  'Putrajaya':        { lat: 2.92,  lng: 101.69 },
  'Labuan':           { lat: 5.28,  lng: 115.24 },
};
import BottomNav from '../components/BottomNav';
import StatusBar from '../components/StatusBar';
import { PrivacyNotice } from '../components/PrivacyNotice';
import { FloodZone, useFloodZones } from '../data/floodZones';
import { analyzeAudio, AudioAnalysisResult, analyzeLocationRisk, LocationRiskAnalysis } from '../services/gemini';
import { saveAudioAnalysis } from '../services/dataCollection';
import { isMalaysianLocation, getMalaysiaLocationWarning } from '../utils/locationValidator';

interface MapScreenProps {
  onScanClick: (location?: { lat: number; lng: number; address: string }) => void;
  onTabChange: (tab: 'map' | 'report' | 'alert' | 'dashboard') => void;
  initialShowLocationModal?: boolean;
}

interface ResolvedMapLocation {
  lat: number;
  lng: number;
  address: string;
}

const normalizeSearchText = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const normalizeLabelPart = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

const isPlusCodeLike = (value: string) => /^[a-z0-9]{4,}\+[a-z0-9]{2,}(?:\s+.*)?$/i.test(value.trim());

const getAddressComponent = (components: google.maps.GeocoderAddressComponent[], types: string[]) =>
  components.find(component => types.some(type => component.types.includes(type)))?.long_name?.trim() || '';

const buildSpecificCurrentLocationLabel = (result: google.maps.GeocoderResult) => {
  const components = result.address_components || [];

  const premise = getAddressComponent(components, ['premise', 'subpremise', 'establishment', 'point_of_interest']);
  const neighborhood = getAddressComponent(components, ['neighborhood', 'sublocality_level_1', 'sublocality_level_2', 'sublocality']);
  const route = getAddressComponent(components, ['route']);
  const locality = getAddressComponent(components, ['locality']);
  const subdistrict = getAddressComponent(components, ['administrative_area_level_3', 'administrative_area_level_4']);
  const district = getAddressComponent(components, ['administrative_area_level_2']);
  const state = getAddressComponent(components, ['administrative_area_level_1']);

  const town = locality || subdistrict || district;
  const micro = neighborhood || route || premise;

  if (town && state && town.toLowerCase() !== state.toLowerCase()) {
    if (micro && micro.toLowerCase() !== town.toLowerCase()) {
      return `${micro}, ${town}`;
    }
    return `${town}, ${state}`;
  }

  const primary = micro || town;
  const secondary = town || district || state;

  if (primary && secondary && primary.toLowerCase() !== secondary.toLowerCase()) {
    return `${primary}, ${secondary}`;
  }

  if (primary && state && primary.toLowerCase() !== state.toLowerCase()) return `${primary}, ${state}`;
  if (primary && primary.toLowerCase() !== state.toLowerCase()) return primary;
  if (secondary && secondary.toLowerCase() !== state.toLowerCase()) return secondary;

  const fallbackParts = (result.formatted_address || '')
    .split(',')
    .map(part => part.trim())
    .filter(part => part && !/^\d+$/.test(part) && !/malaysia/i.test(part) && !/^\d{5}$/.test(part) && !isPlusCodeLike(part))
    .filter(part => part.toLowerCase() !== state.toLowerCase());

  const fallbackLabel = fallbackParts.slice(0, 2).join(', ');
  if (!fallbackLabel || isPlusCodeLike(fallbackLabel)) return 'My Location';
  return fallbackLabel;
};

const predictionMatchesQuery = (query: string, prediction: google.maps.places.AutocompletePrediction) => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery || normalizedQuery.length < 3) return false;

  const mainText = normalizeSearchText(prediction.structured_formatting?.main_text || '');
  const description = normalizeSearchText(prediction.description || '');

  if (mainText === normalizedQuery || description === normalizedQuery) return true;
  if (description.startsWith(`${normalizedQuery} `) || description.startsWith(`${normalizedQuery},`)) return true;

  return false;
};

const MALAYSIA_BOUNDS = {
  south: 0.8,
  west: 99.0,
  north: 7.5,
  east: 120.0,
};

const LAST_PRECISE_LOCATION_KEY = 'bilahujan:lastPreciseLocation';
const MAX_PRECISE_AGE_MS = 1000 * 60 * 30;

const isWithinMalaysiaBounds = (lat: number, lng: number) =>
  lat >= MALAYSIA_BOUNDS.south && lat <= MALAYSIA_BOUNDS.north && lng >= MALAYSIA_BOUNDS.west && lng <= MALAYSIA_BOUNDS.east;

const readLastPreciseLocation = () => {
  try {
    const raw = localStorage.getItem(LAST_PRECISE_LOCATION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { lat?: number; lng?: number; address?: string; timestamp?: number };
    if (!Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lng) || !Number.isFinite(parsed.timestamp)) {
      return null;
    }

    if (!isWithinMalaysiaBounds(parsed.lat as number, parsed.lng as number)) return null;
    if (Date.now() - (parsed.timestamp as number) > MAX_PRECISE_AGE_MS) return null;

    return {
      lat: parsed.lat as number,
      lng: parsed.lng as number,
      address: typeof parsed.address === 'string' ? parsed.address : '',
    };
  } catch {
    return null;
  }
};

const saveLastPreciseLocation = (lat: number, lng: number, address: string) => {
  try {
    localStorage.setItem(
      LAST_PRECISE_LOCATION_KEY,
      JSON.stringify({ lat, lng, address, timestamp: Date.now() })
    );
  } catch {
    // ignore storage failures
  }
};

const formatCoordinateAddress = (lat: number, lng: number) => `Coordinates ${lat.toFixed(5)}, ${lng.toFixed(5)}`;

export default function MapScreen({ onScanClick, onTabChange, initialShowLocationModal = false }: MapScreenProps) {
  const [selectedZone, setSelectedZone] = useState<FloodZone | null>(null);
  const [scanMode, setScanMode] = useState<'none' | 'modal' | 'selecting'>('none');
  const [manualLocation, setManualLocation] = useState('');
  const [mapCenter, setMapCenter] = useState({ lat: 4.5, lng: 109.0 });
  const [mapZoom, setMapZoom] = useState(6);
  const [searchedZone, setSearchedZone] = useState<FloodZone | null>(null);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [showPrivacyInfo, setShowPrivacyInfo] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);
  const [audioAnalysis, setAudioAnalysis] = useState<AudioAnalysisResult | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [locationWarning, setLocationWarning] = useState<string>('');
  const [locationNotFound, setLocationNotFound] = useState(false);
  const [isLoadingRisk, setIsLoadingRisk] = useState(false);
  const autoSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (autoSearchTimerRef.current) {
        clearTimeout(autoSearchTimerRef.current);
      }
    };
  }, []);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const onMapUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const center = useMemo(() => ({
    lat: 4.5, // Centered to show both Peninsular and East Malaysia
    lng: 109.0
  }), []);

  const mapOptions = useMemo(() => ({
    disableDefaultUI: true,
    restriction: {
      latLngBounds: MALAYSIA_BOUNDS,
      strictBounds: false,
    },
    styles: [
      {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }]
      }
    ]
  }), []);

  const allZones = useFloodZones();
  
  const zones = useMemo(() => {
    const now = new Date();
    const filtered: Record<string, FloodZone> = {};
    Object.entries(allZones).forEach(([id, zone]) => {
      const floodZone = zone as FloodZone;
      if (floodZone.estimatedEndTime && floodZone.estimatedEndTime !== 'N/A' && floodZone.estimatedEndTime !== 'Unknown') {
        const endTime = new Date(floodZone.estimatedEndTime);
        // Only filter out if it's a valid date and it's in the past
        if (!isNaN(endTime.getTime()) && endTime < now) {
          // Skip this zone
        } else {
          filtered[id] = floodZone;
        }
      } else {
        filtered[id] = floodZone;
      }
    });
    return filtered;
  }, [allZones]);

  const [currentAddress, setCurrentAddress] = useState<string>('Use My Current Location');
  const [currentGpsLocation, setCurrentGpsLocation] = useState<{ lat: number; lng: number } | null>(null);

  const getCurrentPositionWithOptions = useCallback(
    (options?: PositionOptions) =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      }),
    []
  );

  const getBestCurrentPosition = useCallback(async (): Promise<GeolocationPosition | null> => {
    if (!navigator.geolocation) return null;

    const isAcceptablePosition = (position: GeolocationPosition, maxAccuracyMeters: number) => {
      const { latitude, longitude, accuracy } = position.coords;
      if (!isWithinMalaysiaBounds(latitude, longitude)) return false;
      if (Number.isFinite(accuracy) && accuracy > maxAccuracyMeters) return false;
      return true;
    };

    const getBestFromWatch = () => new Promise<GeolocationPosition | null>((resolve) => {
      let best: GeolocationPosition | null = null;
      const startedAt = Date.now();
      const maxWaitMs = 12000;

      const finish = (value: GeolocationPosition | null) => {
        navigator.geolocation.clearWatch(watchId);
        resolve(value);
      };

      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (!isAcceptablePosition(position, 3000)) {
            if (Date.now() - startedAt >= maxWaitMs) {
              finish(best);
            }
            return;
          }

          if (!best || position.coords.accuracy < best.coords.accuracy) {
            best = position;
          }

          if (position.coords.accuracy <= 120) {
            finish(position);
            return;
          }

          if (Date.now() - startedAt >= maxWaitMs) {
            finish(best);
          }
        },
        () => finish(best),
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: maxWaitMs,
        }
      );

      setTimeout(() => finish(best), maxWaitMs + 500);
    });

    const watched = await getBestFromWatch();
    if (watched) return watched;

    try {
      const position = await getCurrentPositionWithOptions({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });
      if (isAcceptablePosition(position, 3000)) return position;
    } catch {
    }

    try {
      const fallbackPosition = await getCurrentPositionWithOptions({
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 600000,
      });
      if (isAcceptablePosition(fallbackPosition, 10000)) return fallbackPosition;
    } catch {
      // continue to null
    }

    return null;
  }, [getCurrentPositionWithOptions]);

  const resolveCurrentLocationAddress = useCallback(async (lat: number, lng: number): Promise<string> => {
    if (!(window.google && window.google.maps && window.google.maps.Geocoder)) {
      return formatCoordinateAddress(lat, lng);
    }

    const geocoder = new window.google.maps.Geocoder();
    const results = await new Promise<google.maps.GeocoderResult[]>((resolve) => {
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results && results.length > 0) {
          resolve(results);
          return;
        }
        resolve([]);
      });
    });

    if (!results.length) return formatCoordinateAddress(lat, lng);

    const firstReadableResult = results.find(result => {
      const label = buildSpecificCurrentLocationLabel(result);
      return label && label !== 'My Location' && !isPlusCodeLike(label);
    }) || results[0];

    const displayName = buildSpecificCurrentLocationLabel(firstReadableResult);
    if (!displayName || displayName === 'My Location' || isPlusCodeLike(displayName)) {
      return formatCoordinateAddress(lat, lng);
    }

    return displayName;
  }, []);

  const resolveApproximateLocation = useCallback(async (): Promise<{ lat: number; lng: number; label: string } | null> => {
    const endpoints = [
      'https://ipapi.co/json/',
      'https://ipwho.is/',
      'https://ipinfo.io/json',
    ];

    for (const endpoint of endpoints) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(endpoint, { signal: controller.signal });
        if (!response.ok) continue;

        const data = await response.json() as {
          latitude?: number;
          longitude?: number;
          lat?: number;
          lon?: number;
          city?: string;
          region?: string;
          country?: string;
          country_name?: string;
          country_code?: string;
          loc?: string;
        };

        let lat = Number.NaN;
        let lng = Number.NaN;

        if (Number.isFinite(data.latitude) && Number.isFinite(data.longitude)) {
          lat = data.latitude as number;
          lng = data.longitude as number;
        } else if (Number.isFinite(data.lat) && Number.isFinite(data.lon)) {
          lat = data.lat as number;
          lng = data.lon as number;
        } else if (typeof data.loc === 'string' && data.loc.includes(',')) {
          const [latStr, lngStr] = data.loc.split(',');
          lat = Number(latStr);
          lng = Number(lngStr);
        }

        const countryText = `${data.country || ''} ${data.country_name || ''} ${data.country_code || ''}`.toLowerCase();
        const isMalaysiaCountry = /malaysia|\bmy\b/.test(countryText);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        if (!isWithinMalaysiaBounds(lat, lng)) continue;
        if (!isMalaysiaCountry) continue;

        const city = (data.city || '').trim();
        const region = (data.region || '').trim();

        const uniqueParts: string[] = [];
        const seen = new Set<string>();
        [city, region].forEach(part => {
          const trimmed = part.trim();
          if (!trimmed) return;
          const key = normalizeLabelPart(trimmed);
          if (seen.has(key)) return;
          seen.add(key);
          uniqueParts.push(trimmed);
        });

        const label = uniqueParts.join(', ') || 'Malaysia';

        return { lat, lng, label };
      } catch {
        // try next endpoint
      } finally {
        clearTimeout(timer);
      }
    }

    return null;
  }, []);

  useEffect(() => {
    if (initialShowLocationModal) {
      setScanMode('modal');
    }
  }, [initialShowLocationModal]);

  // Try to get current location address when modal opens
  useEffect(() => {
    if (scanMode !== 'modal') return;

    setCurrentAddress('Fetching location...');

    if (!isLoaded || !(window.google && window.google.maps && window.google.maps.Geocoder)) {
      return;
    }

    let cancelled = false;

    const hydrateCurrentAddress = async () => {
      const position = await getBestCurrentPosition();

      if (cancelled) return;

      if (position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCurrentGpsLocation({ lat, lng });
        const displayName = await resolveCurrentLocationAddress(lat, lng);
        if (cancelled) return;
        saveLastPreciseLocation(lat, lng, displayName);
        setCurrentAddress(`Current: ${displayName}`);
        return;
      }

      try {
        const coarse = await getCurrentPositionWithOptions({
          enableHighAccuracy: false,
          timeout: 12000,
          maximumAge: 600000,
        });

        if (isWithinMalaysiaBounds(coarse.coords.latitude, coarse.coords.longitude)) {
          const coarseLocation = { lat: coarse.coords.latitude, lng: coarse.coords.longitude };
          setCurrentGpsLocation(coarseLocation);
          const coarseLabel = await resolveCurrentLocationAddress(coarseLocation.lat, coarseLocation.lng);
          if (cancelled) return;
          setCurrentAddress(`Current: ${coarseLabel}`);
          return;
        }
      } catch {
        // continue to short-lived precise cache fallback
      }

      const lastPrecise = readLastPreciseLocation();
      if (lastPrecise) {
        setCurrentGpsLocation({ lat: lastPrecise.lat, lng: lastPrecise.lng });
        setCurrentAddress(`Current: ${lastPrecise.address || formatCoordinateAddress(lastPrecise.lat, lastPrecise.lng)}`);
        return;
      }

      const approximate = await resolveApproximateLocation();
      if (cancelled) return;

      if (approximate) {
        setCurrentGpsLocation({ lat: approximate.lat, lng: approximate.lng });
        setCurrentAddress(`Current: ${approximate.label}`);
        return;
      }

      setCurrentGpsLocation(null);
      setCurrentAddress('Current: GPS unavailable — type location');
    };

    void hydrateCurrentAddress();

    return () => {
      cancelled = true;
    };
  }, [scanMode, isLoaded, resolveCurrentLocationAddress, getBestCurrentPosition, resolveApproximateLocation]);

  const generateSimulatedZone = (name: string, lat: number, lng: number): FloodZone => {
    // Simple hash function to generate consistent pseudo-random numbers based on location name
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash) + name.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    const pseudoRandom = (min: number, max: number) => {
      const x = Math.sin(hash++) * 10000;
      return min + (x - Math.floor(x)) * (max - min);
    };

    const severity = Math.floor(pseudoRandom(1, 10));
    const drainageBlockage = Math.floor(pseudoRandom(10, 99));
    const rainfall = Math.floor(pseudoRandom(0, 100));
    const now = new Date();
    const estimatedStartTime = severity >= 4 ? new Date(now.getTime() - 60 * 60 * 1000).toISOString() : undefined;
    const estimatedEndTime = severity >= 8
      ? new Date(now.getTime() + 18 * 60 * 60 * 1000).toISOString()
      : severity >= 4
      ? new Date(now.getTime() + 10 * 60 * 60 * 1000).toISOString()
      : undefined;
    
    let aiAnalysisText = "Normal conditions. No immediate flood risk detected.";
    if (severity >= 8) {
      aiAnalysisText = "Critical infrastructure failure. Evacuation advised for low-lying sectors due to uncontrolled drainage blockage.";
    } else if (severity >= 4) {
      aiAnalysisText = "Moderate risk detected. Water levels are rising in drainage systems. Monitor local advisories.";
    }

    const terrainTypes = ['Low', 'Flat', 'Hilly', 'Steep'];
    const terrainLabels = ['Depression', 'Plains', 'Slopes', 'High Ground'];
    const terrainIndex = Math.floor(pseudoRandom(0, 4));
    
    const historicalFreqs = ['0×/yr', '1×/yr', '2×/yr', '3+×/yr'];
    const historicalStatuses = ['Inactive', 'Monitor', 'Active', 'Critical'];
    const historicalIndex = Math.floor(pseudoRandom(0, 4));

    return {
      id: `simulated_${Date.now()}`,
      name: name,
      specificLocation: name,
      state: 'Unknown',
      region: 'Unknown',
      center: { lat, lng },
      paths: [], // No polygon for simulated zones
      severity,
      forecast: aiAnalysisText,
      color: severity >= 8 ? 'red' : severity >= 4 ? 'orange' : 'green',
      lastUpdated: new Date().toISOString(),
      drainageBlockage,
      rainfall,
      aiConfidence: Math.floor(pseudoRandom(70, 99)),
      aiAnalysisText,
      aiAnalysis: {
        waterDepth: severity >= 8 ? '> 1.0m' : severity >= 4 ? '0.3m - 1.0m' : '< 0.3m',
        currentSpeed: severity >= 8 ? 'Rapid' : severity >= 4 ? 'Moderate' : 'Slow',
        riskLevel: severity >= 8 ? 'High' : severity >= 4 ? 'Medium' : 'Low',
        historicalContext: 'Simulated Data'
      },
      aiRecommendation: {
        impassableRoads: severity >= 8 ? 'Multiple' : 'None',
        evacuationRoute: 'Follow local signs',
        evacuationCenter: 'Nearest school'
      },
      sources: ['AI Simulation', 'Weather API'],
      terrain: { type: terrainTypes[terrainIndex], label: terrainLabels[terrainIndex] },
      historical: { frequency: historicalFreqs[historicalIndex], status: historicalStatuses[historicalIndex] }
      ,
      estimatedStartTime,
      estimatedEndTime,
      status: severity >= 4 ? 'active' : 'resolved'
    };
  };

  const fetchRiskForLocation = async (locationName: string, lat: number, lng: number, requestId?: number) => {
    if (requestId !== undefined && requestId !== searchRequestIdRef.current) return;

    try {
      const risk: LocationRiskAnalysis = await Promise.race([
        analyzeLocationRisk(locationName, lat, lng),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Location risk analysis timeout')), 9000)
        )
      ]);
      const zone: FloodZone = {
        id: `live_${Date.now()}`,
        name: locationName,
        specificLocation: locationName,
        state: 'Malaysia',
        region: 'Malaysia',
        center: { lat, lng },
        paths: [],
        severity: risk.severity,
        forecast: risk.aiAnalysisText,
        color: risk.severity >= 8 ? 'red' : risk.severity >= 4 ? 'orange' : 'green',
        lastUpdated: new Date().toISOString(),
        drainageBlockage: risk.drainageBlockage,
        rainfall: risk.rainfall,
        aiConfidence: 90,
        aiAnalysisText: risk.aiAnalysisText,
        aiAnalysis: {
          waterDepth: risk.waterLevel === 'High' ? '> 1.0m' : risk.waterLevel === 'Medium' ? '0.3–1.0m' : '< 0.3m',
          currentSpeed: risk.waterLevelStatus === 'Rising' ? 'Rapid' : risk.waterLevelStatus === 'Stable' ? 'Moderate' : 'Slow',
          riskLevel: risk.severity >= 7 ? 'High' : risk.severity >= 4 ? 'Medium' : 'Low',
          historicalContext: risk.historical.frequency
        },
        aiRecommendation: {
          impassableRoads: risk.severity >= 8 ? 'Multiple reported' : 'None reported',
          evacuationRoute: 'Follow local authority signs',
          evacuationCenter: 'Nearest school or community hall'
        },
        sources: ['Gemini AI', 'Google Search', 'MetMalaysia', 'JPS'],
        terrain: risk.terrain,
        historical: risk.historical
        ,
        estimatedStartTime: risk.severity >= 4 ? new Date(Date.now() - 60 * 60 * 1000).toISOString() : undefined,
        estimatedEndTime:
          risk.severity >= 8
            ? new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString()
            : risk.severity >= 4
            ? new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString()
            : undefined,
        status: risk.severity >= 4 ? 'active' : 'resolved'
      };
      if (requestId !== undefined && requestId !== searchRequestIdRef.current) return;
      setLocationWarning('');
      setSearchedZone(zone);
    } catch {
      if (requestId !== undefined && requestId !== searchRequestIdRef.current) return;
      setSearchedZone(null);
      setIsSearchActive(false);
      setLocationWarning('Unable to fetch live flood analysis for this location right now. Please try again in a moment.');
    } finally {
      if (requestId !== undefined && requestId !== searchRequestIdRef.current) return;
      setIsLoadingRisk(false);
    }
  };

  const resolveMalaysiaLocation = async (query: string): Promise<ResolvedMapLocation | null> => {
    if (!(window.google && window.google.maps && window.google.maps.Geocoder && window.google.maps.places?.AutocompleteService)) {
      return null;
    }

    const autocomplete = new window.google.maps.places.AutocompleteService();
    const geocoder = new window.google.maps.Geocoder();

    const prediction = await new Promise<google.maps.places.AutocompletePrediction | null>((resolve) => {
      autocomplete.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: 'my' }
        },
        (predictions, status) => {
          const okStatus = window.google.maps.places.PlacesServiceStatus.OK;
          if (status !== okStatus || !predictions || predictions.length === 0) {
            resolve(null);
            return;
          }
          const matchedPrediction = predictions.find(prediction => predictionMatchesQuery(query, prediction)) || null;
          resolve(matchedPrediction);
        }
      );
    });

    if (!prediction?.place_id) return null;

    const result = await new Promise<google.maps.GeocoderResult | null>((resolve) => {
      geocoder.geocode({ placeId: prediction.place_id }, (results, status) => {
        if (status !== 'OK' || !results || !results[0]) {
          resolve(null);
          return;
        }
        resolve(results[0]);
      });
    });

    if (!result) return null;

    const location = result.geometry.location;
    const lat = location.lat();
    const lng = location.lng();
    const formattedAddress = result.formatted_address || '';
    const isMalaysiaResult = formattedAddress.toLowerCase().includes('malaysia');
    const withinBounds = lat >= 1.0 && lat <= 7.5 && lng >= 99.0 && lng <= 120.0;

    if (!isMalaysiaResult || !withinBounds) return null;

    return {
      lat,
      lng,
      address: formattedAddress,
    };
  };

  const markInvalidLocation = (message = 'Location not found in Malaysia Google Maps. Please enter a valid city, town, district, or landmark name.') => {
    setLocationNotFound(true);
    setLocationWarning(message);
    setSearchedZone(null);
    setIsSearchActive(false);
    setIsLoadingRisk(false);
  };

  const handleSelectingLocationSearch = async (queryOverride?: string) => {
    const query = (queryOverride ?? manualLocation).trim();
    if (!query) return;

    if (query.length < 3) {
      markInvalidLocation('Please enter the full name of a valid location in Malaysia Google Maps.');
      return;
    }

    if (!isMalaysianLocation(query)) {
      markInvalidLocation(getMalaysiaLocationWarning());
      return;
    }

    setLocationWarning('');
    setLocationNotFound(false);

    const resolved = await resolveMalaysiaLocation(query);
    if (!resolved) {
      markInvalidLocation();
      return;
    }

    setManualLocation(query);
    setScanMode('selecting');
    setMapCenter({ lat: resolved.lat, lng: resolved.lng });
    setMapZoom(16);

    if (mapRef.current) {
      mapRef.current.panTo({ lat: resolved.lat, lng: resolved.lng });
      mapRef.current.setZoom(16);
    }
  };

  const handleSearch = async (isSelectingMode = false, queryOverride?: string) => {
    const query = (queryOverride ?? manualLocation).trim();
    const requestId = ++searchRequestIdRef.current;

    if (!query) {
      if (!isSelectingMode) {
        setIsSearchActive(false);
        setSearchedZone(null);
        setIsLoadingRisk(false);
      }
      return;
    }

    if (query.length < 3) {
      markInvalidLocation('Please enter the full name of a valid location in Malaysia Google Maps.');
      return;
    }

    // Validate if location is Malaysian before searching
    if (!isMalaysianLocation(query)) {
      markInvalidLocation(getMalaysiaLocationWarning());
      return;
    }
    
    // Clear warning and not-found flag
    setLocationWarning('');
    setLocationNotFound(false);

    const resolved = await resolveMalaysiaLocation(query);
    if (requestId !== searchRequestIdRef.current) return;

    if (resolved) {
      const newCenter = { lat: resolved.lat, lng: resolved.lng };
      setMapCenter(newCenter);
      setMapZoom(14);
      if (!isSelectingMode) {
        setIsSearchActive(true);
        setSearchedZone(null);
        setIsLoadingRisk(true);
        void fetchRiskForLocation(query, resolved.lat, resolved.lng, requestId);
      }
      if (mapRef.current) {
        mapRef.current.panTo(newCenter);
        mapRef.current.setZoom(14);
      }
    } else {
      markInvalidLocation();
    }
  };

  const handleMicClick = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      setAudioError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          setIsAnalyzingAudio(true);
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64AudioMessage = reader.result as string;
            const base64Data = base64AudioMessage.split(',')[1];
            
            try {
              // Reduced timeout to 30 seconds for a more responsive experience
              const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error("Analysis timed out. Proceeding without audio analysis.")), 30000);
              });

              const result = await Promise.race([
                analyzeAudio(base64Data, 'audio/webm'),
                timeoutPromise
              ]);
              setAudioAnalysis(result);
              
              // Save audio analysis to Firebase
              try {
                // Get current location if available
                let currentLocation: { lat: number; lng: number; address: string } | undefined;
                if (navigator.geolocation) {
                  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject);
                  });
                  currentLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    address: 'Current Location'
                  };
                }
                
                await saveAudioAnalysis({
                  location: currentLocation,
                  analysis: result,
                  audioUrl: base64AudioMessage,
                  duration: audioBlob.size
                });
                console.log('✅ Audio analysis saved to Firebase');
              } catch (saveError) {
                console.error('Error saving audio analysis:', saveError);
              }
            } catch (error: any) {
              console.error("Audio analysis failed", error);
              if (!error?.message?.includes('timed out')) {
                setAudioError('Failed to analyze audio. Please try again.');
              } else {
                console.log('⏱️ Audio analysis timed out - proceeding without analysis');
              }
            } finally {
              setIsAnalyzingAudio(false);
            }
          };
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Error accessing microphone:", err);
        setAudioError('Microphone access is required to use this feature. Please allow microphone permissions and try again.');
      }
    }
  };

  // Simulate real-time updates
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => {
      setPulse(p => !p);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const getZoneColors = (severity: number) => {
    if (severity >= 8) return { fill: '#ef4444', stroke: '#dc2626' };
    if (severity >= 4) return { fill: '#f97316', stroke: '#ea580c' };
    return { fill: '#22c55e', stroke: '#16a34a' };
  };

  const getEndsInLabel = useCallback((zone: FloodZone): string | null => {
    const rawEnd = zone.estimatedEndTime;
    if (!rawEnd || rawEnd === 'N/A' || rawEnd === 'Unknown') {
      return null;
    }

    const end = new Date(rawEnd);
    if (Number.isNaN(end.getTime())) {
      return null;
    }

    const remainingMs = end.getTime() - Date.now();
    if (remainingMs <= 0) {
      return 'Ended';
    }

    const totalMinutes = Math.floor(remainingMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours <= 0) {
      return `Ends in ${minutes}m`;
    }

    return `Ends in ${hours}h ${minutes}m`;
  }, []);

  const getPolygonOptions = (zone: FloodZone) => {
    const { fill, stroke } = getZoneColors(zone.severity);
    return {
      fillColor: fill,
      fillOpacity: 0.35,
      strokeColor: stroke,
      strokeOpacity: 0.8,
      strokeWeight: 2,
      clickable: true,
      zIndex: 2
    };
  };

  // Build one circle per state, using the highest severity zone in that state
  const stateCircles = useMemo(() => {
    const byState: Record<string, FloodZone> = {};
    Object.values(zones).forEach(z => {
      const zone = z as FloodZone;
      if (!byState[zone.state] || zone.severity > byState[zone.state].severity) {
        byState[zone.state] = zone;
      }
    });
    return Object.values(byState);
  }, [zones]);

  return (
    <div className="relative h-full w-full flex flex-col bg-[#F9FAFB]">
      <div className="absolute top-0 w-full z-50 pointer-events-none">
        <StatusBar theme="light" />
      </div>

      <div className="flex-1 relative overflow-hidden">
        {/* Map Background */}
        <div className="absolute inset-0 z-0">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={mapCenter}
              zoom={mapZoom}
              options={mapOptions}
              onLoad={onMapLoad}
              onUnmount={onMapUnmount}
            >
              {/* State-level circles — visible at any zoom */}
              {stateCircles.map(zone => {
                const { fill, stroke } = getZoneColors(zone.severity);
                const radius = STATE_RADIUS_M[zone.state] ?? 40000;
                const fallbackCenter = STATE_CENTERS[zone.state] ?? { lat: 4.5, lng: 109.0 };
                const circleLat = (zone.center?.lat && zone.center.lat !== 0) ? zone.center.lat : fallbackCenter.lat;
                const circleLng = (zone.center?.lng && zone.center.lng !== 0) ? zone.center.lng : fallbackCenter.lng;
                return (
                  <Circle
                    key={`circle_${zone.state}`}
                    center={{ lat: circleLat, lng: circleLng }}
                    radius={radius}
                    options={{
                      fillColor: fill,
                      fillOpacity: 0.18,
                      strokeColor: stroke,
                      strokeOpacity: 0.7,
                      strokeWeight: 2,
                      clickable: true,
                      zIndex: 1,
                    }}
                    onClick={() => setSelectedZone(zone)}
                  />
                );
              })}

              {/* Fine-grained polygons — visible when zoomed in */}
              {Object.values(zones).map((z) => {
                const zone = z as FloodZone;
                if (!zone.paths || zone.paths.length === 0) return null;
                return (
                  <Polygon
                    key={zone.id}
                    paths={zone.paths}
                    options={getPolygonOptions(zone)}
                    onClick={() => setSelectedZone(zone)}
                  />
                );
              })}
            </GoogleMap>
          ) : (
            <div className="w-full h-full bg-slate-200 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-[#6366F1]/30 border-t-[#6366F1] rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        {/* Search Bar & Live Indicator */}
        <div className={`absolute top-20 left-0 right-0 px-4 z-40 flex flex-col gap-3 transition-opacity duration-300 ${scanMode === 'selecting' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex items-center bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl shadow-lg border border-white/20">
            <button onClick={() => void handleSearch()} className="material-icons-round text-slate-400 mr-3 hover:text-[#6366F1] transition-colors">search</button>
            <input 
              className="bg-transparent border-none outline-none text-slate-700 w-full p-0 focus:ring-0 placeholder-slate-400" 
              placeholder="Search location..." 
              type="text"
              value={manualLocation}
              onChange={(e) => {
                const value = e.target.value;
                setManualLocation(value);
                setLocationNotFound(false);
                
                // Validate if location is in Malaysia
                if (value.trim().length > 0 && !isMalaysianLocation(value)) {
                  setLocationWarning(getMalaysiaLocationWarning());
                } else {
                  setLocationWarning('');
                }
                
                if (value === '') {
                  setIsSearchActive(false);
                  setSearchedZone(null);
                  setIsLoadingRisk(false);
                  setLocationWarning('');
                  if (autoSearchTimerRef.current) {
                    clearTimeout(autoSearchTimerRef.current);
                    autoSearchTimerRef.current = null;
                  }
                } else if (!isMalaysianLocation(value)) {
                  setIsSearchActive(false);
                  setSearchedZone(null);
                  setIsLoadingRisk(false);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void handleSearch();
                }
              }}
            />
            <button onClick={handleMicClick} className={`material-icons-round ml-2 transition-colors ${isRecording ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-[#6366F1]'}`}>mic</button>
          </div>
          
          {/* Location Warning Message */}
          {locationWarning && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2 shadow-md">
              <span className="material-icons-round text-red-500 text-lg mt-0.5">warning</span>
              <p className="text-red-700 text-sm leading-relaxed">{locationWarning}</p>
            </div>
          )}

          {/* Location Not Found Message */}
          {locationNotFound && !locationWarning && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2 shadow-md">
              <span className="material-icons-round text-red-500 text-lg mt-0.5">location_off</span>
              <div>
                <p className="text-red-700 text-sm font-semibold">Location not found in Malaysia Google Maps</p>
                <p className="text-red-500 text-xs mt-0.5">"<span className="font-medium">{manualLocation}</span>" is not an existing location in Malaysia Google Maps. Please try a valid city, town, district, or landmark name.</p>
              </div>
            </div>
          )}
          
          {!isSearchActive && (
            <div className="self-center bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-md border border-white/20 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full bg-red-500 ${pulse ? 'opacity-100 scale-110' : 'opacity-50 scale-100'} transition-all duration-500`}></div>
              <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Live Monitoring Active</span>
            </div>
          )}
        </div>

        {/* Search Result Overlay */}
        {isSearchActive && (
          <div className="absolute top-40 left-0 right-0 bottom-24 px-4 z-30 flex flex-col gap-4 overflow-y-auto pb-4">
            {searchedZone ? (
              <div className="flex flex-col gap-4 pb-20">
                {/* Current Risk Level Card */}
                <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 relative flex-shrink-0">
                  <button 
                    onClick={() => {
                      setIsSearchActive(false);
                      setIsLoadingRisk(false);
                      setManualLocation('');
                    }}
                    className="absolute top-4 right-4 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"
                  >
                    <span className="material-icons-round text-sm">close</span>
                  </button>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center mb-2">Current Risk Level</p>
                  <div className="flex items-baseline justify-center gap-1 mb-4">
                    <span className="text-6xl font-black text-[#1e293b] tracking-tighter">{searchedZone.severity * 10}</span>
                    <span className="text-2xl font-bold text-[#ef4444]">%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
                    <div 
                      className={`h-full rounded-full ${searchedZone.severity >= 8 ? 'bg-gradient-to-r from-orange-400 to-red-500' : searchedZone.severity >= 4 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 'bg-gradient-to-r from-green-400 to-emerald-500'}`}
                      style={{ width: `${searchedZone.severity * 10}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider">
                    <span className={searchedZone.severity >= 8 ? 'text-[#ef4444]' : searchedZone.severity >= 4 ? 'text-orange-500' : 'text-green-500'}>
                      {searchedZone.severity >= 8 ? 'Critical Danger' : searchedZone.severity >= 4 ? 'Moderate Risk' : 'Low Risk'}
                    </span>
                    <span className="text-slate-400">
                      {searchedZone.severity >= 8 ? 'Extreme Alert' : searchedZone.severity >= 4 ? 'Warning' : 'Safe'}
                    </span>
                  </div>
                  {getEndsInLabel(searchedZone) && (
                    <div className="mt-3 flex justify-center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wide">
                        <span className="material-icons-round text-[12px]">schedule</span>
                        {getEndsInLabel(searchedZone)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Gemini AI Analysis Card */}
                <div className="bg-[#6366F1] rounded-2xl p-5 shadow-lg text-white flex-shrink-0">
                  <div className="flex items-center gap-2 mb-3 opacity-90">
                    <span className="material-icons-round text-sm">auto_awesome</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest">Gemini AI Analysis</span>
                  </div>
                  <p className="text-sm leading-relaxed font-medium">
                    "{searchedZone.aiAnalysisText}"
                  </p>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 flex-shrink-0">
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className={`material-icons-round text-sm ${searchedZone.severity >= 8 ? 'text-[#ef4444]' : searchedZone.severity >= 4 ? 'text-orange-500' : 'text-green-500'}`}>water_drop</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Drainage</span>
                    </div>
                    <div className="flex items-end justify-between mb-2">
                      <span className="text-2xl font-bold text-slate-800">{searchedZone.drainageBlockage}%</span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider pb-1 ${searchedZone.severity >= 8 ? 'text-[#ef4444]' : searchedZone.severity >= 4 ? 'text-orange-500' : 'text-green-500'}`}>
                        {searchedZone.severity >= 8 ? 'Severe' : searchedZone.severity >= 4 ? 'Moderate' : 'Clear'}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${searchedZone.severity >= 8 ? 'bg-[#ef4444]' : searchedZone.severity >= 4 ? 'bg-orange-500' : 'bg-green-500'}`} style={{ width: `${searchedZone.drainageBlockage}%` }} />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className={`material-icons-round text-sm ${searchedZone.severity >= 8 ? 'text-[#ef4444]' : searchedZone.severity >= 4 ? 'text-orange-500' : 'text-green-500'}`}>waves</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Water Level</span>
                    </div>
                    <div className="flex items-end justify-between mb-2">
                      <span className="text-2xl font-bold text-slate-800">{searchedZone.severity >= 8 ? 'High' : searchedZone.severity >= 4 ? 'Medium' : 'Low'}</span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider pb-1 ${searchedZone.severity >= 8 ? 'text-[#ef4444]' : searchedZone.severity >= 4 ? 'text-orange-500' : 'text-green-500'}`}>
                        {searchedZone.severity >= 8 ? 'Rising' : searchedZone.severity >= 4 ? 'Stable' : 'Normal'}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${searchedZone.severity >= 8 ? 'bg-[#ef4444] w-4/5' : searchedZone.severity >= 4 ? 'bg-orange-500 w-1/2' : 'bg-green-500 w-1/5'}`} />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="material-icons-round text-[#f97316] text-sm">terrain</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Terrain</span>
                    </div>
                    <div className="flex items-end justify-between mb-2">
                      <span className="text-2xl font-bold text-slate-800">{searchedZone.terrain?.type || 'Low'}</span>
                      <span className="text-[9px] font-bold text-[#f97316] uppercase tracking-wider pb-1">{searchedZone.terrain?.label || 'Depression'}</span>
                    </div>
                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#f97316] rounded-full w-full" />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="material-icons-round text-[#22c55e] text-sm">history</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Historical</span>
                    </div>
                    <div className="flex items-end justify-between mb-2">
                      <span className="text-2xl font-bold text-slate-800">{searchedZone.historical?.frequency || '2×/yr'}</span>
                      <span className="text-[9px] font-bold text-[#22c55e] uppercase tracking-wider pb-1">{searchedZone.historical?.status || 'Active'}</span>
                    </div>
                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#22c55e] rounded-full w-1/3" />
                    </div>
                  </div>
                </div>
              </div>
            ) : isLoadingRisk ? (
              <div className="flex flex-col gap-4 pb-20 animate-pulse">
                <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 relative flex-shrink-0">
                  <div className="h-4 bg-slate-100 rounded w-1/2 mx-auto mb-4" />
                  <div className="h-16 bg-slate-100 rounded w-1/3 mx-auto mb-4" />
                  <div className="h-2 bg-slate-100 rounded-full mb-2" />
                  <div className="flex justify-between">
                    <div className="h-3 bg-slate-100 rounded w-1/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/4" />
                  </div>
                  <p className="text-xs text-center text-slate-400 mt-4 animate-none">Fetching real-time flood data...</p>
                </div>
                <div className="bg-[#6366F1]/20 rounded-2xl p-5 h-24 flex-shrink-0" />
                <div className="grid grid-cols-2 gap-3 flex-shrink-0">
                  {[0,1,2,3].map(i => <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 h-24" />)}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Location Selection Search Bar */}
        <div className={`absolute top-20 left-0 right-0 px-4 z-40 transition-opacity duration-300 ${scanMode === 'selecting' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="flex flex-col gap-2">
            <div className="flex items-center bg-white px-4 py-3 rounded-2xl shadow-lg border border-slate-200">
              <button onClick={() => void handleSelectingLocationSearch()} className="material-icons-round text-slate-400 mr-3 hover:text-[#6366F1] transition-colors">search</button>
              <input 
                autoFocus={scanMode === 'selecting'}
                className="bg-transparent border-none outline-none text-slate-700 w-full p-0 focus:ring-0 placeholder-slate-400 font-medium" 
                placeholder="Type a location..." 
                type="text"
                value={manualLocation}
                onChange={(e) => {
                  const value = e.target.value;
                  setManualLocation(value);
                  
                  // Validate if location is in Malaysia
                  if (value.trim().length > 0 && !isMalaysianLocation(value)) {
                    setLocationWarning(getMalaysiaLocationWarning());
                  } else {
                    setLocationWarning('');
                  }
                  
                  if (value === '') {
                    setScanMode('modal');
                    setMapCenter({ lat: 4.5, lng: 109.0 });
                    setMapZoom(6);
                    setLocationWarning('');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void handleSelectingLocationSearch();
                }
              }}
            />
            <button onClick={handleMicClick} className={`material-icons-round ml-2 transition-colors ${isRecording ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-[#6366F1]'}`}>mic</button>
          </div>
          
          {/* Location Warning in Selecting Mode */}
          {locationWarning && scanMode === 'selecting' && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2 shadow-lg">
              <span className="material-icons-round text-red-500 text-base">warning</span>
              <p className="text-red-700 text-sm leading-relaxed flex-1">{locationWarning}</p>
            </div>
          )}
        </div>
      </div>

        {/* Scan Button */}
        <div className={`absolute bottom-28 left-0 right-0 flex justify-center z-40 transition-all duration-300 ${selectedZone || scanMode !== 'none' || isSearchActive ? 'translate-y-40 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
          <button 
            onClick={() => {
              setScanMode('modal');
            }}
            className="bg-[#6366F1] text-white px-6 py-4 rounded-full flex items-center gap-3 shadow-2xl hover:scale-105 active:scale-95 transition-transform duration-200"
          >
            <span className="material-icons-round">photo_camera</span>
            <span className="font-bold text-lg">Scan Near Me</span>
          </button>
        </div>

        {/* Location Selection Pointer */}
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-40 transition-opacity duration-300 ${scanMode === 'selecting' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="w-12 h-12 bg-[#ec5b13] rounded-full flex items-center justify-center shadow-lg mb-2 relative">
            <span className="material-icons-round text-white text-2xl">location_on</span>
            <div className="absolute -bottom-2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-[#ec5b13]"></div>
          </div>
          <div className="bg-white/90 backdrop-blur-sm px-4 py-1.5 rounded-full shadow-md border border-slate-200">
            <span className="text-[10px] font-bold text-slate-700 tracking-widest">DESTINATION</span>
          </div>
        </div>

        {/* Proceed Button for Selection Mode */}
        <div className={`absolute bottom-28 left-0 right-0 px-6 z-40 transition-all duration-300 ${scanMode === 'selecting' ? 'translate-y-0 opacity-100' : 'translate-y-40 opacity-0 pointer-events-none'}`}>
          <button 
            onClick={() => {
              setScanMode('none');
              onScanClick({ lat: mapCenter.lat, lng: mapCenter.lng, address: manualLocation || 'Selected Location' });
            }}
            className="w-full bg-[#ec5b13] text-white py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            PROCEED <span className="material-icons-round">arrow_forward</span>
          </button>
        </div>

        {/* Location Selection Modal */}
        {scanMode === 'modal' && (
          <>
            <div 
              className="absolute inset-0 bg-black/40 z-50 transition-opacity"
              onClick={() => setScanMode('none')}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl px-6 pt-6 pb-32 z-50 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-[slideUp_0.3s_ease-out]">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
              
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Where is the flood?</h2>
              
              <button 
                onClick={async () => {
                  let location = currentGpsLocation;

                  if (!location) {
                    const position = await getBestCurrentPosition();
                    if (position) {
                      location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                      };
                      setCurrentGpsLocation(location);
                    }
                  }

                  if (!location && navigator.geolocation) {
                    try {
                      const coarse = await getCurrentPositionWithOptions({
                        enableHighAccuracy: false,
                        timeout: 12000,
                        maximumAge: 600000,
                      });
                      if (isWithinMalaysiaBounds(coarse.coords.latitude, coarse.coords.longitude)) {
                        location = { lat: coarse.coords.latitude, lng: coarse.coords.longitude };
                        setCurrentGpsLocation(location);
                      }
                    } catch {
                      // keep null
                    }
                  }

                  if (!location) {
                    const lastPrecise = readLastPreciseLocation();
                    if (lastPrecise) {
                      location = { lat: lastPrecise.lat, lng: lastPrecise.lng };
                      setCurrentGpsLocation(location);
                    }
                  }

                  if (!location) {
                    const approximate = await resolveApproximateLocation();
                    if (approximate) {
                      location = { lat: approximate.lat, lng: approximate.lng };
                      setCurrentGpsLocation(location);
                    }
                  }

                  if (!location) {
                    setCurrentAddress('Current: GPS unavailable — type location');
                    setLocationWarning('Unable to detect your current location. Please type your location (e.g., Kajang).');
                    return;
                  }

                  setLocationWarning('');
                  const displayName = await resolveCurrentLocationAddress(location.lat, location.lng);
                  setScanMode('none');
                  onScanClick({ lat: location.lat, lng: location.lng, address: displayName });
                }}
                className="w-full flex items-center justify-center gap-3 bg-[#6366F1]/10 text-[#6366F1] py-4 rounded-2xl font-bold mb-4 active:scale-95 transition-transform"
              >
                {currentAddress === 'Fetching location...' ? (
                  <div className="w-5 h-5 border-2 border-[#6366F1]/30 border-t-[#6366F1] rounded-full animate-spin"></div>
                ) : (
                  <span className="material-icons-round">my_location</span>
                )}
                {currentAddress}
              </button>

              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="h-px bg-slate-200 flex-1"></div>
                <span className="text-slate-400 font-semibold text-sm">OR</span>
                <div className="h-px bg-slate-200 flex-1"></div>
              </div>

              <div className="relative mb-6">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="material-icons-round text-slate-400">search</span>
                </div>
                <input 
                  type="text"
                  placeholder="Type a location (e.g., Kajang)"
                  className="w-full bg-slate-100 border-none rounded-2xl py-4 pl-12 pr-12 text-slate-700 focus:ring-2 focus:ring-[#6366F1] outline-none"
                  value={manualLocation}
                  onChange={(e) => {
                    const value = e.target.value;
                    setManualLocation(value);
                    
                    // Validate if location is in Malaysia
                    if (value.trim().length > 0 && !isMalaysianLocation(value)) {
                      setLocationWarning(getMalaysiaLocationWarning());
                    } else {
                      setLocationWarning('');
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void handleSelectingLocationSearch(manualLocation);
                    }
                  }}
                />
                <button 
                  onClick={() => {
                    if (manualLocation.trim()) {
                      void handleSelectingLocationSearch(manualLocation);
                    }
                  }}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#6366F1] font-bold"
                >
                  Search
                </button>
              </div>
              
              {/* Location Warning in Modal */}
              {locationWarning && scanMode === 'modal' && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
                  <span className="material-icons-round text-red-500 text-base\">warning</span>
                  <p className="text-red-700 text-sm leading-relaxed flex-1">{locationWarning}</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Bottom Sheet Modal */}
        {selectedZone && (
          <>
            <div 
              className="absolute inset-0 bg-black/20 z-40 transition-opacity"
              onClick={() => setSelectedZone(null)}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-[slideUp_0.3s_ease-out] max-h-[85vh] overflow-y-auto">
              <div className="sticky top-0 bg-white pt-6 px-6 pb-3 border-b border-slate-100 z-10">
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4"></div>
                <div className="flex justify-between items-start">
                  <h2 className="text-2xl font-bold text-slate-900">{selectedZone.name}</h2>
                  <button 
                    onClick={() => setSelectedZone(null)}
                    className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 shrink-0 ml-2"
                  >
                    <span className="material-icons-round text-sm">close</span>
                  </button>
                </div>
              </div>

              <div className="px-6 pt-4 pb-32">
                {/* Current Risk Level */}
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-4 mb-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center mb-2">Current Risk Level</p>
                  <div className="flex items-baseline justify-center gap-1 mb-3">
                    <span className="text-5xl font-black text-[#1e293b] tracking-tighter">{selectedZone.severity * 10}</span>
                    <span className="text-xl font-bold text-[#ef4444]">%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${selectedZone.severity >= 8 ? 'bg-gradient-to-r from-orange-400 to-red-500' : selectedZone.severity >= 4 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 'bg-gradient-to-r from-green-400 to-emerald-500'}`}
                      style={{ width: `${selectedZone.severity * 10}%` }}
                    />
                  </div>
                  {getEndsInLabel(selectedZone) && (
                    <div className="mt-3 flex justify-center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wide">
                        <span className="material-icons-round text-[12px]">schedule</span>
                        {getEndsInLabel(selectedZone)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Gemini AI Analysis */}
                <div className="bg-[#6366F1] rounded-2xl p-4 mb-4 text-white">
                  <div className="flex items-center gap-2 mb-2 opacity-90">
                    <span className="material-icons-round text-sm">auto_awesome</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest">Gemini AI Analysis</span>
                  </div>
                  <p className="text-sm leading-relaxed font-medium">
                    "{selectedZone.aiAnalysisText}"
                  </p>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className={`material-icons-round text-sm ${selectedZone.severity >= 8 ? 'text-[#ef4444]' : selectedZone.severity >= 4 ? 'text-orange-500' : 'text-green-500'}`}>water_drop</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Drainage</span>
                    </div>
                    <div className="flex items-end justify-between mb-2">
                      <span className="text-2xl font-bold text-slate-800">{selectedZone.drainageBlockage}%</span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider pb-1 ${selectedZone.severity >= 8 ? 'text-[#ef4444]' : selectedZone.severity >= 4 ? 'text-orange-500' : 'text-green-500'}`}>
                        {selectedZone.severity >= 8 ? 'Severe' : selectedZone.severity >= 4 ? 'Moderate' : 'Clear'}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${selectedZone.severity >= 8 ? 'bg-[#ef4444]' : selectedZone.severity >= 4 ? 'bg-orange-500' : 'bg-green-500'}`} style={{ width: `${selectedZone.drainageBlockage}%` }} />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className={`material-icons-round text-sm ${selectedZone.severity >= 8 ? 'text-[#ef4444]' : selectedZone.severity >= 4 ? 'text-orange-500' : 'text-green-500'}`}>waves</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Water Level</span>
                    </div>
                    <div className="flex items-end justify-between mb-2">
                      <span className="text-2xl font-bold text-slate-800">{selectedZone.severity >= 8 ? 'High' : selectedZone.severity >= 4 ? 'Medium' : 'Low'}</span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider pb-1 ${selectedZone.severity >= 8 ? 'text-[#ef4444]' : selectedZone.severity >= 4 ? 'text-orange-500' : 'text-green-500'}`}>
                        {selectedZone.severity >= 8 ? 'Rising' : selectedZone.severity >= 4 ? 'Stable' : 'Normal'}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${selectedZone.severity >= 8 ? 'bg-[#ef4444] w-4/5' : selectedZone.severity >= 4 ? 'bg-orange-500 w-1/2' : 'bg-green-500 w-1/5'}`} />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="material-icons-round text-[#f97316] text-sm">terrain</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Terrain</span>
                    </div>
                    <div className="flex items-end justify-between mb-2">
                      <span className="text-2xl font-bold text-slate-800">{selectedZone.terrain?.type || 'Low'}</span>
                      <span className="text-[9px] font-bold text-[#f97316] uppercase tracking-wider pb-1">{selectedZone.terrain?.label || 'Depression'}</span>
                    </div>
                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#f97316] rounded-full w-full" />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="material-icons-round text-[#22c55e] text-sm">history</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Historical</span>
                    </div>
                    <div className="flex items-end justify-between mb-2">
                      <span className="text-2xl font-bold text-slate-800">{selectedZone.historical?.frequency || '2×/yr'}</span>
                      <span className="text-[9px] font-bold text-[#22c55e] uppercase tracking-wider pb-1">{selectedZone.historical?.status || 'Active'}</span>
                    </div>
                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#22c55e] rounded-full w-3/4" />
                    </div>
                  </div>
                </div>

                {/* Forecast & Sources */}
                <div className="bg-slate-50 rounded-2xl p-4 mb-4">
                  <h3 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider flex items-center gap-1">
                    <span className="material-icons-round text-sm">info</span>
                    Forecast & Status
                  </h3>
                  <p className="text-slate-700 text-sm leading-relaxed mb-3">
                    {selectedZone.forecast}
                  </p>
                  
                  <h3 className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Live Data Sources</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedZone.sources.map(source => (
                      <div key={source} className="bg-white text-slate-600 px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 border border-slate-200">
                        <span className="material-icons-round text-[14px]">
                          {source === 'CCTV Live' ? 'videocam' : source === 'User Reports' ? 'people' : 'cloud'}
                        </span>
                        {source}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">
                    Last updated: {new Date(selectedZone.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Audio Recording / Analyzing Overlay */}
        {(isRecording || isAnalyzingAudio) && (
          <div className="absolute inset-0 bg-black/40 z-[60] flex items-center justify-center">
            <div className="bg-white rounded-3xl p-6 shadow-xl w-64 text-center flex flex-col items-center">
              {isRecording ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4 animate-pulse">
                    <span className="material-icons-round text-red-500 text-3xl">mic</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Listening...</h3>
                  <p className="text-sm text-slate-500 mb-6">Recording environment sound</p>
                  <button 
                    onClick={handleMicClick}
                    className="w-full py-3 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600"
                  >
                    Stop Recording
                  </button>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 border-4 border-[#6366F1]/30 border-t-[#6366F1] rounded-full animate-spin mb-4"></div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Analyzing Audio...</h3>
                  <p className="text-sm text-slate-500 mb-4">Gemini AI is processing</p>
                  <p className="text-xs text-slate-400 mb-4">This may take up to 30 seconds</p>
                  <button
                    onClick={() => {
                      setIsAnalyzingAudio(false);
                      setAudioAnalysis(null);
                    }}
                    className="w-full py-2 rounded-lg font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 text-sm"
                  >
                    Skip Audio Analysis
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Audio Error Modal */}
        {audioError && (
          <div className="absolute inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 shadow-xl w-full max-w-sm text-center animate-[slideUp_0.3s_ease-out]">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <span className="material-icons-round text-red-500 text-3xl">mic_off</span>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Audio Error</h3>
              <p className="text-sm text-slate-500 mb-6">{audioError}</p>
              <button
                onClick={() => setAudioError(null)}
                className="w-full py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {/* Audio Analysis Result Modal */}
        {audioAnalysis && (
          <div className="absolute inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 shadow-xl w-full max-w-sm text-center animate-[slideUp_0.3s_ease-out]">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${audioAnalysis.isFloodRisk ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-500'}`}>
                <span className="material-icons-round text-3xl">
                  {audioAnalysis.isFloodRisk ? 'warning' : 'check_circle'}
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                {audioAnalysis.isFloodRisk ? 'Flood Risk Detected' : 'Everything is OK'}
              </h3>
              <p className="text-sm text-slate-500 mb-6">
                {audioAnalysis.analysis}
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setAudioAnalysis(null)}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Close
                </button>
                {audioAnalysis.isFloodRisk && (
                  <button 
                    onClick={() => {
                      setAudioAnalysis(null);
                      setScanMode('modal');
                    }}
                    className="flex-1 py-3 rounded-xl font-bold text-white bg-[#6366F1] hover:bg-[#4f46e5] transition-colors"
                  >
                    Scan Near Me
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <PrivacyNotice externalShow={showPrivacyInfo} onClose={() => setShowPrivacyInfo(false)} />

      <BottomNav activeTab="map" onTabChange={onTabChange} />
    </div>
  );
}
