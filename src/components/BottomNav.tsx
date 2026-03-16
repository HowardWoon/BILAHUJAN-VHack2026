import { useMemo } from 'react';
import { useLiveZones } from '../services/firebaseHooks';

interface BottomNavProps {
  activeTab: 'map' | 'report' | 'alert' | 'dashboard';
  onTabChange: (tab: 'map' | 'report' | 'alert' | 'dashboard') => void;
}

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const liveZones = useLiveZones();

  // Count distinct states with an active flood alert (severity >= 4)
  const activeAlertStateCount = useMemo(() => {
    const states = new Set<string>();
    Object.values(liveZones).forEach((zone: any) => {
      if ((zone?.severity ?? 0) >= 4 && zone?.state && !zone?.isHistorical && zone?.status !== 'resolved') {
        states.add((zone.state as string).toLowerCase());
      }
    });
    return states.size;
  }, [liveZones]);
  return (
    <nav className="absolute bottom-0 left-0 right-0 w-full bg-white/90 backdrop-blur-md border border-slate-200 border-b-0 rounded-t-3xl px-4 pt-3 pb-6 flex flex-col z-50 overflow-hidden">
      <div className="flex justify-between items-center w-full mb-2 gap-1">
        <button 
          onClick={() => onTabChange('map')}
          className={`flex flex-col flex-1 items-center gap-1 transition-colors ${activeTab === 'map' ? 'text-[#6366F1]' : 'text-slate-400 hover:text-[#6366F1]'}`}
        >
          <span className="material-icons-round text-[26px]">map</span>
          <span className="text-[10px] font-bold uppercase tracking-tighter">Map</span>
        </button>

        <button 
          onClick={() => onTabChange('report')}
          className={`flex flex-col flex-1 items-center gap-1 transition-colors ${activeTab === 'report' ? 'text-[#ec5b13]' : 'text-slate-400 hover:text-[#ec5b13]'}`}
        >
          <span className="material-icons-round text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
          <span className="text-[10px] font-bold uppercase tracking-tighter">Report</span>
        </button>
        
        <button 
          onClick={() => onTabChange('alert')}
          className={`flex flex-col flex-1 items-center gap-1 transition-colors relative ${activeTab === 'alert' ? 'text-[#6366F1]' : 'text-slate-400 hover:text-[#6366F1]'}`}
        >
          <span className="material-icons-round text-[26px]">notifications</span>
          <span className="text-[10px] font-bold uppercase tracking-tighter">Alert</span>
          {activeAlertStateCount > 0 && activeTab !== 'alert' && (
            <div className="absolute -top-1 right-[18%] min-w-[17px] h-[17px] bg-red-500 rounded-full border-2 border-white flex items-center justify-center animate-pulse">
              <span className="text-[9px] font-black text-white leading-none">
                {activeAlertStateCount > 9 ? '9+' : activeAlertStateCount}
              </span>
            </div>
          )}
        </button>

        <button 
          onClick={() => onTabChange('dashboard')}
          className={`flex flex-col flex-1 items-center gap-1 transition-colors ${activeTab === 'dashboard' ? 'text-[#0f9d58]' : 'text-slate-400 hover:text-[#0f9d58]'}`}
        >
          <span className="material-icons-round text-[26px]">hub</span>
          <span className="text-[10px] font-bold uppercase tracking-tighter">Gov</span>
        </button>
      </div>
      
      <div className="text-center w-full mb-1">
        <p className="text-[8px] text-slate-400 font-medium">Copyright © 2026 FEI. Developed for V Hack 2026 · USM.</p>
      </div>
      
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-300 rounded-full"></div>
    </nav>
  );
}
