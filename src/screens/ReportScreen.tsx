import { useState, useEffect, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import BottomNav from '../components/BottomNav';
import { FloodAnalysisResult } from '../services/gemini';

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

export default function ReportScreen({ onTabChange, onScanClick, imageUri, onClearImage, analysisResult, initialLocation }: ReportScreenProps) {
  const [details, setDetails] = useState('');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [localAnalysisResult, setLocalAnalysisResult] = useState<FloodAnalysisResult | null>(null);
  const [matchedZoneId, setMatchedZoneId] = useState<string | null>(null);
  
  const [mapCenter, setMapCenter] = useState({ lat: 4.2105, lng: 101.9758 }); // Center of Malaysia
  const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [mapZoom, setMapZoom] = useState(6);
  const [searchQuery, setSearchQuery] = useState('');
  const [address, setAddress] = useState({ main: '', sub: '' });
  const [isEditingMap, setIsEditingMap] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [locationWarning, setLocationWarning] = useState<string>('');

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const reverseGeocode = (lat: number, lng: number) => {
    if (window.google && window.google.maps && window.google.maps.Geocoder) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const addressComponents = results[0].address_components;
          let main = results[0].formatted_address.split(',')[0];
          let sub = 'Malaysia';
          
          const route = addressComponents.find(c => c.types.includes('route'))?.long_name;
          const locality = addressComponents.find(c => c.types.includes('locality'))?.long_name;
          const state = addressComponents.find(c => c.types.includes('administrative_area_level_1'))?.long_name;
          
          if (route && locality) {
            main = `${route}, ${locality}`;
            sub = `${state || ''}, Malaysia`;
          } else if (locality) {
            main = locality;
            sub = `${state || ''}, Malaysia`;
          } else {
             main = results[0].formatted_address.split(',')[0];
             sub = results[0].formatted_address.split(',').slice(1).join(',').trim();
          }

          setAddress({ main, sub });
        }
      });
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    
    // Validate if location is Malaysian before searching
    if (!isMalaysianLocation(searchQuery)) {
      // Don't search for non-Malaysian locations
      setLocationWarning(getMalaysiaLocationWarning());
      return;
    }
    
    // Clear warning if location is valid
    setLocationWarning('');
    
    if (window.google && window.google.maps && window.google.maps.Geocoder) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: `${searchQuery}, Malaysia` }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const location = results[0].geometry.location;
          const newPos = { lat: location.lat(), lng: location.lng() };
          setMapCenter(newPos);
          setMarkerPosition(newPos);
          setMapZoom(16);
          if (mapRef.current) {
            mapRef.current.panTo(newPos);
            mapRef.current.setZoom(16);
          }
          reverseGeocode(newPos.lat, newPos.lng);
        } else {
          console.error("Geocoding failed: ", status);
        }
      });
    }
  };

  useEffect(() => {
    if (isLoaded) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const pos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            setMapCenter(pos);
            setMapZoom(14);
            // Do not set markerPosition or reverseGeocode automatically to keep address empty initially
          },
          () => {
            // Do nothing on error, leave address empty
          }
        );
      } else {
        // Do nothing if no geolocation, leave address empty
      }
    }
  }, [isLoaded]);

  useEffect(() => {
    if (initialLocation) {
      setMapCenter({ lat: initialLocation.lat, lng: initialLocation.lng });
      setMarkerPosition({ lat: initialLocation.lat, lng: initialLocation.lng });
      setMapZoom(16);
      setSearchQuery(initialLocation.address);
      setAddress({ main: initialLocation.address, sub: 'Malaysia' });
    }
  }, [initialLocation]);

  useEffect(() => {
    if (analysisResult) {
      setLocalAnalysisResult(analysisResult);
      return;
    }

    // Do not derive severity from static/live zones here.
    // Report screen must reflect Gemini image analysis only.
    setMatchedZoneId(null);
    setLocalAnalysisResult(null);
  }, [analysisResult, imageUri]);

  const toggleDept = (dept: string) => {
    setSelectedDepts(prev => 
      prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]
    );
  };

  // All four conditions must be met before submitting
  const hasLocation = !!address.main && !!markerPosition;
  const hasPhoto = !!imageUri;
  const hasAnalysis = !!localAnalysisResult;
  const hasDept = selectedDepts.length > 0;
  const canSubmit = hasLocation && hasPhoto && hasAnalysis && hasDept;

  const handleCancel = () => {
    setDetails('');
    setSelectedDepts([]);
    setSearchQuery('');
    setAddress({ main: '', sub: '' });
    setMarkerPosition(null);
    setMapZoom(6);
    setMapCenter({ lat: 4.2105, lng: 101.9758 });
    setIsEditingMap(false);
    setLocalAnalysisResult(null);
    setMatchedZoneId(null);
    setLocationWarning('');
    onClearImage();
    setIsSubmitted(false);
  };

  const handleSubmit = () => {
    setIsSubmitted(true);
    setTimeout(() => {
      onTabChange('map');
      handleCancel();
    }, 3000);
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
                if (e.key === 'Enter') handleSearch();
              }}
            />
            <button 
              onClick={handleSearch}
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
                      reverseGeocode(newPos.lat, newPos.lng);
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
                        reverseGeocode(newPos.lat, newPos.lng);
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
                    reverseGeocode(mapCenter.lat, mapCenter.lng);
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
              {address.main ? (
                <>
                  <p className="text-sm font-medium truncate">{address.main}</p>
                  <p className="text-xs text-slate-500">{address.sub}</p>
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
                { done: hasAnalysis, label: 'AI analysis completed on photo' },
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
