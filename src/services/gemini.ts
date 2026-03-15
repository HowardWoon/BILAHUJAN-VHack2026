import { GoogleGenAI, Type } from "@google/genai";
import { ref, get, set } from "firebase/database";
import { rtdb } from "../firebase";

// ─────────────────────────────────────────────────────────────────────────────
// API KEY
//
// Set VITE_GEMINI_API_KEY in your .env file (never commit .env to Git).
// For Firebase Hosting deployments, set the key during the build step:
//   VITE_GEMINI_API_KEY=your_key npm run build
// ─────────────────────────────────────────────────────────────────────────────
const GEMINI_API_KEY: string =
  (import.meta.env.VITE_GEMINI_API_KEY as string) || '';

// A valid Google API key always starts with "AIza" and is 39 chars long
const isKeyValid = (k: string) => typeof k === 'string' && k.startsWith('AIza') && k.length >= 35;

if (!isKeyValid(GEMINI_API_KEY)) {
  console.error(
    '[Gemini] ❌ API key not set or invalid!\n' +
    'Add VITE_GEMINI_API_KEY=your_key to your .env file.\n' +
    'Get a free key at: https://aistudio.google.com/apikey'
  );
} else {
  console.log(`[Gemini] ✅ Key loaded (starts: ${GEMINI_API_KEY.slice(0, 8)}...)`);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// ─── Rate limit: 1 scan per 4 seconds (free tier max = 15 RPM) ───────────────
let lastCallTime = 0;
const COOLDOWN_MS = 4000;

// ─── Firebase result cache TTL: 10 minutes ───────────────────────────────────
const CACHE_TTL_MS = 10 * 60 * 1000;

function hashImageData(base64: string): string {
  let hash = 5381;
  const step = Math.max(1, Math.floor(base64.length / 512));
  for (let i = 0; i < base64.length; i += step) {
    hash = ((hash << 5) + hash) ^ base64.charCodeAt(i);
    hash = hash >>> 0;
  }
  return `img_${hash}_${base64.length}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FloodAnalysisResult {
  isRelevant: boolean;
  rejectionReason: string;
  estimatedDepth: string;
  detectedHazards: string;
  passability: string;
  aiConfidence: number;
  directive: string;
  riskScore: number;
  severity: string;
  waterDepth: string;
  waterCurrent: string;
  infrastructureStatus: string;
  humanRisk: string;
  estimatedStartTime: string;
  estimatedEndTime: string;
  eventType: string;
}

export interface LiveWeatherAnalysis {
  state: string;
  weatherCondition: string;
  isRaining: boolean;
  floodRisk: string;
  severity: number;
  aiAnalysisText: string;
}

export interface TownWeatherResult {
  town: string;
  lat: number;
  lng: number;
  weatherCondition: string;
  isRaining: boolean;
  severity: number;
  aiAnalysisText: string;
}

export interface AudioAnalysisResult {
  isFloodRisk: boolean;
  severity: string;
  analysis: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// analyzeFloodImage
//
// Model: gemini-1.5-flash  (REST v1beta)
// thinkingBudget: 0  → single-part response, no markdown wrapping
// Strategy: Firebase cache → REST fetch → save result to cache
// ─────────────────────────────────────────────────────────────────────────────
export async function analyzeFloodImage(
  base64Image: string,
  mimeType: string
): Promise<FloodAnalysisResult> {

  // ── Key guard ───────────────────────────────────────────────────────────────
  if (!isKeyValid(GEMINI_API_KEY)) {
    throw new Error(
      'Gemini API key not configured.\n' +
      'Add VITE_GEMINI_API_KEY=your_key to your .env file, then restart the dev server.\n' +
      'Get a free key at: https://aistudio.google.com/apikey'
    );
  }

  // ── Cooldown guard ──────────────────────────────────────────────────────────
  const now = Date.now();
  if (now - lastCallTime < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - (now - lastCallTime)) / 1000);
    throw new Error(`Please wait ${wait} second${wait !== 1 ? 's' : ''} before scanning again.`);
  }
  lastCallTime = now;

  // ── Firebase cache check (3s timeout, non-blocking) ────────────────────────
  const cacheKey = hashImageData(base64Image);
  try {
    const snap = await Promise.race([
      get(ref(rtdb, `analysisCache/${cacheKey}`)),
      new Promise<null>(res => setTimeout(() => res(null), 3000))
    ]);
    if (snap && (snap as any).exists?.()) {
      const cached = (snap as any).val();
      if (now - cached.timestamp < CACHE_TTL_MS) {
        console.log('[Gemini] ✅ Cache hit — skipping API call');
        return cached.result as FloodAnalysisResult;
      }
    }
  } catch { /* cache miss is fine */ }

  // ── Prompt ──────────────────────────────────────────────────────────────────
  const prompt = `You are a Malaysian flood risk AI analyst. Analyze this image.

STEP 1: Is this image showing flood, water, or drainage conditions?
If NO (selfie, food, document, indoor room, clear sky, etc):
  → set isRelevant=false, explain in rejectionReason, return zero/empty defaults for all other fields.

STEP 2: If YES, estimate depth using these physical anchors:
  Kerb = 0.15m | Door sill = 0.30m | Ankle = 0.15m | Knee = 0.50m
  Waist = 1.0m | Car bonnet = 1.0m | Car roof = 1.4m

SEVERITY scale (riskScore 1-10):
  1-2 = NORMAL (dry/damp surface)
  3-4 = MINOR  (ankle-deep, <0.2m)
  5-6 = MODERATE (knee-deep, 0.2-0.5m)
  7-8 = SEVERE (waist/bonnet, 0.5-1.2m)
  9-10 = CRITICAL (car roof or 2nd floor flooded)

HARD FLOOR RULES — never score below these:
  Car bonnet submerged → riskScore MINIMUM 7
  Car roof submerged   → riskScore MINIMUM 8
  Car fully submerged  → riskScore MINIMUM 9

YOU MUST return ONLY the JSON object below. No markdown. No code fences. No text before or after.

{"isRelevant":true,"rejectionReason":"","estimatedDepth":"~0.3m","detectedHazards":"Submerged manholes, floating debris","passability":"Pedestrians:Caution|Motorcycles:Avoid|Cars:Avoid|4x4:Caution","aiConfidence":80,"directive":"Water is knee-deep. Avoid crossing. Move to higher ground.","riskScore":5,"severity":"MODERATE","waterDepth":"Knee-Deep (0.3-0.5m)","waterCurrent":"Slow","infrastructureStatus":"Roads partially submerged","humanRisk":"Moderate","eventType":"Flash Flood","estimatedStartTime":"Already in progress","estimatedEndTime":"${new Date(Date.now() + 7200000).toISOString()}"}`;

  // ── REST API — gemini-1.5-flash on v1beta ──
  const REST_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: base64Image } }
      ]
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 512,
      topP: 0.8,
      topK: 10,
      thinkingConfig: {
        thinkingBudget: 0  // disable thinking — faster, no multi-part split
      }
    }
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);

  let response: Response;
  try {
    response = await fetch(REST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      throw new Error('Request timed out. Try a smaller image and tap Retry.');
    }
    throw new Error('Network error. Check your internet connection and tap Retry.');
  }
  clearTimeout(timer);

  // ── HTTP error handling ─────────────────────────────────────────────────────
  if (!response.ok) {
    let errMsg = response.statusText;
    try {
      const errJson = await response.json();
      errMsg = (errJson as any)?.error?.message || errMsg;
    } catch { /* ignore */ }

    console.error(`[Gemini] HTTP ${response.status}:`, errMsg);

    if (response.status === 429) {
      throw new Error('Quota exceeded. Wait 60 seconds and tap Retry.\nFor unlimited use, enable billing at aistudio.google.com.');
    }
    if (response.status === 400 && errMsg.toLowerCase().includes('api key')) {
      throw new Error('Invalid API key. Add a valid VITE_GEMINI_API_KEY to your .env file.');
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('API key rejected — it may be revoked or invalid.\nCreate a new key at aistudio.google.com/apikey and add it to your .env file.');
    }
    if (response.status === 404) {
      throw new Error('Gemini model not found (404). The model name in gemini.ts may be wrong.');
    }
    throw new Error(`Gemini error (${response.status}): ${errMsg}`);
  }

  // ── Parse response ──────────────────────────────────────────────────────────
  const json = await response.json();
  console.log('[Gemini] Candidates count:', json?.candidates?.length ?? 0);

  // gemini-1.5-flash may return multiple parts — find the last answer text part
  const parts: any[] = json?.candidates?.[0]?.content?.parts ?? [];
  const rawText: string = [...parts].reverse().find((p: any) => p.text && !p.thought)?.text ?? parts[0]?.text ?? '';
  console.log('[Gemini] Parts count:', parts.length, '| Raw text (first 400 chars):', rawText.slice(0, 400));

  if (!rawText) {
    const blockReason = json?.promptFeedback?.blockReason;
    const finishReason = json?.candidates?.[0]?.finishReason;
    console.error('[Gemini] Empty text. blockReason:', blockReason, 'finishReason:', finishReason);

    if (blockReason) throw new Error(`Image blocked by safety filter: ${blockReason}. Try a different image.`);
    if (finishReason === 'MAX_TOKENS') throw new Error('Response was too long. Tap Retry.');
    throw new Error('Empty AI response. Tap Retry.');
  }

  // Strip markdown code fences if model added them
  const stripped = rawText
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim();

  // Extract outermost JSON object
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) {
    console.error('[Gemini] No JSON found in response:', stripped);
    throw new Error('Could not read AI response. Tap Retry.');
  }

  let parsed: FloodAnalysisResult;
  try {
    parsed = JSON.parse(match[0]) as FloodAnalysisResult;
  } catch (parseErr) {
    console.error('[Gemini] JSON.parse failed on:', match[0]);
    throw new Error('AI response was malformed. Tap Retry.');
  }

  // ── Cache result (fire-and-forget) ─────────────────────────────────────────
  set(ref(rtdb, `analysisCache/${cacheKey}`), {
    result: parsed,
    timestamp: Date.now()
  }).catch(() => { /* non-fatal */ });

  return parsed;
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// fetchStateTownsWithWeather
// Uses Google Search to find real towns in a Malaysian state + live weather.
// Falls back to hardcoded known towns if AI response cannot be parsed.
// ─────────────────────────────────────────────────────────────────────────────

// Known towns + coords per state (fallback if AI parse fails)
const STATE_TOWNS: Record<string, { town: string; lat: number; lng: number }[]> = {
  'Selangor':         [{ town:'Shah Alam', lat:3.0733, lng:101.5185 },{ town:'Petaling Jaya', lat:3.1073, lng:101.6067 },{ town:'Klang', lat:3.0449, lng:101.4456 },{ town:'Subang Jaya', lat:3.0565, lng:101.5822 },{ town:'Kajang', lat:2.9935, lng:101.7853 },{ town:'Ampang', lat:3.1481, lng:101.7614 },{ town:'Rawang', lat:3.3210, lng:101.5741 },{ town:'Sepang', lat:2.7389, lng:101.7085 }],
  'Kuala Lumpur':     [{ town:'Chow Kit', lat:3.1701, lng:101.6958 },{ town:'Bukit Bintang', lat:3.1466, lng:101.7100 },{ town:'Wangsa Maju', lat:3.2011, lng:101.7368 },{ town:'Kepong', lat:3.2127, lng:101.6355 },{ town:'Cheras', lat:3.0869, lng:101.7491 },{ town:'Setapak', lat:3.1932, lng:101.7101 }],
  'Johor':            [{ town:'Johor Bahru', lat:1.4927, lng:103.7414 },{ town:'Batu Pahat', lat:1.8538, lng:102.9329 },{ town:'Muar', lat:2.0442, lng:102.5689 },{ town:'Kluang', lat:2.0231, lng:103.3175 },{ town:'Segamat', lat:2.5154, lng:102.8184 },{ town:'Pontian', lat:1.4878, lng:103.3895 },{ town:'Mersing', lat:2.4327, lng:103.8365 }],
  'Penang':           [{ town:'Georgetown', lat:5.4141, lng:100.3288 },{ town:'Butterworth', lat:5.3993, lng:100.3629 },{ town:'Seberang Perai', lat:5.3952, lng:100.3752 },{ town:'Bayan Lepas', lat:5.2974, lng:100.2659 },{ town:'Balik Pulau', lat:5.3433, lng:100.2363 },{ town:'Bukit Mertajam', lat:5.3633, lng:100.4672 }],
  'Pahang':           [{ town:'Kuantan', lat:3.8077, lng:103.3260 },{ town:'Temerloh', lat:3.4498, lng:102.4149 },{ town:'Bentong', lat:3.5213, lng:101.9101 },{ town:'Raub', lat:3.7958, lng:101.8579 },{ town:'Pekan', lat:3.4882, lng:103.3929 },{ town:'Jerantut', lat:3.9334, lng:102.3576 }],
  'Sarawak':          [{ town:'Kuching', lat:1.5497, lng:110.3592 },{ town:'Sibu', lat:2.2983, lng:111.8295 },{ town:'Miri', lat:4.3995, lng:113.9914 },{ town:'Bintulu', lat:3.1667, lng:113.0333 },{ town:'Sri Aman', lat:1.2378, lng:111.4628 },{ town:'Kapit', lat:2.0127, lng:112.9271 }],
  'Sabah':            [{ town:'Kota Kinabalu', lat:5.9804, lng:116.0735 },{ town:'Sandakan', lat:5.8402, lng:118.1179 },{ town:'Tawau', lat:4.2485, lng:117.8915 },{ town:'Lahad Datu', lat:5.0274, lng:118.3346 },{ town:'Keningau', lat:5.3371, lng:116.1614 },{ town:'Semporna', lat:4.4797, lng:118.6149 }],
  'Perak':            [{ town:'Ipoh', lat:4.5975, lng:101.0901 },{ town:'Taiping', lat:4.8500, lng:100.7333 },{ town:'Teluk Intan', lat:3.9706, lng:101.0247 },{ town:'Manjung', lat:4.2167, lng:100.6500 },{ town:'Kampar', lat:4.3049, lng:101.1527 },{ town:'Batu Gajah', lat:4.4681, lng:101.0509 }],
  'Kedah':            [{ town:'Alor Setar', lat:6.1248, lng:100.3673 },{ town:'Sungai Petani', lat:5.6479, lng:100.4882 },{ town:'Kulim', lat:5.3650, lng:100.5614 },{ town:'Langkawi', lat:6.3500, lng:99.8000 },{ town:'Baling', lat:5.6833, lng:100.9167 },{ town:'Pendang', lat:5.9963, lng:100.5404 }],
  'Kelantan':         [{ town:'Kota Bharu', lat:6.1254, lng:102.2380 },{ town:'Pasir Mas', lat:6.0463, lng:102.1382 },{ town:'Tanah Merah', lat:5.7977, lng:102.1534 },{ town:'Gua Musang', lat:4.8811, lng:101.9686 },{ town:'Machang', lat:5.7695, lng:102.2146 },{ town:'Kuala Krai', lat:5.5275, lng:102.1994 }],
  'Terengganu':       [{ town:'Kuala Terengganu', lat:5.3302, lng:103.1408 },{ town:'Dungun', lat:4.7578, lng:103.4135 },{ town:'Kemaman', lat:4.2333, lng:103.4167 },{ town:'Marang', lat:5.2024, lng:103.2175 },{ town:'Kerteh', lat:4.5167, lng:103.4500 }],
  'Negeri Sembilan':  [{ town:'Seremban', lat:2.7297, lng:101.9381 },{ town:'Port Dickson', lat:2.5230, lng:101.8064 },{ town:'Nilai', lat:2.8122, lng:101.7989 },{ town:'Bahau', lat:2.8000, lng:102.4167 },{ town:'Kuala Pilah', lat:2.7393, lng:102.2441 }],
  'Melaka':           [{ town:'Melaka City', lat:2.2000, lng:102.2500 },{ town:'Alor Gajah', lat:2.3833, lng:102.2167 },{ town:'Jasin', lat:2.3060, lng:102.4384 },{ town:'Merlimau', lat:2.1845, lng:102.4478 }],
  'Perlis':           [{ town:'Kangar', lat:6.4414, lng:100.1986 },{ town:'Arau', lat:6.4274, lng:100.2711 },{ town:'Padang Besar', lat:6.6497, lng:100.3267 }],
  'Putrajaya':        [{ town:'Presint 1', lat:2.9264, lng:101.6964 },{ town:'Presint 8', lat:2.9500, lng:101.7000 },{ town:'Presint 15', lat:2.9000, lng:101.7200 }],
  'Labuan':           [{ town:'Bandar Labuan', lat:5.2767, lng:115.2417 },{ town:'Victoria', lat:5.3000, lng:115.2500 }],
};

export async function fetchStateTownsWithWeather(
  state: string,
  retries = 1
): Promise<TownWeatherResult[]> {

  if (!isKeyValid(GEMINI_API_KEY)) {
    return buildFallbackTowns(state);
  }

  try {
    const apiCall = ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `Search Google Maps and Google Search for major towns in ${state}, Malaysia and their CURRENT weather and flood status today.\n\nYou MUST reply with ONLY a raw JSON array. No explanation, no markdown, no code fences. Start your reply with [ and end with ].\n\nExample format:\n[{"town":"Shah Alam","lat":3.073,"lng":101.518,"weatherCondition":"Heavy Rain","isRaining":true,"severity":7,"aiAnalysisText":"Flash flood risk near low-lying areas."},{"town":"Klang","lat":3.044,"lng":101.445,"weatherCondition":"Cloudy","isRaining":false,"severity":2,"aiAnalysisText":"Conditions normal, no flood risk."}]\n\nReturn up to 8 towns from ${state}, Malaysia with real GPS coordinates and real current weather data from search results.`,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
        maxOutputTokens: 1200
      }
    });

    const response = await withTimeout(apiCall, 12000, null);
    if (!response) {
      console.warn(`[Towns] Timeout for ${state} — using fallback`);
      return buildFallbackTowns(state);
    }

    const raw = response.text?.trim() ?? '';
    console.log(`[Towns] Raw response for ${state}:`, raw.slice(0, 300));

    // Try to extract a JSON array — be very lenient with parsing
    const cleaned = raw
      .replace(/^```(?:json)?\s*/im, '')
      .replace(/\s*```\s*$/im, '')
      .trim();

    // Find the outermost [ ... ]
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('No JSON array found in response');
    }

    const jsonStr = cleaned.slice(start, end + 1);
    const towns = JSON.parse(jsonStr) as TownWeatherResult[];
    const valid = towns.filter(
      t => t.town && typeof t.lat === 'number' && typeof t.lng === 'number' && typeof t.severity === 'number'
    );

    if (valid.length === 0) throw new Error('Parsed array had no valid town entries');
    console.log(`[Towns] ✅ Got ${valid.length} towns for ${state}`);
    return valid;

  } catch (error: any) {
    const msg = error?.message ?? '';
    const status = error?.status ?? error?.code ?? 0;

    if (status === 429 || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
      console.warn(`[Towns] Rate limit for ${state} — using fallback towns`);
      return buildFallbackTowns(state);
    }
    if (retries > 0) {
      console.warn(`[Towns] Retrying ${state}...`);
      await new Promise(r => setTimeout(r, 1000));
      return fetchStateTownsWithWeather(state, retries - 1);
    }
    console.error(`[Towns] Failed for ${state}, using fallback:`, msg);
    return buildFallbackTowns(state);
  }
}

// Build fallback town list using hardcoded coords — no extra API calls (avoids quota spiral)
function buildFallbackTowns(state: string): TownWeatherResult[] {
  const known = STATE_TOWNS[state] ?? [];
  return known.slice(0, 6).map(t => ({
    ...t,
    weatherCondition: 'Cloudy',
    isRaining: false,
    severity: 1,
    aiAnalysisText: `No active flood alerts for ${t.town}. Tap refresh for live data.`
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// fetchLiveWeatherAndCCTV
// Real-time weather + flood alerts per Malaysian state
// Uses gemini-2.0-flash with Google Search grounding (confirmed available)
// ─────────────────────────────────────────────────────────────────────────────

// Hard 10-second timeout per AI call — prevents indefinite hangs
const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([promise, new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))]);

export async function fetchLiveWeatherAndCCTV(
  state: string,
  retries = 1
): Promise<LiveWeatherAnalysis> {

  const fallback: LiveWeatherAnalysis = {
    state,
    weatherCondition: "Cloudy",
    isRaining: false,
    floodRisk: "Low",
    severity: 1,
    aiAnalysisText: `No active flood alerts for ${state}. Conditions appear normal.`
  };

  if (!isKeyValid(GEMINI_API_KEY)) return fallback;

  try {
    const apiCall = ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `You are a real-time flood monitoring assistant for Malaysia.

Search Google for ALL of the following RIGHT NOW for ${state}, Malaysia:
1. Google Weather — current weather conditions and hourly forecast for ${state}
2. Malaysian Meteorological Department (MetMalaysia) warnings or alerts for ${state}
3. Any active flood warnings, road closures, or water level alerts issued today for ${state}
4. Recent news or social media reports of flooding or heavy rain in ${state}

Based ONLY on what real live search results show, determine:
- Is it currently raining or flooded in ${state}?
- What is the actual flood risk right now?
- Severity 1-3 = clear/normal, 4-6 = rising water/heavy rain risk, 7-10 = active flooding

Respond ONLY with this JSON (no markdown, no code fences):
{"state":"${state}","weatherCondition":"<Heavy Rain|Thunderstorm|Drizzle|Cloudy|Sunny>","isRaining":<true|false>,"floodRisk":"<High|Moderate|Low>","severity":<1-10>,"aiAnalysisText":"<2 short actionable sentences for residents based on current conditions>"}`,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
        maxOutputTokens: 250
      }
    });

    const response = await withTimeout(apiCall, 10000, null);
    if (!response) {
      console.warn(`[Weather] Timeout for ${state} — using fallback`);
      return fallback;
    }

    const raw = response.text?.trim() ?? '';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in weather response');

    return JSON.parse(jsonMatch[0]) as LiveWeatherAnalysis;

  } catch (error: any) {
    const msg = error?.message ?? '';
    const status = error?.status ?? error?.code ?? 0;

    if (status === 429 || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota') || msg.includes('free_tier')) {
      console.warn(`[Weather] Rate limit for ${state} — using fallback`);
      return fallback;
    }
    if (retries > 0) {
      console.warn(`[Weather] Retrying ${state}, ${retries - 1} attempts left`);
      await new Promise(r => setTimeout(r, 1000));
      return fetchLiveWeatherAndCCTV(state, retries - 1);
    }
    console.error(`[Weather] All retries failed for ${state}:`, error);
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// fetchLiveWeatherForTown
// Real-time weather + flood status for a specific town within a Malaysian state
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchLiveWeatherForTown(
  town: string,
  state: string,
  retries = 0
): Promise<LiveWeatherAnalysis> {

  const fallback: LiveWeatherAnalysis = {
    state,
    weatherCondition: "Cloudy",
    isRaining: false,
    floodRisk: "Low",
    severity: 1,
    aiAnalysisText: `No active flood alerts for ${town}. Conditions appear normal.`
  };

  if (!isKeyValid(GEMINI_API_KEY)) return fallback;

  try {
    const apiCall = ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `You are a real-time flood monitoring assistant for Malaysia.\n\nSearch Google for ALL of the following RIGHT NOW for ${town}, ${state}, Malaysia:\n1. Google Weather \u2014 current weather and forecast for ${town} ${state}\n2. Any flood warnings, road closures, or water level alerts for ${town} today\n3. MetMalaysia or JPS (Dept of Irrigation) reports for ${town} ${state}\n4. Recent social media or news reports of flooding in ${town}\n\nBased ONLY on live search results:\n- Severity 1-3 = clear/normal, 4-6 = heavy rain/rising water risk, 7-10 = active flooding\n\nRespond ONLY with this JSON (no markdown, no code fences):\n{"state":"${state}","weatherCondition":"<Heavy Rain|Thunderstorm|Drizzle|Cloudy|Sunny>","isRaining":<true|false>,"floodRisk":"<High|Moderate|Low>","severity":<1-10>,"aiAnalysisText":"<2 short actionable sentences specific to ${town} residents based on current real conditions>"}`,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
        maxOutputTokens: 250
      }
    });

    const response = await withTimeout(apiCall, 10000, null);
    if (!response) {
      console.warn(`[Weather] Timeout for ${town} — using fallback`);
      return fallback;
    }

    const raw = response.text?.trim() ?? '';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in town weather response');

    return JSON.parse(jsonMatch[0]) as LiveWeatherAnalysis;

  } catch (error: any) {
    const msg = error?.message ?? '';
    const status = error?.status ?? error?.code ?? 0;

    if (status === 429 || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota') || msg.includes('free_tier')) {
      console.warn(`[Weather] Rate limit for ${town} — using fallback`);
      return fallback;
    }
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 1000));
      return fetchLiveWeatherForTown(town, state, retries - 1);
    }
    console.error(`[Weather] All retries failed for ${town}:`, error);
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// analyzeAudio
// Flood risk detection from ambient sound (rain, rushing water, sirens, thunder)
// ─────────────────────────────────────────────────────────────────────────────
export async function analyzeAudio(
  base64Audio: string,
  mimeType: string
): Promise<AudioAnalysisResult> {

  const fallback: AudioAnalysisResult = {
    isFloodRisk: false,
    severity: 'NONE',
    analysis: 'Audio analysis unavailable. Please try again later.'
  };

  if (!isKeyValid(GEMINI_API_KEY)) return fallback;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Listen to this audio clip. Detect any signs of flood risk: heavy rain, rushing water, thunder, emergency sirens, or strong wind.
Return ONLY valid JSON (no markdown, no code fences):
{"isFloodRisk":<true|false>,"severity":"<CRITICAL|HIGH|MODERATE|LOW|NONE>","analysis":"<2 sentences describing what you hear and the flood risk>"}`
            },
            { inlineData: { data: base64Audio, mimeType } }
          ]
        }
      ],
      config: {
        temperature: 0.1,
        maxOutputTokens: 150,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isFloodRisk: { type: Type.BOOLEAN },
            severity: { type: Type.STRING },
            analysis: { type: Type.STRING }
          },
          required: ["isFloodRisk", "severity", "analysis"]
        }
      }
    });

    const text = response.text?.trim() ?? '';
    if (!text) return fallback;
    return JSON.parse(text) as AudioAnalysisResult;

  } catch (error: any) {
    const msg = error?.message ?? '';
    const status = error?.status ?? error?.code ?? 0;
    if (status === 429 || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
      return { isFloodRisk: false, severity: 'NONE', analysis: 'Server busy. Please try audio analysis again in a moment.' };
    }
    console.error('[Audio] Failed:', error);
    return fallback;
  }
}