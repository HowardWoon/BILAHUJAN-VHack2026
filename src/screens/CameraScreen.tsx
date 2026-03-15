import { useEffect, useRef, useState, ChangeEvent } from 'react';
import StatusBar from '../components/StatusBar';
import { analyzeFloodImage, FloodAnalysisResult } from '../services/gemini';

interface CameraScreenProps {
  onBack: () => void;
  onAnalysisComplete: (result: FloodAnalysisResult, imageUri: string) => void;
  onTabChange: (tab: 'map' | 'report' | 'alert' | 'dashboard') => void;
}

// ── Image compression helper ──────────────────────────────────────────────────
// Resizes to 480px max and compresses to JPEG 0.65
// This keeps enough detail for Gemini vision while minimising upload size
function compressImage(file: File): Promise<{ base64: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onloadend = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image.'));
      img.onload = () => {
        const MAX_DIM = 480; // sufficient for AI vision; anything larger just adds latency
        const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported.'));
        ctx.drawImage(img, 0, 0, w, h);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
        const base64 = dataUrl.split(',')[1];
        resolve({ base64, dataUrl });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function CameraScreen({ onBack, onAnalysisComplete, onTabChange }: CameraScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAnalyzing) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [isAnalyzing]);
  const [rejectionModal, setRejectionModal] = useState<{ visible: boolean; reason: string }>({
    visible: false,
    reason: ''
  });

  const openFilePicker = () => {
    setError(null);
    // Reset so the same file can be re-selected after an error
    if (fileInputRef.current) fileInputRef.current.value = '';
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      // Step 1: Compress image
      const { base64, dataUrl } = await compressImage(file);

      // Step 2: Gemini analysis with 40s hard UI timeout
      const result = await Promise.race([
        analyzeFloodImage(base64, 'image/jpeg'),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI is taking too long. Tap Retry.')), 40000)
        )
      ]);

      setIsAnalyzing(false);

      // Step 3: Route result
      if (!result.isRelevant) {
        setRejectionModal({
          visible: true,
          reason: result.rejectionReason ||
            'This image does not appear to show a flood or drainage condition. Please capture a photo of a flooded area, waterlogged road, blocked drain, or overflowing drainage system.'
        });
      } else {
        onAnalysisComplete(result, dataUrl);
      }

    } catch (err: any) {
      console.error('[CameraScreen]', err);
      setError(err?.message || 'Analysis failed. Please try again.');
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="relative h-full w-full bg-slate-900 flex flex-col">
      <StatusBar theme="dark" />

      {/* ── Rejection Modal ─────────────────────────────────────────────────── */}
      {rejectionModal.visible && (
        <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center p-4">
          <div className="w-full bg-white rounded-[2rem] shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-500 px-5 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <span className="material-icons-round text-white text-xl">no_photography</span>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-red-100">AI Image Validation</p>
                <p className="text-white font-black text-base leading-tight">Image Not Accepted</p>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              <p className="text-slate-600 text-sm leading-relaxed mb-4">{rejectionModal.reason}</p>

              <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 mb-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-blue-600 mb-3 text-center">Accepted Image Types</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: 'water',      label: 'Flooded Roads' },
                    { icon: 'waves',      label: 'Rivers & Canals' },
                    { icon: 'water_drop', label: 'Drain Blockages' },
                    { icon: 'flood',      label: 'Waterlogged Areas' },
                  ].map(({ icon, label }) => (
                    <div key={icon} className="flex flex-col items-center justify-center bg-white border border-blue-100 rounded-xl py-3 gap-1.5">
                      <span className="material-icons-round text-blue-500 text-2xl">{icon}</span>
                      <span className="text-blue-700 text-xs font-semibold text-center leading-tight">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setRejectionModal({ visible: false, reason: '' }); openFilePicker(); }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-sm transition-all active:scale-95"
                >
                  Try Again
                </button>
                <button
                  onClick={() => onTabChange('map')}
                  className="flex-1 py-3 bg-[#E65100] hover:bg-[#CC4800] text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
                >
                  <span className="material-icons-round text-base">map</span>
                  Go to Map
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-2 z-10">
        <button
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md text-white"
        >
          <span className="material-icons-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-white">Camera Scan</h1>
        <div className="w-10 h-10" />
      </header>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="flex-1 relative px-4 pb-4 flex flex-col">

        {/* Viewfinder */}
        <div
          className="relative w-full flex-1 rounded-3xl overflow-hidden shadow-lg ring-1 ring-white/20 mb-6"
          style={{
            backgroundImage: 'url(https://lh3.googleusercontent.com/aida-public/AB6AXuAWsn5n5jKGafWkbvMY9u4ifGegdyYm_tkpXm1AOllfEzue7R1coi_mgifn2UGqJN7bO1ruXdTBlCQiGUgoPD9_coN7yI9dkkxzGXNsHNfEnYftvVxOB7zEdzMTpD7RZRd0HLVB6CWPFMbmVVSl_d3l2krVwSnpTYJM3cRbBNq1dI_ktSCenZo1rjNxMWZYrQGKB_guRHm2FFmdEPynP6D9bfm0nXpYHxPYZR2YM5c5dgUK7SuWK6meu9F4lbzHj5xgTA-PCiAcoX8)',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          {isAnalyzing ? (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 border-4 border-[#6B59D3]/30 border-t-[#6B59D3] rounded-full animate-spin" />
              <p className="text-white font-semibold text-base">Analyzing Flood Risk...</p>
              <p className="text-white/60 text-sm">Gemini AI is processing</p>
              <p className="text-white/40 text-xs tabular-nums">{elapsed}s elapsed</p>
            </div>
          ) : (
            <>
              {/* Scan frame */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-64 border-4 border-yellow-400 rounded-lg relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="material-icons-outlined text-yellow-400 text-3xl">add</span>
                  </div>
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-yellow-400 rounded-tl-sm" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-yellow-400 rounded-tr-sm" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-yellow-400 rounded-bl-sm" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-yellow-400 rounded-br-sm" />
                </div>
              </div>
              {/* Flashlight button */}
              <div className="absolute bottom-6 right-6">
                <button className="w-12 h-12 bg-black/40 backdrop-blur-md text-white rounded-full flex items-center justify-center border border-white/20 active:scale-95 transition-transform">
                  <span className="material-icons-outlined">flashlight_on</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Bottom Card ───────────────────────────────────────────────────── */}
        <div className="bg-white rounded-[2.5rem] px-5 pt-5 pb-5 shadow-xl shrink-0">

          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="material-icons-outlined text-yellow-500 text-lg">lightbulb</span>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Scan Guidelines</h2>
          </div>
          <p className="text-center text-slate-500 text-xs mb-4 leading-relaxed">
            Capture a clear image of a{' '}
            <span className="font-semibold text-slate-700">flooded area</span> or{' '}
            <span className="font-semibold text-slate-700">drain condition</span>.
          </p>

          {/* Category grid */}
          <div className="grid grid-cols-4 gap-2 mb-4 w-full">
            {[
              { icon: 'water',      label: 'Flooded\nRoads' },
              { icon: 'waves',      label: 'Rivers &\nCanals' },
              { icon: 'water_drop', label: 'Drain\nBlockage' },
              { icon: 'flood',      label: 'Waterlogged\nAreas' },
            ].map(({ icon, label }) => (
              <div key={icon} className="flex flex-col items-center justify-center bg-blue-50 border border-blue-100 rounded-xl py-3 px-1 gap-1">
                <span className="material-icons-round text-blue-500 text-xl">{icon}</span>
                <span className="text-blue-700 text-[10px] font-semibold text-center leading-tight whitespace-pre-line">{label}</span>
              </div>
            ))}
          </div>

          {/* Error box with retry */}
          {error && (
            <div className="w-full mb-3 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-600 font-bold text-xs uppercase mb-1">Error</p>
              <p className="text-red-800 text-xs leading-relaxed mb-3">{error}</p>
              <button
                onClick={openFilePicker}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl active:opacity-80 transition-all"
              >
                Tap to Retry
              </button>
            </div>
          )}

          {/* Hidden file input */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />

          {/* Scan button */}
          <button
            onClick={openFilePicker}
            disabled={isAnalyzing}
            className="w-full bg-[#6B59D3] disabled:opacity-50 hover:bg-opacity-90 active:scale-95 transition-all text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#6B59D3]/30"
          >
            <span className="material-icons-outlined">center_focus_weak</span>
            {isAnalyzing ? 'Analyzing...' : 'Scan'}
          </button>
        </div>
      </main>
    </div>
  );
}