import { useState, useEffect } from 'react';
import SplashScreen from './screens/SplashScreen';
import MapScreen from './screens/MapScreen';
import CameraScreen from './screens/CameraScreen';
import ResultScreen from './screens/ResultScreen';
import AlertsScreen from './screens/AlertsScreen';
import AlertDetailScreen from './screens/AlertDetailScreen';
import ZoneDetailScreen from './screens/ZoneDetailScreen';
import ReportScreen from './screens/ReportScreen';
import { GovernmentDashboard } from './screens/GovernmentDashboard';
import { FloodAnalysisResult } from './services/gemini';
import { FloodZone } from './data/floodZones';
import { 
  initializeDataCollection, 
  startContinuousMonitoring, 
  stopContinuousMonitoring 
} from './services/dataCollection';
import { getFloodZones } from './data/floodZones';
import { PrivacyNotice } from './components/PrivacyNotice';
import { fixFederalTerritoryDuplicates, migrateLocationNames, purgeHardcodedSeedZones, resetBaselineSeverities } from './utils/cleanupSeedZones';

type Screen = 'splash' | 'map' | 'camera' | 'result' | 'alerts' | 'alert-detail' | 'zone-detail' | 'report' | 'dashboard';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [analysisResult, setAnalysisResult] = useState<FloodAnalysisResult | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [startMapWithScan, setStartMapWithScan] = useState(false);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [selectedAlertState, setSelectedAlertState] = useState<string | null>(null);
  const [focusedAlertZoneId, setFocusedAlertZoneId] = useState<string | null>(null);
  const [selectedZoneDetail, setSelectedZoneDetail] = useState<FloodZone | null>(null);
  const [cameraOrigin, setCameraOrigin] = useState<'map' | 'report' | 'alerts' | 'alert-detail'>('map');
  const [scanLocation, setScanLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);

  useEffect(() => {
    const shouldRunStartupMaintenance = import.meta.env.VITE_RUN_STARTUP_MAINTENANCE === 'true';
    if (shouldRunStartupMaintenance) {
      fixFederalTerritoryDuplicates().catch((error) => {
        console.warn('Federal Territory duplicate fix failed (non-fatal):', error);
      });

      resetBaselineSeverities().catch((error) => {
        console.warn('Baseline severity reset failed (non-fatal):', error);
      });

      purgeHardcodedSeedZones()
        .then((deletedCount) => {
          if (deletedCount > 0) {
            console.log(`🧹 Purged ${deletedCount} hardcoded seed zones from liveZones`);
          }
        })
        .catch((error) => {
          console.warn('Hardcoded seed zone purge failed (non-fatal):', error);
        });

      migrateLocationNames()
        .then(() => {
          console.log('Location migration done');
          window.setTimeout(() => {
            migrateLocationNames()
              .then(() => console.log('Location migration done (pass 2)'))
              .catch((error) => console.warn('Location migration pass 2 failed (non-fatal):', error));
          }, 1500);
        })
        .catch((error) => {
          console.warn('Location migration failed (non-fatal):', error);
        });
    }

    // Initialize 24/7 data collection system
    initializeDataCollection();
    
    // Start continuous monitoring
    const zones = getFloodZones();
    startContinuousMonitoring(zones);
    
    console.log('🚀 BILAHUJAN 24/7 Data Collection Active');
    
    // Cleanup on unmount
    return () => {
      stopContinuousMonitoring();
      console.log('⏹️ Data collection stopped');
    };
  }, []);

  useEffect(() => {
    // Simulate splash screen delay
    const timer = setTimeout(() => {
      setCurrentScreen('map');
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const addNotifications = () => {};

  const clearNotifications = () => {};

  const handleTabChange = (tab: 'map' | 'report' | 'alert' | 'dashboard') => {
    if (tab === 'map') {
      setStartMapWithScan(false);
      setCurrentScreen('map');
    }
    if (tab === 'report') setCurrentScreen('report');
    if (tab === 'dashboard') setCurrentScreen('dashboard');
    if (tab === 'alert') {
      setSelectedAlertState(null); // normal tab navigation → show full list
      setFocusedAlertZoneId(null);
      setCurrentScreen('alerts');
    }
  };

  const openLocationAlertFromDashboard = (state: string, zoneId: string) => {
    setSelectedAlertState(state);
    setFocusedAlertZoneId(zoneId);
    setCurrentScreen('alerts');
  };

  const handleHelpCommunity = () => {
    window.open('https://padlet.com/howardwoonhz06/bilahujan-discord-hjkr0lodg6fqhqqm', '_blank');
  };

  const handleAnalysisComplete = (result: FloodAnalysisResult, uri: string) => {
    setAnalysisResult(result);
    setImageUri(uri);
    if (cameraOrigin === 'report') {
       setCurrentScreen('report');
    } else {
       setCurrentScreen('result');
    }
  };

  return (
    <div className="relative w-full h-full font-display overflow-hidden">
      {currentScreen === 'splash' && <SplashScreen />}
      
      {currentScreen === 'map' && (
        <MapScreen 
          onScanClick={(loc) => {
            if (loc) setScanLocation(loc);
            setCameraOrigin('map');
            setCurrentScreen('camera');
          }} 
          onTabChange={handleTabChange} 
          initialShowLocationModal={startMapWithScan}
        />
      )}
      
      {currentScreen === 'camera' && (
        <CameraScreen 
          onBack={() => {
            if (cameraOrigin === 'report') setCurrentScreen('report');
            else if (cameraOrigin === 'alert-detail') setCurrentScreen('alert-detail');
            else if (cameraOrigin === 'alerts') setCurrentScreen('alerts');
            else setCurrentScreen('map');
          }}
          onAnalysisComplete={handleAnalysisComplete}
          onTabChange={handleTabChange}
        />
      )}
      
      {currentScreen === 'result' && analysisResult && imageUri && (
        <ResultScreen 
          result={analysisResult}
          imageUri={imageUri}
          location={scanLocation}
          onBack={() => setCurrentScreen('camera')}
          onTabChange={handleTabChange}
          zoneId={cameraOrigin === 'alert-detail' ? selectedAlertId : null}
          onUploadAlert={(zoneId, zone) => {
            setSelectedAlertState(zone.state);
            setFocusedAlertZoneId(zoneId);
            setSelectedAlertId(zoneId);
            setSelectedZoneDetail(zone);
            try {
              window.localStorage.setItem('bilahujan_unviewed_uploads', '0');
              window.dispatchEvent(new CustomEvent('unviewedUploadsChanged'));
            } catch {
              // non-fatal
            }
            setCurrentScreen('zone-detail');
          }}
        />
      )}
      
      {/* Keep ReportScreen mounted while camera is open (cameraOrigin==='report') so local state (location, address, marker) is preserved */}
      {(currentScreen === 'report' || (currentScreen === 'camera' && cameraOrigin === 'report')) && (
        <div className={`${currentScreen === 'report' ? 'block' : 'hidden'} h-full w-full`}>
          <ReportScreen 
            onTabChange={handleTabChange}
            onScanClick={() => {
              setCameraOrigin('report');
              setCurrentScreen('camera');
            }}
            imageUri={imageUri}
            onClearImage={() => {
              setImageUri(null);
              setAnalysisResult(null); // Clear analysis when image is cleared
              setScanLocation(null);
            }}
            analysisResult={analysisResult}
            initialLocation={scanLocation}
          />
        </div>
      )}
      
      {currentScreen === 'alerts' && (
        <AlertsScreen 
          onTabChange={handleTabChange}
          onAlertClick={(zoneId) => {
            setFocusedAlertZoneId(zoneId);
            setSelectedAlertId(zoneId);
            setCurrentScreen('alert-detail');
          }}
          onStateClick={(stateName) => {
            setSelectedAlertState(stateName);
            setSelectedAlertId(null);
            setCurrentScreen('alert-detail');
          }}
          onScanClick={handleHelpCommunity}
          initialState={selectedAlertState}
          initialZoneId={focusedAlertZoneId}
          onClearNotifications={clearNotifications}
          onNotificationsReady={addNotifications}
        />
      )}

      {currentScreen === 'dashboard' && (
        <GovernmentDashboard onTabChange={handleTabChange} onLocationAlertOpen={openLocationAlertFromDashboard} />
      )}
      
      {currentScreen === 'alert-detail' && (
        <AlertDetailScreen 
          zoneId={selectedAlertId}
          stateName={selectedAlertState}
          onBack={() => setCurrentScreen('alerts')}
          onScanClick={() => {
            setCameraOrigin('alert-detail');
            setCurrentScreen('camera');
          }}
          onViewMore={(zone) => {
            setSelectedZoneDetail(zone);
            setCurrentScreen('zone-detail');
          }}
          onTabChange={handleTabChange}
        />
      )}

      {currentScreen === 'zone-detail' && (
        <ZoneDetailScreen
          zone={selectedZoneDetail}
          onBack={() => setCurrentScreen('alert-detail')}
          onTabChange={handleTabChange}
        />
      )}

      {/* Privacy Notice */}
      <PrivacyNotice />
    </div>
  );
}