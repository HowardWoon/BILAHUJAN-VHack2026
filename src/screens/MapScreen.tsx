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
import BottomNav from '../components/BottomNav';
import StatusBar from '../components/StatusBar';
import { PrivacyNotice } from '../components/PrivacyNotice';
import { FloodZone, useFloodZones } from '../data/floodZones';
import { analyzeAudio, AudioAnalysisResult } from '../services/gemini';
import { saveAudioAnalysis } from '../services/dataCollection';
import { isMalaysianLocation, getMalaysiaLocationWarning } from '../utils/locationValidator';

interface MapScreenProps {
  onScanClick: (location?: { lat: number; lng: number; address: string }) => void;
  onTabChange: (tab: 'map' | 'report' | 'alert' | 'dashboard') => void;
  initialShowLocationModal?: boolean;
}

const MALAYSIA_BOUNDS = {
  south: 1.0,
  west: 99.0,
  north: 7.0,
  east: 120.0,
};

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

  useEffect(() => {
    if (initialShowLocationModal) {
      setScanMode('modal');
    }
  }, [initialShowLocationModal]);

  // Try to get current location address when modal opens
  useEffect(() => {
    if (scanMode === 'modal') {
      setCurrentAddress('Fetching location...');
      
      if (navigator.geolocation && window.google && window.google.maps && window.google.maps.Geocoder) {
        navigator.geolocation.getCurrentPosition((pos) => {
          const geocoder = new window.google.maps.Geocoder();
          const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          geocoder.geocode({ location: latlng }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
              // Try to get a specific locality or sublocality
              const addressComponents = results[0].address_components;
              const sublocality = addressComponents.find(c => c.types.includes('sublocality_level_1') || c.types.includes('sublocality'))?.long_name;
              const locality = addressComponents.find(c => c.types.includes('locality'))?.long_name;
              const district = addressComponents.find(c => c.types.includes('administrative_area_level_2'))?.long_name;
              const state = addressComponents.find(c => c.types.includes('administrative_area_level_1'))?.long_name;
              
              let displayName: string;
              if (sublocality && locality) {
                displayName = `${sublocality}, ${locality}`;
              } else if (locality) {
                displayName = locality;
              } else if (district) {
                displayName = district;
              } else if (state) {
                displayName = state;
              } else {
                // Skip leading number tokens (e.g. street numbers) to get a meaningful name
                const parts = results[0].formatted_address.split(',');
                const meaningful = parts.find(p => isNaN(Number(p.trim())));
                displayName = meaningful ? meaningful.trim() : 'My Location';
              }
              setCurrentAddress(`Current: ${displayName}`);
            } else {
              setCurrentAddress('Current: Kuala Lumpur (Default)');
            }
          });
        }, () => {
          // Fallback if geolocation fails (common in preview iframes)
          setCurrentAddress('Current: Kuala Lumpur (Default)');
        }, { timeout: 5000 });
      } else {
        setCurrentAddress('Current: Kuala Lumpur (Default)');
      }
    }
  }, [scanMode]);

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
    };
  };

  const handleSearch = (isSelectingMode = false) => {
    if (!manualLocation.trim()) {
      if (!isSelectingMode) {
        setIsSearchActive(false);
        setSearchedZone(null);
      }
      return;
    }
    
    // Validate if location is Malaysian before searching
    if (!isMalaysianLocation(manualLocation)) {
      // Don't search for non-Malaysian locations
      if (!isSelectingMode) {
        setIsSearchActive(false);
        setSearchedZone(null);
      }
      setLocationWarning(getMalaysiaLocationWarning());
      return;
    }
    
    // Clear warning and not-found flag
    setLocationWarning('');
    setLocationNotFound(false);
    
    if (!isSelectingMode) {
      setIsSearchActive(true);
    }
    
    const searchLower = manualLocation.toLowerCase();
    
    // Check if it exactly matches a predefined zone first
    const matchedZone = Object.values(zones).find(z => {
      const zone = z as FloodZone;
      return zone.name.toLowerCase().includes(searchLower) || 
             zone.specificLocation.toLowerCase().includes(searchLower);
    }) as FloodZone | undefined;

    if (matchedZone) {
      const newCenter = { lat: matchedZone.center.lat, lng: matchedZone.center.lng };
      setMapCenter(newCenter);
      setMapZoom(14);
      if (!isSelectingMode) {
        setSearchedZone(matchedZone);
      }
      if (mapRef.current) {
        mapRef.current.panTo(newCenter);
        mapRef.current.setZoom(14);
      }
      return;
    }

    // Use Geocoder for NLP/address search to find the exact location
    if (window.google && window.google.maps && window.google.maps.Geocoder) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: `${manualLocation}, Malaysia` }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const result = results[0];
          const location = result.geometry.location;
          const lat = location.lat();
          const lng = location.lng();

          // Check 1: formatted address must explicitly contain "Malaysia"
          const formattedAddress = result.formatted_address || '';
          const isMalaysiaResult = formattedAddress.toLowerCase().includes('malaysia');

          // Check 2: coordinates within Malaysia's geographic bounds
          const withinBounds =
            lat >= 1.0 && lat <= 7.5 &&
            lng >= 99.0 && lng <= 120.0;

          // Check 3: result must be a real named place, not a fuzzy route/premise/plus-code match
          const VALID_PLACE_TYPES = new Set([
            'locality', 'sublocality', 'sublocality_level_1', 'sublocality_level_2',
            'neighborhood', 'colloquial_area',
            'administrative_area_level_1', 'administrative_area_level_2',
            'administrative_area_level_3', 'administrative_area_level_4',
            'natural_feature', 'establishment', 'point_of_interest',
            'park', 'airport', 'university', 'hospital', 'school',
          ]);
          const resultTypes: string[] = result.types || [];
          const isRealPlace = resultTypes.some(t => VALID_PLACE_TYPES.has(t));

          if (!isMalaysiaResult || !withinBounds || !isRealPlace) {
            setLocationNotFound(true);
            setSearchedZone(null);
            setIsSearchActive(false);
            return;
          }

          const newCenter = { lat, lng };
          setMapCenter(newCenter);
          setMapZoom(14);
          if (!isSelectingMode) {
            const simulatedZone = generateSimulatedZone(manualLocation, lat, lng);
            setSearchedZone(simulatedZone);
          }
          if (mapRef.current) {
            mapRef.current.panTo(newCenter);
            mapRef.current.setZoom(14);
          }
        } else {
          // Geocoding returned no results — show not found error
          setLocationNotFound(true);
          setSearchedZone(null);
          setIsSearchActive(false);
        }
      });
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
                return (
                  <Circle
                    key={`circle_${zone.state}`}
                    center={{ lat: zone.center.lat, lng: zone.center.lng }}
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
            <button onClick={handleSearch} className="material-icons-round text-slate-400 mr-3 hover:text-[#6366F1] transition-colors">search</button>
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
                  setLocationWarning('');
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
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
                <p className="text-red-700 text-sm font-semibold">Location not found in Malaysia</p>
                <p className="text-red-500 text-xs mt-0.5">"<span className="font-medium">{manualLocation}</span>" could not be matched to any place in Malaysia. Try a city, town, or district name.</p>
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
            ) : (
              <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 relative text-center">
                <button 
                  onClick={() => {
                    setIsSearchActive(false);
                    setManualLocation('');
                  }}
                  className="absolute top-4 right-4 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"
                >
                  <span className="material-icons-round text-sm">close</span>
                </button>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="material-icons-round text-green-500 text-3xl">check_circle</span>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Location is Safe</h3>
                <p className="text-sm text-slate-500 mb-4">
                  There are currently no active flood warnings or user reports for this area. Conditions appear to be normal.
                </p>
                <div className="flex justify-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <div className="flex items-center gap-1">
                    <span className="material-icons-round text-green-500 text-sm">water_drop</span>
                    Normal
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="material-icons-round text-green-500 text-sm">traffic</span>
                    Clear
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Location Selection Search Bar */}
        <div className={`absolute top-20 left-0 right-0 px-4 z-40 transition-opacity duration-300 ${scanMode === 'selecting' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="flex flex-col gap-2">
            <div className="flex items-center bg-white px-4 py-3 rounded-2xl shadow-lg border border-slate-200">
              <button onClick={handleSearch} className="material-icons-round text-slate-400 mr-3 hover:text-[#6366F1] transition-colors">search</button>
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
                    handleSearch();
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
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition((pos) => {
                      setScanMode('none');
                      const addressToUse = currentAddress.startsWith('Current: ') ? currentAddress.replace('Current: ', '') : 'Current Location';
                      onScanClick({ lat: pos.coords.latitude, lng: pos.coords.longitude, address: addressToUse });
                    }, () => {
                      // Fallback if geolocation fails
                      setScanMode('none');
                      onScanClick({ lat: 3.14, lng: 101.69, address: 'Kuala Lumpur (Default)' });
                    });
                  } else {
                    setScanMode('none');
                    onScanClick({ lat: 3.14, lng: 101.69, address: 'Kuala Lumpur (Default)' });
                  }
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
                      setScanMode('selecting');
                      handleSearch(true);
                    }
                  }}
                />
                <button 
                  onClick={() => {
                    if (manualLocation.trim()) {
                      setScanMode('selecting');
                      handleSearch(true);
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
