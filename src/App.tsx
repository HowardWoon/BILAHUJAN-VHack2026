import { useState, useEffect } from 'react';
import SplashScreen from './screens/SplashScreen';
import MapScreen from './screens/MapScreen';
import CameraScreen from './screens/CameraScreen';
import ResultScreen from './screens/ResultScreen';
import AlertsScreen from './screens/AlertsScreen';
import AlertDetailScreen from './screens/AlertDetailScreen';
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

type Screen = 'splash' | 'map' | 'camera' | 'result' | 'alerts' | 'alert-detail' | 'report' | 'dashboard';

type NotificationItem = { id: number; zoneId: string; zone: FloodZone };
const LEGACY_NOTIFICATIONS_STORAGE_KEY = 'bilahujan:notifications:v1';

const getZoneTimeMs = (zone: FloodZone): number => {
  const asAny = zone as any;
  if (typeof asAny.timestamp === 'number' && Number.isFinite(asAny.timestamp)) {
    return asAny.timestamp;
  }
  const parsed = Date.parse(zone.lastUpdated || '');
  return Number.isNaN(parsed) ? 0 : parsed;
};

const isExpiredZone = (zone: FloodZone): boolean => {
  if (!zone.estimatedEndTime || zone.estimatedEndTime === 'N/A' || zone.estimatedEndTime === 'Unknown') {
    return false;
  }
  const parsed = Date.parse(zone.estimatedEndTime);
  return Number.isFinite(parsed) && parsed <= Date.now();
};

const getDisplayLocationName = (zone: FloodZone): string => {
  const raw = (zone.name || zone.specificLocation || '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const normalizedState = zone.state.replace(/\s+/g, ' ').trim();
  const escapedState = normalizedState.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rawWithoutState = raw
    .replace(new RegExp(`(?:,\s*)?${escapedState}\b`, 'ig'), '')
    .replace(/\s+/g, ' ')
    .replace(/^,\s*|,\s*$/g, '')
    .trim();

  const uniqueParts = rawWithoutState
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part, index, parts) => parts.findIndex((candidate) => candidate.toLowerCase().replace(/\s+/g, ' ') === part.toLowerCase().replace(/\s+/g, ' ')) === index);

  const filteredParts = uniqueParts.filter((part) => part.toLowerCase().replace(/\s+/g, ' ') !== normalizedState.toLowerCase());
  return filteredParts[0] || rawWithoutState || uniqueParts[0] || zone.name;
};

const normalizeLocationText = (value: string, state: string): string => {
  const normalized = (value || '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/[,:/\-]+/g, ' ')
    .toLowerCase()
    .replace(new RegExp(`\\b${state.toLowerCase()}\\b`, 'g'), ' ')
    .replace(/\b(malaysia|bandar|daerah|pekan|mukim|kampung|kg|jalan|jln|taman|seri|sri|bukit|kota|pusat|kawasan|felda|lembah|padang|simpang|kuala|ayer|air|kebun|lorong|besar|utara|selatan|timur|barat|live|weather|state|overview)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized) {
    return normalized;
  }

  return (value || '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/[,:/\-]+/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};

const toTokenSet = (text: string): Set<string> => {
  return new Set(
    text
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
  );
};

const areEquivalentLocations = (left: FloodZone, right: FloodZone): boolean => {
  if (left.state.toLowerCase() !== right.state.toLowerCase()) {
    return false;
  }

  const leftText = normalizeLocationText(`${left.name} ${left.specificLocation || ''}`, left.state);
  const rightText = normalizeLocationText(`${right.name} ${right.specificLocation || ''}`, right.state);

  if (!leftText || !rightText) return false;
  if (leftText === rightText) return true;

  const minLengthForContainment = 4;
  if (
    (leftText.length >= minLengthForContainment && rightText.includes(leftText)) ||
    (rightText.length >= minLengthForContainment && leftText.includes(rightText))
  ) {
    return true;
  }

  const leftTokens = toTokenSet(leftText);
  const rightTokens = toTokenSet(rightText);
  if (leftTokens.size === 0 || rightTokens.size === 0) return false;

  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) overlap++;
  });

  const score = overlap / Math.max(leftTokens.size, rightTokens.size);
  return score >= 0.6;
};

