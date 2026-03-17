import { useState, useEffect, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { ref, set } from 'firebase/database';
import BottomNav from '../components/BottomNav';
import { analyzeFloodImage, FloodAnalysisResult } from '../services/gemini';
import { rtdb } from '../firebase';
import { normalizeStateName, normalizeToTownState } from '../utils/floodCalculations';

import { isMalaysianLocation, getMalaysiaLocationWarning } from '../utils/locationValidator';
import { officialLogos } from '../data/officialLogos';

const GOOGLE_MAPS_LIBRARIES: ('places')[] = ['places'];

interface ReportScreenProps {
  onTabChange: (tab: 'map' | 'report' | 'alert' | 'dashboard') => void;
  onScanClick: () => void;
  imageUri: string | null;
  onClearImage: () => void;
  analysisResult?: FloodAnalysisResult | null;
  initialLocation?: { lat: number; lng: number; address: string } | null;
}

interface SelectedLocation {
  lat: number;
  lng: number;
  locationName: string;
  state: string;
  address: string;
  geocodeComponents: any[];
  source: 'search' | 'gps' | 'map';
}

export default function ReportScreen({ onTabChange, onScanClick, imageUri, onClearImage, analysisResult, initialLocation }: ReportScreenProps) {
  const [details, setDetails] = useState('');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>('');
  const [localAnalysisResult, setLocalAnalysisResult] = useState<FloodAnalysisResult | null>(null);

  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(
    initialLocation
      ? {
          lat: initialLocation.lat,
          lng: initialLocation.lng,
          locationName: normalizeToTownState(initialLocation.address || ''),
          state: '',
          address: initialLocation.address || '',
          geocodeComponents: [],
          source: 'map',
        }
      : null
  );
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  
  const [mapCenter, setMapCenter] = useState(
    initialLocation
      ? { lat: initialLocation.lat, lng: initialLocation.lng }
      : { lat: 4.2105, lng: 101.9758 }
  );
  const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [mapZoom, setMapZoom] = useState(initialLocation ? 13 : 6);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingMap, setIsEditingMap] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [locationWarning, setLocationWarning] = useState<string>('');

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const reverseGeocodeToSelectedLocation = async (lat: number, lng: number, source: 'gps' | 'map' = 'map') => {
    setIsResolvingLocation(true);
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json`
        + `?latlng=${lat},${lng}`
        + `&region=MY`
        + `&components=country:MY`
        + `&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
      ).then((result) => result.json());

      const first = response.results?.[0];
      if (!first) return;
      const components = first.address_components ?? [];
      const normalizedLocationName = normalizeToTownState(first.formatted_address || '', components);
      const stateRaw = components.find((component: any) =>
        Array.isArray(component?.types) && component.types.includes('administrative_area_level_1')
      )?.long_name ?? '';
      const normalizedState = normalizeStateName(stateRaw);

      setSelectedLocation({
        lat,
        lng,
        locationName: normalizedLocationName,
        state: normalizedState,
        address: first.formatted_address || '',
        geocodeComponents: components,
        source,
      });
    } finally {
      setIsResolvingLocation(false);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    
    // Validate if location is Malaysian before searching
    if (!isMalaysianLocation(query)) {
      // Don't search for non-Malaysian locations
      setLocationWarning(getMalaysiaLocationWarning());
      return;
    }
    
    // Clear warning if location is valid
    setLocationWarning('');
    
    setIsResolvingLocation(true);
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json`
        + `?address=${encodeURIComponent(query)}`
        + `&region=MY`
        + `&components=country:MY`
        + `&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
      ).then((result) => result.json());

      const first = response.results?.[0];
      if (!first?.geometry?.location) return;
      const components = first.address_components ?? [];
      const lat = Number(first.geometry.location.lat);
      const lng = Number(first.geometry.location.lng);
      const locationName = normalizeToTownState(first.formatted_address || '', components);
      const state = normalizeStateName(
        components.find((component: any) =>
          Array.isArray(component?.types) && component.types.includes('administrative_area_level_1')
        )?.long_name ?? ''
      );

      const nextCenter = { lat, lng };
      setMapCenter(nextCenter);
      setMapZoom(13);
      setMarkerPosition(nextCenter);
      setSelectedLocation({
        lat,
        lng,
        locationName,
        state,
        address: first.formatted_address || '',
        geocodeComponents: components,
        source: 'search',
      });

      if (mapRef.current) {
        mapRef.current.panTo(nextCenter);
        mapRef.current.setZoom(13);
      }
    } finally {
      setIsResolvingLocation(false);
    }
  };

  useEffect(() => {
    if (isLoaded) {
      if (navigator.geolocation && !initialLocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const pos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            setMapCenter(pos);
            setMapZoom(14);
            setMarkerPosition(pos);
            await reverseGeocodeToSelectedLocation(pos.lat, pos.lng, 'gps');
          },
          () => {
            // Do nothing on error, leave address empty
          }
        );
      } else {
        // Do nothing if no geolocation, leave address empty
      }
    }
  }, [isLoaded, initialLocation]);

  useEffect(() => {
    if (initialLocation) {
      setMapCenter({ lat: initialLocation.lat, lng: initialLocation.lng });
      setMarkerPosition({ lat: initialLocation.lat, lng: initialLocation.lng });
      setMapZoom(13);
      setSearchQuery(initialLocation.address);
      void reverseGeocodeToSelectedLocation(initialLocation.lat, initialLocation.lng, 'map');
    }
  }, [initialLocation]);

  useEffect(() => {
    if (analysisResult) {
      setLocalAnalysisResult(analysisResult);
      return;
    }

    // Do not derive severity from static/live zones here.
    // Report screen must reflect Gemini image analysis only.
    setLocalAnalysisResult(null);
  }, [analysisResult, imageUri]);

  const toggleDept = (dept: string) => {
    setSelectedDepts(prev => 
      prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
    );
  };

  // All four conditions must be met before submitting
  const hasLocation = !!selectedLocation?.locationName && !!markerPosition;
  const hasPhoto = !!imageUri;
  const hasDept = selectedDepts.length > 0;
  const canSubmit = hasLocation && hasPhoto && hasDept && !isSubmitting;

  const handleCancel = () => {
    setDetails('');
    setSelectedDepts([]);
    setSearchQuery('');
    setSelectedLocation(null);
    setMarkerPosition(null);
    setMapZoom(6);
    setMapCenter({ lat: 4.2105, lng: 101.9758 });
    setIsEditingMap(false);
    setLocalAnalysisResult(null);
    setLocationWarning('');
    setSubmitError('');
    onClearImage();
    setIsSubmitted(false);
  };

  const handleSubmit = async () => {
    if (!imageUri) {
      setSubmitError('Please upload a photo (mandatory).');
      return;
    }

    if (!selectedLocation) {
      setSubmitError('Please confirm a valid Malaysian location before submitting.');
      return;
    }

    setSubmitError('');
    setIsSubmitting(true);

    try {
      const imageMatch = imageUri.match(/^data:(.*?);base64,(.*)$/);
      if (!imageMatch) {
        throw new Error('Invalid image format. Please retake or re-upload the photo.');
      }

      const mimeType = imageMatch[1] || 'image/jpeg';
      const base64Image = imageMatch[2] || '';
      if (!base64Image) {
        throw new Error('Image data is empty. Please re-upload the photo.');
      }

      const analyzed = await analyzeFloodImage(base64Image, mimeType);
      setLocalAnalysisResult(analyzed);

      const severity = Math.max(1, Math.min(10, Math.round(Number(analyzed.riskScore || 1))));
      const zoneId = `user_reported_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const reportId = `report_${zoneId}_${Date.now()}`;

      await set(ref(rtdb, `liveZones/${zoneId}`), {
        id: zoneId,
        name: selectedLocation.locationName,
        specificLocation: selectedLocation.locationName,
        locationName: normalizeToTownState(selectedLocation.address, selectedLocation.geocodeComponents),
        state: selectedLocation.state,
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
        center: { lat: selectedLocation.lat, lng: selectedLocation.lng },
        severity,
        source: 'user',
        isWeatherFallbackZone: false,
        reportId,
        uploadedAt: Date.now(),
        firstReportedAt: Date.now(),
        startTime: new Date().toISOString(),
        endTime: null,
        description: analyzed.directive,
        tips: analyzed.detectedHazards
          ? analyzed.detectedHazards.split(/[,;]/).map((item) => item.trim()).filter(Boolean).slice(0, 5)
          : [],
        analysisData: {
          waterDepth: analyzed.waterDepth,
          confidence: analyzed.aiConfidence,
          sceneContext: analyzed.infrastructureStatus,
        },
        aiConfidence: analyzed.aiConfidence,
        aiAnalysisText: analyzed.directive,
        eventType: analyzed.eventType,
        estimatedStartTime: analyzed.estimatedStartTime,
        estimatedEndTime: analyzed.estimatedEndTime,
        status: severity >= 7 ? 'active' : severity >= 4 ? 'warning' : 'monitor',
        timestamp: Date.now(),
      });

      await set(ref(rtdb, `liveReports/${reportId}`), {
        id: reportId,
        zoneId,
        state: selectedLocation.state,
        locationName: normalizeToTownState(selectedLocation.address, selectedLocation.geocodeComponents),
        severity,
        source: 'user',
        timestamp: Date.now(),
        description: details,
      });

      setIsSubmitted(true);
      setTimeout(() => {
        onTabChange('map');
        handleCancel();
      }, 3000);
    } catch (error: any) {
      console.error('Report submission error:', error);
      setSubmitError(error?.message || 'Analysis failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="relative h-full w-full flex flex-col bg-[#f8f6f6] items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <span className="material-icons-round text-green-500 text-4xl">check_circle</span>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Report Submitted!</h2>
        <p className="text-slate-600 mb-6">
          Your report has been successfully submitted.
          {selectedDepts.length > 0 && (
            <span className="block mt-2 font-medium">
              Notified: {selectedDepts.join(', ')}
            </span>
          )}
        </p>
        <div className="w-6 h-6 border-2 border-[#ec5b13]/30 border-t-[#ec5b13] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full flex flex-col bg-[#f8f6f6] text-slate-900">
      <header className="sticky top-0 z-50 bg-[#f8f6f6]/80 backdrop-blur-md border-b border-slate-200">
        <div className="flex items-center p-4 justify-between max-w-md mx-auto">
          <button 
            onClick={() => onTabChange('map')}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-200 transition-colors"
          >
            <span className="material-icons-round">arrow_back</span>
          </button>
          <h1 className="text-lg font-bold leading-tight tracking-tight flex-1 text-center pr-10">Report Flood</h1>
        </div>
      </header>
      
      <main className="flex-1 max-w-md mx-auto w-full pb-32 overflow-y-auto">
        {/* 1. Confirm Location */}
        <section className="p-4 space-y-3">
          <h3 className="text-base font-bold leading-tight">1. Confirm Location</h3>
          
          <div className="relative flex items-center bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-3">
            <div className="pl-3 text-slate-400">
              <span className="material-icons-round">search</span>
            </div>
            <input 
              type="text"
              placeholder="Search location..."
              className="flex-1 py-3 px-3 outline-none text-sm text-slate-700"
              value={searchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
                
                // Validate if location is in Malaysia
                if (value.trim().length > 0 && !isMalaysianLocation(value)) {
                  setLocationWarning(getMalaysiaLocationWarning());
                } else {
                  setLocationWarning('');
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSearch(searchQuery);
              }}
            />
            <button 
              onClick={() => void handleSearch(searchQuery)}
              className="bg-[#ec5b13] text-white px-4 py-3 text-sm font-bold hover:bg-[#d04e0f] transition-colors h-full"
            >
              Search
            </button>
          </div>

          {/* Location Warning Message */}
          {locationWarning && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
              <span className="material-icons-round text-red-500 text-base">warning</span>
              <p className="text-red-700 text-sm leading-relaxed flex-1">{locationWarning}</p>
            </div>
          )}

          <div className="relative group">
            <div className="w-full aspect-video bg-slate-200 rounded-xl overflow-hidden border border-slate-200 relative">
              {isLoaded ? (
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  center={mapCenter}
                  zoom={mapZoom}
                  options={{
                    disableDefaultUI: true,
                    gestureHandling: isEditingMap ? 'greedy' : 'none',
                  }}
                  onLoad={(map) => mapRef.current = map}
                  onUnmount={() => mapRef.current = null}
                  onClick={(e) => {
                    if (isEditingMap && e.latLng) {
                      const newPos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                      setMarkerPosition(newPos);
                      setMapCenter(newPos);
                      void reverseGeocodeToSelectedLocation(newPos.lat, newPos.lng, 'map');
                    }
                  }}
                >
                  <Marker 
                    position={markerPosition || mapCenter} 
                    draggable={isEditingMap}
                    visible={markerPosition !== null || isEditingMap}
                    onDragEnd={(e) => {
                      if (e.latLng) {
                        const newPos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                        setMarkerPosition(newPos);
                        setMapCenter(newPos);
                        void reverseGeocodeToSelectedLocation(newPos.lat, newPos.lng, 'map');
                      }
                    }}
                  />
                </GoogleMap>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-[#ec5b13]/30 border-t-[#ec5b13] rounded-full animate-spin"></div>
                </div>
              )}
              
              {!isEditingMap && (
                <div className="absolute inset-0 bg-transparent z-10" />
              )}
            </div>
            <div className="absolute bottom-3 right-3 z-20">
              <button 
                onClick={() => {
                  if (!isEditingMap && !markerPosition) {
                    setMarkerPosition(mapCenter);
                    void reverseGeocodeToSelectedLocation(mapCenter.lat, mapCenter.lng, 'map');
                  }
                  setIsEditingMap(!isEditingMap);
                }}
                className={`backdrop-blur shadow-sm border px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${isEditingMap ? 'bg-[#ec5b13] text-white border-[#ec5b13]' : 'bg-white/90 border-slate-200 text-slate-700 hover:bg-white'}`}
              >
                <span className="material-icons-round text-sm">{isEditingMap ? 'check' : 'edit'}</span> 
                {isEditingMap ? 'Done' : 'Edit'}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200">
            <div className="bg-[#ec5b13]/10 p-2 rounded-lg">
              <span className="material-icons-round text-[#ec5b13]">map</span>
            </div>
            <div className="flex-1 min-w-0">
              {isResolvingLocation ? (
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <div className="w-4 h-4 border-2 border-[#ec5b13]/30 border-t-[#ec5b13] rounded-full animate-spin" />
                  <span>Detecting location...</span>
                </div>
              ) : selectedLocation?.locationName ? (
                <>
                  <p className="text-sm font-semibold text-gray-800 truncate">{selectedLocation.locationName}</p>
                  <p className="text-xs text-gray-400">{selectedLocation.state || ''}</p>
                </>
              ) : (
                <p className="text-sm font-medium text-slate-500 italic">Please search or select a location on the map</p>
              )}
            </div>
          </div>
        </section>

        {/* 2. Upload Photo */}
        <section className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold leading-tight">2. Upload Photo</h3>
            <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-md">MANDATORY</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            <button 
              onClick={onScanClick}
              className="w-24 h-24 shrink-0 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-[#ec5b13] hover:border-[#ec5b13] transition-colors bg-white"
            >
              <span className="material-icons-round text-2xl">add_a_photo</span>
              <span className="text-[10px] font-medium">Add Photo</span>
            </button>
            {imageUri && (
              <div className="relative w-24 h-24 shrink-0 rounded-xl overflow-hidden border border-slate-200">
                <div 
                  className="w-full h-full bg-cover bg-center" 
                  style={{ backgroundImage: `url('${imageUri}')` }}
                />
                <button 
                  onClick={onClearImage}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center"
                >
                  <span className="material-icons-round text-[14px]">close</span>
                </button>
              </div>
            )}
          </div>
        </section>

        {/* 3. Additional Details */}
        <section className="p-4 space-y-3">
          <h3 className="text-base font-bold leading-tight">3. Additional Details</h3>
          <textarea 
            className="w-full rounded-xl border border-slate-200 bg-white focus:ring-[#ec5b13] focus:border-[#ec5b13] text-sm p-3 outline-none" 
            placeholder="Describe the situation (e.g., water rising fast, road blocked by debris...)" 
            rows={3}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
        </section>

        {/* 4. Notify Official Resources */}
        <section className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold leading-tight">4. Notify Official Resources</h3>
            <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-md">MANDATORY</span>
          </div>
          <p className="text-xs text-slate-600 mb-2">Select which authorities to notify about this flood report:</p>
          <div className="space-y-2">
            {[
              { name: 'JPS (Water Management)', logo: officialLogos.JPS },
              { name: 'NADMA (Disaster Management)', logo: officialLogos.NADMA },
              { name: 'APM (Local Authority)', logo: officialLogos.APM }
            ].map((dept) => (
              <label key={dept.name} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                <input 
                  type="checkbox"
                  checked={selectedDepts.includes(dept.name)}
                  onChange={() => toggleDept(dept.name)}
                  className="w-4 h-4 rounded accent-[#ec5b13]"
                />
                <img src={dept.logo} alt={dept.name} className="w-10 h-10 object-contain" />
                <span className="text-sm font-medium text-slate-700 flex-1">{dept.name}</span>
              </label>
            ))}
          </div>
          {selectedDepts.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs text-green-800 font-medium">
                ✓ Notifying: {selectedDepts.join(', ')}
              </p>
            </div>
          )}
        </section>

        {/* 5. AI Analysis Results */}
        <section className="p-4 space-y-3">
          <h3 className="text-base font-bold leading-tight">5. AI Analysis Results</h3>
          {localAnalysisResult ? (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-sm font-bold text-slate-700">Overall Severity</span>
                <div className={`px-3 py-1 rounded-full text-xs font-bold text-white ${
                  localAnalysisResult.severity === 'CRITICAL' ? 'bg-red-600' :
                  localAnalysisResult.severity === 'SEVERE' ? 'bg-orange-600' :
                  localAnalysisResult.severity === 'MODERATE' ? 'bg-yellow-500' : 'bg-green-500'
                }`}>
                  {localAnalysisResult.severity}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Water Depth</p>
                  <p className="text-xs font-semibold text-slate-800">{localAnalysisResult.waterDepth}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Water Flow</p>
                  <p className="text-xs font-semibold text-slate-800">{localAnalysisResult.waterCurrent}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Infrastructure</p>
                  <p className="text-xs font-semibold text-slate-800">{localAnalysisResult.infrastructureStatus}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Human Risk</p>
                  <p className="text-xs font-semibold text-slate-800">{localAnalysisResult.humanRisk}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 col-span-2">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Estimated Start</p>
                      <p className="text-xs font-semibold text-slate-800">{localAnalysisResult.estimatedStartTime}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Estimated End</p>
                      <p className="text-xs font-semibold text-slate-800">{localAnalysisResult.estimatedEndTime}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-100 rounded-xl border border-slate-200 p-6 flex flex-col items-center justify-center text-center gap-2">
              <span className="material-icons-round text-slate-400 text-3xl">analytics</span>
              <p className="text-sm text-slate-500 font-medium">
                Upload and scan a photo to get Gemini AI severity analysis
              </p>
            </div>
          )}
        </section>

        <div className="p-4 space-y-3 mt-4 pb-28">
          {/* Submission checklist — shown when form is incomplete */}
          {!canSubmit && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Complete these to submit:</p>
              {[
                { done: hasLocation, label: 'Confirm a location on the map' },
                { done: hasPhoto,    label: 'Upload a flood photo' },
                { done: hasDept,    label: 'Select at least one authority to notify' },
              ].map(({ done, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={`material-icons-round text-base ${done ? 'text-green-500' : 'text-slate-300'}`}>
                    {done ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  <span className={`text-sm ${done ? 'text-green-700 line-through' : 'text-slate-600'}`}>{label}</span>
                </div>
              ))}
            </div>
          )}

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              {submitError}
            </div>
          )}

          <button 
            onClick={canSubmit ? handleSubmit : undefined}
            disabled={!canSubmit}
            className={`w-full font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 ${
              canSubmit
                ? 'bg-[#ec5b13] hover:bg-[#ec5b13]/90 text-white shadow-lg shadow-[#ec5b13]/20 active:scale-[0.98] cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <span className="material-icons-round">send</span>
            Submit Report
          </button>
          <button 
            onClick={handleCancel}
            className="w-full bg-white border-2 border-slate-300 text-slate-600 font-bold py-4 rounded-xl hover:bg-slate-50 hover:text-slate-800 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span className="material-icons-round">close</span>
            Cancel & Clear
          </button>
        </div>
      </main>

      <BottomNav activeTab="report" onTabChange={onTabChange} />
    </div>
  );
}