const locationKey = (zone: FloodZone): string => {
  const normalized = normalizeLocationText(`${zone.name || ''} ${zone.specificLocation || ''}`, zone.state);

  return `${zone.state.toLowerCase()}::${normalized || zone.name.toLowerCase()}`;
};

const buildSyncedNotificationsForStates = (states: string[]): NotificationItem[] => {
  const stateSet = new Set(states.map((state) => state.toLowerCase()));
  const allZones = Object.values(getFloodZones()).filter(
    (zone) => !(zone as any).isHistorical && stateSet.has(zone.state.toLowerCase())
  );

  const hasSpecificByState = new Set(
    allZones
      .filter((zone) => zone.id.startsWith('live_town_') || zone.id.startsWith('user_reported_'))
      .map((zone) => zone.state.toLowerCase())
  );

  const candidates = allZones.filter((zone) => {
    const isSpecific = zone.id.startsWith('live_town_') || zone.id.startsWith('user_reported_');
    const isStateLive = zone.id.startsWith('live_') && !zone.id.startsWith('live_town_');
    if (isSpecific) return true;
    if (isStateLive) return !hasSpecificByState.has(zone.state.toLowerCase());
    return false;
  });

  const grouped: FloodZone[][] = [];
  candidates.forEach((zone) => {
    const existingGroup = grouped.find((group) => areEquivalentLocations(group[0], zone));
    if (existingGroup) {
      existingGroup.push(zone);
    } else {
      grouped.push([zone]);
    }
  });

  const now = Date.now();
  return grouped
    .map((duplicates) => {
      const sortedByTime = [...duplicates].sort((a, b) => getZoneTimeMs(b) - getZoneTimeMs(a));
      const latest = sortedByTime[0];
      const displayLocation = getDisplayLocationName(latest);

      const activeSignals = duplicates.filter((zone) => !isExpiredZone(zone));
      const recentWindowMs = 3 * 60 * 60 * 1000;
      const recentActive = activeSignals.filter(
        (zone) => Math.abs(getZoneTimeMs(zone) - getZoneTimeMs(latest)) <= recentWindowMs
      );

      let severity = latest.severity;
      if (latest.severity < 4) {
        severity = 0;
      } else if (recentActive.length > 0) {
        severity = Math.max(...recentActive.map((zone) => zone.severity));
      }

      const zone: FloodZone = {
        ...latest,
        name: displayLocation,
        specificLocation: displayLocation,
        severity,
        eventType: severity >= 4 ? latest.eventType : 'Normal',
        estimatedStartTime: severity >= 4 ? latest.estimatedStartTime : 'N/A',
        estimatedEndTime: severity >= 4 ? latest.estimatedEndTime : 'N/A',
        aiAnalysisText: severity >= 4 ? latest.aiAnalysisText : `No active flood alerts for ${displayLocation}.`,
        forecast: severity >= 4 ? latest.forecast : 'Conditions appear normal.'
      };

      return {
        zoneId: latest.id,
        zone,
        sortSeverity: severity,
        sortTime: getZoneTimeMs(latest)
      };
    })
    .sort((a, b) => {
      if (b.sortSeverity !== a.sortSeverity) return b.sortSeverity - a.sortSeverity;
      return b.sortTime - a.sortTime;
    })
    .map((item, index) => ({ id: now + index, zoneId: item.zoneId, zone: item.zone }));
};

const syncNotificationItems = (items: NotificationItem[]): NotificationItem[] => {
  const grouped: NotificationItem[][] = [];

  items.forEach((item) => {
    const existingGroup = grouped.find((group) => areEquivalentLocations(group[0].zone, item.zone));
    if (existingGroup) {
      existingGroup.push(item);
    } else {
      grouped.push([item]);
    }
  });

  const deduped = grouped.map((group) => {
    return [...group].sort((a, b) => {
      const diffTime = getZoneTimeMs(b.zone) - getZoneTimeMs(a.zone);
      if (diffTime !== 0) return diffTime;
      return b.zone.severity - a.zone.severity;
    })[0];
  });

  return deduped
    .map((item) => ({
      ...item,
      zone: {
        ...item.zone,
        name: getDisplayLocationName(item.zone),
        specificLocation: getDisplayLocationName(item.zone)
      }
    }))
    .sort((a, b) => {
      if (b.zone.severity !== a.zone.severity) return b.zone.severity - a.zone.severity;
      return getZoneTimeMs(b.zone) - getZoneTimeMs(a.zone);
    })
    .map((item, index) => ({ ...item, id: Date.now() + index }));
};

export default function App() {
  const isDev = import.meta.env.DEV;
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [analysisResult, setAnalysisResult] = useState<FloodAnalysisResult | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [startMapWithScan, setStartMapWithScan] = useState(false);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [selectedAlertState, setSelectedAlertState] = useState<string | null>(null);
  const [focusedAlertZoneId, setFocusedAlertZoneId] = useState<string | null>(null);
  const [cameraOrigin, setCameraOrigin] = useState<'map' | 'report' | 'alerts' | 'alert-detail'>('map');
  const [scanLocation, setScanLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    setNotifications([]);
    window.localStorage.removeItem(LEGACY_NOTIFICATIONS_STORAGE_KEY);
  }, []);

  useEffect(() => {
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

  const enqueueNotification = (zoneId: string, zone: FloodZone) => {
    setNotifications(prev => {
      return syncNotificationItems([
        ...prev,
        {
          id: Date.now(),
          zoneId,
          zone,
        }
      ]);
    });
  };

  useEffect(() => {
    const handleFloodAlert = (event: Event) => {
      const detail = (event as CustomEvent<{ zoneId?: string; zone?: FloodZone }>).detail;
      if (!detail?.zoneId || !detail.zone) return;
      enqueueNotification(detail.zoneId, detail.zone);
    };

    window.addEventListener('floodAlert', handleFloodAlert as EventListener);
    return () => {
      window.removeEventListener('floodAlert', handleFloodAlert as EventListener);
    };
  }, []);

  useEffect(() => {
    // Simulate splash screen delay
    const timer = setTimeout(() => {
      setCurrentScreen('map');
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Manage notifications directly — no window events needed
  const addNotifications = (items: { zoneId: string; zone: FloodZone }[]) => {
    if (items.length === 0) {
      setNotifications([]);
      return;
    }

    // Town-level refresh: keep each town as its own notification
    const allTownZones = items.every(item => item.zoneId.startsWith('live_town_'));
    if (allTownZones) {
      const now = Date.now();
      const townNotifications = items.map((item, index) => ({
        id: now + index,
        zoneId: item.zoneId,
        zone: item.zone,
      }));
      setNotifications(syncNotificationItems(townNotifications));
      return;
    }

    const groupedByState = new Map<string, { zoneId: string; zone: FloodZone }[]>();
    items.forEach((item) => {
      const state = item.zone.state;
      if (!state) return;
      if (!groupedByState.has(state)) {
        groupedByState.set(state, []);
      }
      groupedByState.get(state)!.push(item);
    });

    const now = Date.now();
    const stateNotifications = Array.from(groupedByState.entries())
      .map(([state, stateItems]) => {
        const latest = [...stateItems].sort((a, b) => getZoneTimeMs(b.zone) - getZoneTimeMs(a.zone))[0];
        const severity = Math.max(...stateItems.map((item) => item.zone.severity));

        const stateZone: FloodZone = {
          ...latest.zone,
          id: `live_${state.toLowerCase().replace(/\s+/g, '_')}`,
          name: state,
          specificLocation: state,
          state,
          severity,
          eventType: severity >= 4 ? (latest.zone.eventType || 'Heavy Rain') : 'Normal',
          estimatedStartTime: severity >= 4 ? latest.zone.estimatedStartTime : 'N/A',
          estimatedEndTime: severity >= 4 ? latest.zone.estimatedEndTime : 'N/A',
          aiAnalysisText: severity >= 4 ? latest.zone.aiAnalysisText : `No active flood alerts for ${state}.`,
          forecast: severity >= 4 ? latest.zone.forecast : 'Conditions appear normal.'
        };

        return {
          id: now,
          zoneId: stateZone.id,
          zone: stateZone,
          sortSeverity: severity,
          sortTime: getZoneTimeMs(latest.zone)
        };
      })
      .sort((a, b) => {
        if (b.sortSeverity !== a.sortSeverity) return b.sortSeverity - a.sortSeverity;
        return b.sortTime - a.sortTime;
      })
      .map((item, index) => ({ id: item.id + index, zoneId: item.zoneId, zone: item.zone }));

    setNotifications(syncNotificationItems(stateNotifications));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

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
            enqueueNotification(zoneId, zone);
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
          onBack={() => setCurrentScreen('alerts')}
          onScanClick={() => {
            setCameraOrigin('alert-detail');
            setCurrentScreen('camera');
          }}
          onTabChange={handleTabChange}
        />
      )}

      {/* Global Notification Stack */}
      {notifications.length > 0 && currentScreen !== 'alert-detail' && (
        <div className="absolute top-0 left-0 right-0 z-[100] p-3 flex flex-col gap-2 pointer-events-none">
          <div className="flex justify-end mb-2 pointer-events-auto">
            <button
              onClick={() => {
                setNotifications([]);
              }}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold px-4 py-1.5 rounded-xl shadow border border-slate-300 text-sm transition-all"
            >
              Clear All
            </button>
          </div>
          {notifications.map((notification) => {
            const sev = notification.zone.severity;
            const isCritical = sev >= 8;
            const isFlood = sev >= 4;
            // Detect zone type via ID prefix — independent of display name
            const isStateLevelZone = notification.zoneId.startsWith('live_') && !notification.zoneId.startsWith('live_town_');
            // State-level: show state name. Town / user-report: show zone name.
            const stateName = isStateLevelZone ? notification.zone.state : notification.zone.name;

            const borderColor = isCritical ? 'border-l-red-500' : isFlood ? 'border-l-orange-400' : 'border-l-green-500';
            const statusColor = isCritical ? 'text-red-600' : isFlood ? 'text-orange-500' : 'text-green-600';
            const statusText = isCritical
              ? 'Flooding reported in this area.'
              : isFlood
              ? 'Water levels are rising. Stay alert.'
              : 'No flood threat detected.';
            const canonicalKey = locationKey(notification.zone);

            return (
              <div key={notification.id} className="pointer-events-auto animate-[slideDown_0.3s_ease-out]">
                <div
                  onClick={() => {
                    setSelectedAlertState(notification.zone.state);
                    setFocusedAlertZoneId(isStateLevelZone ? null : notification.zoneId);
                    setCurrentScreen('alerts');
                    setNotifications(prev => prev.filter(n => n.id !== notification.id));
                  }}
                  className={`bg-white rounded-xl shadow-lg border border-slate-100 border-l-4 ${borderColor} px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors flex items-center gap-3`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 font-extrabold text-base truncate">{stateName}</p>
                    <p className="text-slate-400 text-[10px] uppercase tracking-wide -mt-0.5 mb-0.5">
                      {isStateLevelZone ? 'State Overview' : notification.zone.state}
                    </p>
                    <p className={`font-medium text-xs ${statusColor}`}>{statusText}</p>
                    {isDev && (
                      <p className="text-[10px] font-mono text-slate-500 mt-0.5 truncate" title={canonicalKey}>
                        key: {canonicalKey}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setNotifications(prev => prev.filter(n => n.id !== notification.id));
                    }}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 shrink-0"
                  >
                    <span className="material-icons-round text-sm">close</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Privacy Notice */}
      <PrivacyNotice />
    </div>
  );
}