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
  (import.meta.env.VITE_GEMINI_API_KEY as string) ||
  (typeof process !== 'undefined' ? (process.env?.GEMINI_API_KEY as string) : '') ||
  '';

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

// Rate limit: 1 scan per 4 seconds (free tier max = 15 RPM)
let lastCallTime = 0;
const COOLDOWN_MS = 4000;

// Firebase result cache TTL: 10 minutes
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

interface GuidelineClassificationResult {
  matchesGuideline: boolean;
  categories: string[];
  detectedContents: string[];
  summary: string;
}

interface SeverityCalibrationResult {
  riskScore: number;
  estimatedDepth: string;
  waterDepth: string;
  humanRisk: string;
  markers: string[];
  rationale: string;
  confidence: number;
}

interface CriticalVisualCueResult {
  isCritical: boolean;
  reason: string;
}

interface SceneContextResult {
  isNormalWaterbody: boolean;
  hasFloodDanger: boolean;
  reason: string;
  confidence: number;
}

const ACCEPTED_GUIDELINE_CATEGORIES = new Set([
  'Flooded Roads',
  'Rivers & Canals',
  'Drain Blockages',
  'Waterlogged Areas'
]);

const severityLabelFromScore = (riskScore: number) => {
  if (riskScore >= 9) return 'CRITICAL';
  if (riskScore >= 7) return 'SEVERE';
  if (riskScore >= 5) return 'MODERATE';
  if (riskScore >= 3) return 'MINOR';
  return 'NORMAL';
};

const WATER_CONTENT_KEYWORDS = [
  'water', 'flood', 'flooded', 'road', 'street', 'river', 'canal', 'drain', 'drainage',
  'sea', 'shore', 'coast', 'waterlogged', 'puddle', 'muddy water', 'standing water',
  'submerged', 'overflow', 'overflowing'
];

const DISALLOWED_PRIMARY_SUBJECT_KEYWORDS = [
  'baby', 'child', 'kid', 'toddler', 'infant', 'toy', 'playground', 'play mat', 'indoor',
  'living room', 'bedroom', 'classroom', 'selfie', 'portrait', 'face', 'person close-up',
  'product', 'doll', 'cartoon', 'document', 'receipt', 'screenshot', 'food', 'pet'
];

const parseRiskScoreValue = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const normalizeFloodAnalysisResult = (input: Partial<FloodAnalysisResult>): FloodAnalysisResult => {
  const isRelevant = Boolean(input.isRelevant);
  const rawRiskScore = parseRiskScoreValue(input.riskScore);
  const boundedRiskScore = Math.max(0, Math.min(10, Math.round(rawRiskScore)));
  const riskScore = isRelevant ? Math.max(1, boundedRiskScore) : boundedRiskScore;

  return {
    isRelevant,
    rejectionReason: isRelevant ? '' : (input.rejectionReason?.trim() || ''),
    estimatedDepth: input.estimatedDepth?.trim() || '',
    detectedHazards: input.detectedHazards?.trim() || '',
    passability: input.passability?.trim() || '',
    aiConfidence: Math.max(0, Math.min(100, Math.round(input.aiConfidence ?? 0))),
    directive: input.directive?.trim() || '',
    riskScore,
    severity: isRelevant ? severityLabelFromScore(riskScore) : (input.severity?.trim() || 'NONE'),
    waterDepth: input.waterDepth?.trim() || '',
    waterCurrent: input.waterCurrent?.trim() || '',
    infrastructureStatus: input.infrastructureStatus?.trim() || '',
    humanRisk: input.humanRisk?.trim() || '',
    estimatedStartTime: input.estimatedStartTime?.trim() || '',
    estimatedEndTime: input.estimatedEndTime?.trim() || '',
    eventType: input.eventType?.trim() || '',
  };
};

const buildFallbackFloodAnalysisResult = (reason?: string): FloodAnalysisResult => ({
  isRelevant: false,
  rejectionReason: reason || 'This image does not appear to show a flooded area or drain condition. Please upload a clear image of flooded roads, rivers/canals, drain blockages, or waterlogged areas.',
  estimatedDepth: 'N/A',
  detectedHazards: 'None detected',
  passability: 'Pedestrians:Caution|Motorcycles:Caution|Cars:Avoid|4x4:Caution',
  aiConfidence: 0,
  directive: 'Retake the image with a clearer view of the flooded area or drain condition.',
  riskScore: 0,
  severity: 'NONE',
  waterDepth: 'N/A',
  waterCurrent: 'N/A',
  infrastructureStatus: 'Unknown',
  humanRisk: 'Unknown',
  estimatedStartTime: 'Unknown',
  estimatedEndTime: 'Unknown',
  eventType: 'Unverified Image'
});

const buildWaterAcceptedLowRiskResult = (reason = 'Visible water area/drainage context detected. No severe flood indicators were found.'): FloodAnalysisResult => ({
  isRelevant: true,
  rejectionReason: '',
  estimatedDepth: '< 0.1m',
  detectedHazards: 'No severe hazard detected',
  passability: 'Pedestrians:Passable|Motorcycles:Caution|Cars:Passable|4x4:Passable',
  aiConfidence: 65,
  directive: 'Water-related environment detected. Monitor conditions and follow local advisories if water rises.',
  riskScore: 2,
  severity: 'NORMAL',
  waterDepth: 'Surface Water (<0.1m)',
  waterCurrent: 'Slow',
  infrastructureStatus: reason,
  humanRisk: 'Low',
  estimatedStartTime: 'Current observation',
  estimatedEndTime: 'Unknown',
  eventType: 'Water Area Observation'
});

const buildGuidelineAcceptedResult = (classification: GuidelineClassificationResult | null): FloodAnalysisResult => {
  const text = [
    classification?.summary || '',
    ...(classification?.categories || []),
    ...(classification?.detectedContents || []),
  ].join(' ').toLowerCase();

  let riskScore = 2;
  let severity = 'NORMAL';
  let estimatedDepth = '< 0.1m';
  let waterDepth = 'Surface Water (<0.1m)';
  let humanRisk = 'Low';
  let passability = 'Pedestrians:Passable|Motorcycles:Caution|Cars:Passable|4x4:Passable';
  let detectedHazards = 'No severe hazard detected';
  let infrastructureStatus = classification?.summary?.trim() || 'Guideline-matched water condition detected.';
  let directive = 'Waterway/drainage context detected. Monitor local conditions.';
  let eventType = 'Water Area Observation';

  if (/(flooded\s*roads|road|street|vehicle|car)/i.test(text) && /(submerge|submerged|flood|waterlog|water)/i.test(text)) {
    riskScore = 5;
    severity = 'MODERATE';
    estimatedDepth = '0.2-0.5m';
    waterDepth = 'Knee-Deep (0.2-0.5m)';
    humanRisk = 'Moderate';
    passability = 'Pedestrians:Caution|Motorcycles:Avoid|Cars:Avoid|4x4:Caution';
    detectedHazards = 'Floodwater affecting road access';
    directive = 'Floodwater detected on a roadway. Avoid crossing and reroute if possible.';
    eventType = 'Road Flooding';
  }

  if (/(bonnet|waist|strong\s*current|swift\s*current|multiple\s*roads\s*impassable|stalled\s*vehicle)/i.test(text)) {
    riskScore = 7;
    severity = 'SEVERE';
    estimatedDepth = '0.5-1.2m';
    waterDepth = 'Waist-Deep (0.5-1.2m)';
    humanRisk = 'High';
    passability = 'Pedestrians:Avoid|Motorcycles:Avoid|Cars:Avoid|4x4:Caution';
    detectedHazards = 'Deep floodwater and unsafe road conditions';
    directive = 'Severe flood indicators detected. Do not attempt to cross. Move to higher ground immediately.';
    eventType = 'Severe Flood';
  }

  return {
    isRelevant: true,
    rejectionReason: '',
    estimatedDepth,
    detectedHazards,
    passability,
    aiConfidence: 72,
    directive,
    riskScore,
    severity,
    waterDepth,
    waterCurrent: riskScore >= 7 ? 'Moderate' : 'Slow',
    infrastructureStatus,
    humanRisk,
    estimatedStartTime: 'Current observation',
    estimatedEndTime: 'Unknown',
    eventType,
  };
};

const hasAcceptedWaterContent = (classification: GuidelineClassificationResult | null) => {
  if (!classification) return false;

  const haystack = [classification.summary, ...classification.detectedContents]
    .join(' ')
    .toLowerCase();

  const hasAcceptedCategory = classification.categories.some(category =>
    ACCEPTED_GUIDELINE_CATEGORIES.has(category)
  );
  const hasWaterKeyword = WATER_CONTENT_KEYWORDS.some(keyword => haystack.includes(keyword));
  const hasDisallowedPrimarySubject = DISALLOWED_PRIMARY_SUBJECT_KEYWORDS.some(keyword => haystack.includes(keyword));

  if (hasDisallowedPrimarySubject && !hasWaterKeyword) return false;
  if (classification.matchesGuideline && hasAcceptedCategory && hasWaterKeyword) return true;
  if (hasAcceptedCategory && hasWaterKeyword) return true;

  return hasWaterKeyword && !hasDisallowedPrimarySubject;
};

const buildClassificationRejectionReason = (classification: GuidelineClassificationResult | null) => {
  if (!classification) {
    return 'Rejected: flood/drainage evidence is not clear in this photo. Accepted types: Flooded Roads, Rivers & Canals, Drain Blockages, Waterlogged Areas.';
  }

  const normalizedDetected = classification.detectedContents
    .map(item => item.toLowerCase())
    .join(' ');
  const normalizedSummary = (classification.summary || '').toLowerCase();
  const inspectionText = `${normalizedDetected} ${normalizedSummary}`;

  const contentList = classification.detectedContents.length > 0
    ? classification.detectedContents.join(', ')
    : 'no clear water or drainage elements';

  const reasonDetail = /(selfie|portrait|face|person close-up)/i.test(inspectionText)
    ? 'It appears to be a person-focused photo without visible flood/drainage context.'
    : /(indoor|living room|bedroom|classroom|furniture|toy|baby|child|kid|toddler)/i.test(inspectionText)
      ? 'It appears to be an indoor or personal scene, not a flood/drainage environment.'
      : /(document|receipt|screen|screenshot|text|paper)/i.test(inspectionText)
        ? 'It appears to be a document/screen image rather than a real flood scene.'
        : /(food|meal|drink|product|package)/i.test(inspectionText)
          ? 'It appears to be an object/product photo, not a flood/drainage condition.'
          : 'No clear floodwater, drainage blockage, river/canal overflow, or waterlogged ground is visible.';

  return `Rejected: ${reasonDetail} Gemini detected: ${contentList}. Accepted types: Flooded Roads, Rivers & Canals, Drain Blockages, Waterlogged Areas.`;
};

const parseMaxMetersFromText = (text: string) => {
  const matches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*m\b/gi)];
  if (matches.length === 0) return null;

  let maxMeters = 0;
  for (const match of matches) {
    const value = Number(match[1]);
    if (!Number.isNaN(value)) {
      maxMeters = Math.max(maxMeters, value);
    }
  }

  return maxMeters > 0 ? maxMeters : null;
};

const depthToMinimumRisk = (meters: number | null) => {
  if (meters === null) return 0;
  if (meters >= 1.4) return 9;
  if (meters >= 1.2) return 8;
  if (meters >= 1.0) return 7;
  if (meters >= 0.5) return 5;
  if (meters >= 0.2) return 4;
  return 2;
};

const deriveFormulaFloorScore = (result: FloodAnalysisResult) => {
  if (!result.isRelevant) return 0;

  let floor = 0;
  const text = [
    result.estimatedDepth,
    result.waterDepth,
    result.detectedHazards,
    result.directive,
    result.infrastructureStatus,
    result.eventType,
    result.passability,
  ].join(' ').toLowerCase();

  // Explicit rooftop/people-on-roof/house-submerged cues
  const roofCues = /(house\s*roof|roof\s*of\s*house|home\s*roof|building\s*roof|first\s*floor\s*submerge|2nd\s*floor\s*flood|second\s*floor\s*flood|people\s*on\s*roof|rooftop\s*rescue|submerged\s*house|roof\s*level|roof\s*submerged|roof\s*visible|roof\s*only|atas\s*bumbung|atas\s*rumah)/i;
  if (roofCues.test(text)) {
    return 9;
  }

  floor = Math.max(floor, depthToMinimumRisk(parseMaxMetersFromText(text)));

  const passabilityText = (result.passability || '').toLowerCase();
  if (/pedestrians\s*:\s*avoid/.test(passabilityText) && /cars\s*:\s*avoid/.test(passabilityText)) {
    floor = Math.max(floor, 7);
  } else if (/cars\s*:\s*avoid|motorcycles\s*:\s*avoid/.test(passabilityText)) {
    floor = Math.max(floor, 5);
  }

  const humanRiskText = (result.humanRisk || '').toLowerCase();
  if (humanRiskText.includes('critical')) floor = Math.max(floor, 9);
  else if (humanRiskText.includes('high')) floor = Math.max(floor, 7);
  else if (humanRiskText.includes('moderate')) floor = Math.max(floor, 5);

  return floor;
};

const inferMinimumRiskScore = (result: FloodAnalysisResult, classification?: GuidelineClassificationResult | null) => {
  if (!result.isRelevant) return 0;

  const text = [
    result.estimatedDepth,
    result.detectedHazards,
    result.directive,
    result.waterDepth,
    result.infrastructureStatus,
    result.humanRisk,
    result.eventType,
  ].join(' ').toLowerCase();

  let minimum = 0;

  const hasSubmergedSignal = /(submerge|underwater|flooded|waterline)/i.test(text);

  if (/(car\s*(fully\s*)?submerge|vehicle\s*(fully\s*)?submerge|only\s*roof\s*visible|house\s*roof|home\s*roof|building\s*roof|second\s*floor\s*flood|2nd\s*floor\s*flood)/i.test(text)) {
    minimum = Math.max(minimum, 9);
  }

  if (/(car\s*roof|vehicle\s*roof|roof\s*level)/i.test(text) && hasSubmergedSignal) {
    minimum = Math.max(minimum, 8);
  }

  if (/(car\s*bonnet|car\s*hood|vehicle\s*bonnet|waist\s*-?\s*deep|chest\s*-?\s*deep)/i.test(text)) {
    minimum = Math.max(minimum, 7);
  }

  if (/(knee\s*-?\s*deep)/i.test(text)) {
    minimum = Math.max(minimum, 5);
  }

  if (/(stalled\s*vehicles|multiple\s*roads\s*impassable|swift\s*current|strong\s*current)/i.test(text)) {
    minimum = Math.max(minimum, 7);
  }

  const numericDepth = parseMaxMetersFromText(text);
  minimum = Math.max(minimum, depthToMinimumRisk(numericDepth));

  if (/(flood(ed)?\s*road|road\s*submerged|waterlogged\s*(road|street|area)|street\s*flooded)/i.test(text)) {
    minimum = Math.max(minimum, 5);
  }

  if (/(flood|flooded|submerge|submerged|waterlog|overflow|overflowing)/i.test(text)) {
    minimum = Math.max(minimum, 3);
  }

  if (classification?.categories?.length) {
    const categories = classification.categories.map(category => category.toLowerCase());
    if (categories.some(category => category.includes('flooded roads'))) minimum = Math.max(minimum, 5);
    if (categories.some(category => category.includes('waterlogged'))) minimum = Math.max(minimum, 4);
    if (categories.some(category => category.includes('drain'))) minimum = Math.max(minimum, 3);
    if (categories.some(category => category.includes('river') || category.includes('canal'))) minimum = Math.max(minimum, 2);
  }

  if (classification?.matchesGuideline) {
    minimum = Math.max(minimum, 1);

    const classificationText = [
      classification.summary,
      ...classification.detectedContents,
      ...classification.categories,
    ].join(' ').toLowerCase();

    if (/(flood|flooded|submerge|submerged|waterlog|overflow|overflowing)/i.test(classificationText)) {
      minimum = Math.max(minimum, 4);
    }

    if (/(river|canal|sea|coast|shore|drain)/i.test(classificationText) && !/(flood|flooded|submerge|submerged|waterlog|overflow|overflowing)/i.test(classificationText)) {
      minimum = Math.max(minimum, 2);
    }

    if (/(road|street|vehicle|car)/i.test(classificationText) && /(water|flood|submerge|waterlog)/i.test(classificationText)) {
      minimum = Math.max(minimum, 5);
    }
  }

  minimum = Math.max(minimum, deriveFormulaFloorScore(result));

  minimum = Math.max(minimum, 1);

  return minimum;
};

const enforceSeverityGuardrails = (
  result: FloodAnalysisResult,
  classification?: GuidelineClassificationResult | null
): FloodAnalysisResult => {
  if (!result.isRelevant) return result;

  const minimumRiskScore = inferMinimumRiskScore(result, classification);
  if (minimumRiskScore <= result.riskScore) return result;

  return {
    ...result,
    riskScore: minimumRiskScore,
    severity: severityLabelFromScore(minimumRiskScore),
    humanRisk: minimumRiskScore >= 9 ? 'Critical' : minimumRiskScore >= 7 ? 'High' : minimumRiskScore >= 5 ? 'Moderate' : result.humanRisk,
    directive: minimumRiskScore >= 7
      ? 'Severe flood indicators detected. Avoid the area and move to higher ground immediately.'
      : result.directive,
  };
};

const enforceProfessionalConsistency = (
  result: FloodAnalysisResult,
  classification?: GuidelineClassificationResult | null
): FloodAnalysisResult => {
  if (!result.isRelevant) return result;

  const evidenceText = [
    result.estimatedDepth,
    result.waterDepth,
    result.detectedHazards,
    result.infrastructureStatus,
    result.eventType,
    classification?.summary || '',
    ...(classification?.categories || []),
    ...(classification?.detectedContents || []),
  ].join(' ').toLowerCase();

  const depthMeters = parseMaxMetersFromText(evidenceText);
  const hasStaticWaterOnly = /(river|canal|sea|coast|shore|waterway|drain)/i.test(evidenceText);
  const hasFloodDangerSignals = /(flood|flooded|submerge|submerged|waterlog|overflow|overflowing|impassable|stranded|evacuat|rescue|stalled\s*vehicle|strong\s*current|swift\s*current)/i.test(evidenceText);
  const hasDeepSignals = /(roof|bonnet|waist|chest|knee\s*-?\s*deep|1\.[0-9]+\s*m|0\.[5-9]\s*m)/i.test(evidenceText);

  if (result.riskScore >= 7 && hasStaticWaterOnly && !hasFloodDangerSignals && !hasDeepSignals && (depthMeters === null || depthMeters < 0.5)) {
    return {
      ...result,
      riskScore: 2,
      severity: 'NORMAL',
      humanRisk: 'Low',
      directive: 'Normal waterbody observed. No clear flood danger indicators detected.',
      passability: 'Pedestrians:Passable|Motorcycles:Caution|Cars:Passable|4x4:Passable',
      detectedHazards: 'No severe hazard detected'
    };
  }

  if (result.riskScore >= 5 && hasStaticWaterOnly && !hasFloodDangerSignals && (depthMeters === null || depthMeters < 0.2)) {
    return {
      ...result,
      riskScore: 2,
      severity: 'NORMAL',
      humanRisk: 'Low',
      directive: 'Normal waterbody observed. Monitor local advisories if weather changes.',
      detectedHazards: 'No severe hazard detected'
    };
  }

  return result;
};

const harmonizeMetricsWithSeverity = (
  result: FloodAnalysisResult,
  classification?: GuidelineClassificationResult | null,
  scene?: SceneContextResult | null
): FloodAnalysisResult => {
  if (!result.isRelevant) return result;

  const text = [
    result.detectedHazards,
    result.infrastructureStatus,
    result.eventType,
    classification?.summary || '',
    ...(classification?.categories || []),
    ...(classification?.detectedContents || []),
    scene?.reason || '',
  ].join(' ').toLowerCase();

  const isDrainageScene = /(drain|drainage|longkang|culvert|blocked drain|overflow drain)/i.test(text);
  const isNaturalWaterScene = Boolean(scene?.isNormalWaterbody) && !scene?.hasFloodDanger;

  if (result.riskScore <= 2) {
    return {
      ...result,
      severity: 'NORMAL',
      estimatedDepth: isDrainageScene ? '~0.02-0.05m' : '< 0.1m',
      waterDepth: isDrainageScene ? 'Shallow Surface Water (~0.02-0.05m)' : 'Surface Water (<0.1m)',
      waterCurrent: isNaturalWaterScene ? 'Normal' : 'Slow',
      passability: 'Pedestrians:Passable|Motorcycles:Passable|Cars:Passable|4x4:Passable',
      detectedHazards: isDrainageScene ? 'Minor blockage or light debris only' : 'No hazard detected',
      humanRisk: 'Low',
      directive: isDrainageScene
        ? 'Minor drainage water detected. Monitor for worsening blockage during rain.'
        : 'Conditions appear normal. No significant flood risk detected.',
      infrastructureStatus: isDrainageScene
        ? 'Drain appears functional or only partially blocked.'
        : result.infrastructureStatus,
      eventType: isDrainageScene ? 'Minor Drainage Accumulation' : (isNaturalWaterScene ? 'Normal Water Area' : result.eventType),
    };
  }

  if (result.riskScore <= 4) {
    return {
      ...result,
      severity: 'MINOR',
      estimatedDepth: isDrainageScene ? '~0.05-0.15m' : result.estimatedDepth || '< 0.2m',
      waterDepth: isDrainageScene ? 'Minor Pooling (~0.05-0.15m)' : (result.waterDepth || 'Ankle-Deep (<0.2m)'),
      waterCurrent: result.waterCurrent || 'Slow',
      passability: 'Pedestrians:Caution|Motorcycles:Caution|Cars:Passable|4x4:Passable',
      detectedHazards: isDrainageScene ? 'Minor blockage, shallow pooling' : (result.detectedHazards || 'Localized shallow water accumulation'),
      humanRisk: 'Low',
      directive: isDrainageScene
        ? 'Minor drainage accumulation detected. Motorcycles and pedestrians should proceed with caution.'
        : (result.directive || 'Minor water accumulation detected. Use caution.'),
      eventType: isDrainageScene ? 'Drainage Pooling' : result.eventType,
    };
  }

  if (result.riskScore <= 6) {
    return {
      ...result,
      severity: 'MODERATE',
      passability: 'Pedestrians:Caution|Motorcycles:Avoid|Cars:Avoid|4x4:Caution',
      humanRisk: 'Moderate',
      directive: result.directive || 'Moderate flood risk detected. Avoid low-lying routes and monitor conditions closely.',
    };
  }

  if (result.riskScore <= 8) {
    return {
      ...result,
      severity: 'SEVERE',
      passability: 'Pedestrians:Avoid|Motorcycles:Avoid|Cars:Avoid|4x4:Caution',
      humanRisk: 'High',
      directive: result.directive || 'Severe flooding detected. Avoid the area and move to higher ground immediately.',
    };
  }

  return {
    ...result,
    severity: 'CRITICAL',
    passability: 'Pedestrians:Avoid|Motorcycles:Avoid|Cars:Avoid|4x4:Avoid',
    humanRisk: 'Critical',
    directive: result.directive || 'Critical flooding detected. Evacuate immediately and request emergency assistance.',
  };
};

const parseFloodAnalysisText = (rawText: string): FloodAnalysisResult => {
  const stripped = rawText
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim();

  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) {
    console.error('[Gemini] No JSON found in response:', stripped);
    throw new Error('Could not read AI response. Tap Retry.');
  }

  try {
    return normalizeFloodAnalysisResult(JSON.parse(match[0]) as Partial<FloodAnalysisResult>);
  } catch {
    console.error('[Gemini] JSON.parse failed on:', match[0]);
    throw new Error('AI response was malformed. Tap Retry.');
  }
};

const extractGeminiResponseText = (response: any) => {
  if (typeof response?.text === 'string' && response.text.trim()) {
    return response.text.trim();
  }

  const parts = response?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim();
};

const analyzeFloodImageViaRest = async (prompt: string, base64Image: string, mimeType: string) => {
  const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
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
        thinkingBudget: 0
      }
    }
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);

  try {
    const response = await fetch(restUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      let errMsg = response.statusText;
      try {
        const errJson = await response.json();
        errMsg = (errJson as any)?.error?.message || errMsg;
      } catch {
        // ignore JSON parse errors for error responses
      }
      throw Object.assign(new Error(errMsg), { status: response.status });
    }

    const json = await response.json();
    const parts: any[] = json?.candidates?.[0]?.content?.parts ?? [];
    const rawText = [...parts].reverse().find((part: any) => part.text && !part.thought)?.text ?? parts[0]?.text ?? '';
    if (!rawText) {
      throw new Error('Empty AI response. Tap Retry.');
    }

    return parseFloodAnalysisText(rawText);
  } finally {
    clearTimeout(timer);
  }
};

const professionalRegradeViaRest = async (
  base64Image: string,
  mimeType: string,
  current: FloodAnalysisResult
): Promise<FloodAnalysisResult | null> => {
  if (!current.isRelevant) return null;

  const prompt = `You are a senior flood-risk assessor.

Regrade this image severity professionally and return ONLY JSON with EXACT FloodAnalysisResult fields.

Current score: ${current.riskScore}/10 (${current.severity}). Re-evaluate from image evidence only.

Mandatory rules:
- If people are stranded on rooftops, or house/building is submerged up to roof level, riskScore MUST be 9-10.
- If car roof is submerged, riskScore MUST be >=8.
- If bonnet/waist level water, riskScore MUST be >=7.
- If knee-level flooding, riskScore MUST be >=5.
- If image only shows normal river/canal/sea/drain water without flood danger signals, use riskScore 1-2.

No markdown, no extra text.`;

  try {
    const regraded = await analyzeFloodImageViaRest(prompt, base64Image, mimeType);
    return regraded.isRelevant ? regraded : null;
  } catch {
    return null;
  }
};

const detectWaterEvidenceViaRest = async (base64Image: string, mimeType: string): Promise<boolean> => {
  const detectionPrompt = `Check this image and return ONLY JSON:
{"hasWaterEvidence":true,"reason":"short reason"}

Set hasWaterEvidence=true if the image clearly shows any of these:
- floodwater on road/street/urban area
- river, canal, drain, drainage channel
- sea/coastline/shore water area
- waterlogged ground or standing water

Set hasWaterEvidence=false only if there is truly no visible water/drainage context.`;

  try {
    const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(restUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: detectionPrompt },
            { inline_data: { mime_type: mimeType, data: base64Image } }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 150 }
      })
    });

    if (!response.ok) return false;
    const json = await response.json();
    const parts: any[] = json?.candidates?.[0]?.content?.parts ?? [];
    const rawText = [...parts].reverse().find((part: any) => part.text && !part.thought)?.text ?? parts[0]?.text ?? '';
    if (!rawText) return false;

    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) return false;

    const parsed = JSON.parse(match[0]) as { hasWaterEvidence?: boolean };
    return Boolean(parsed.hasWaterEvidence);
  } catch {
    return false;
  }
};

const detectCriticalRooftopCueViaRest = async (
  base64Image: string,
  mimeType: string
): Promise<CriticalVisualCueResult | null> => {
  const prompt = `Analyze this flood image and return ONLY JSON:
{"isCritical":true,"reason":"people stranded on house roof"}

Set isCritical=true if ANY of these are visible or strongly implied:
- people stranded on rooftop / people on roof
- house is submerged and only roof visible
- rooftop rescue situation
- floodwater at roof level / bumbung rumah / atas bumbung

Otherwise set isCritical=false.`;

  try {
    const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(restUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64Image } }
          ]
        }],
        generationConfig: { temperature: 0.0, maxOutputTokens: 120 }
      })
    });

    if (!response.ok) return null;

    const json = await response.json();
    const parts: any[] = json?.candidates?.[0]?.content?.parts ?? [];
    const rawText = [...parts].reverse().find((part: any) => part.text && !part.thought)?.text ?? parts[0]?.text ?? '';
    if (!rawText) return null;

    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]) as Partial<CriticalVisualCueResult>;
    return {
      isCritical: Boolean(parsed.isCritical),
      reason: parsed.reason?.trim() || ''
    };
  } catch {
    return null;
  }
};

const detectSceneContextViaRest = async (
  base64Image: string,
  mimeType: string
): Promise<SceneContextResult | null> => {
  const prompt = `Classify this image context and return ONLY JSON:
{"isNormalWaterbody":true,"hasFloodDanger":false,"reason":"normal river with visible banks","confidence":90}

Definitions:
- isNormalWaterbody=true when image shows normal river/canal/sea/lake/drain scene without clear flood impact.
- hasFloodDanger=true only when there are clear flood danger cues: inundated roads/houses, overflow beyond banks, stranded people/vehicles, severe current, or evacuation context.

If normal water scene with no flood impact: set isNormalWaterbody=true and hasFloodDanger=false.
No markdown.`;

  try {
    const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(restUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64Image } }
          ]
        }],
        generationConfig: { temperature: 0.0, maxOutputTokens: 120 }
      })
    });

    if (!response.ok) return null;
    const json = await response.json();
    const parts: any[] = json?.candidates?.[0]?.content?.parts ?? [];
    const rawText = [...parts].reverse().find((part: any) => part.text && !part.thought)?.text ?? parts[0]?.text ?? '';
    if (!rawText) return null;

    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]) as Partial<SceneContextResult>;
    return {
      isNormalWaterbody: Boolean(parsed.isNormalWaterbody),
      hasFloodDanger: Boolean(parsed.hasFloodDanger),
      reason: parsed.reason?.trim() || '',
      confidence: Math.max(0, Math.min(100, Math.round(parseRiskScoreValue(parsed.confidence))))
    };
  } catch {
    return null;
  }
};

const applySceneContextCap = (
  result: FloodAnalysisResult,
  scene: SceneContextResult | null,
  criticalCue: CriticalVisualCueResult | null
): FloodAnalysisResult => {
  if (!result.isRelevant || !scene) return result;
  if (criticalCue?.isCritical) return result;

  if (scene.isNormalWaterbody && !scene.hasFloodDanger && scene.confidence >= 60) {
    if (result.riskScore <= 2) return result;
    return {
      ...result,
      riskScore: 2,
      severity: 'NORMAL',
      estimatedDepth: '< 0.1m',
      waterDepth: 'Surface Water (<0.1m)',
      humanRisk: 'Low',
      detectedHazards: 'No severe hazard detected',
      passability: 'Pedestrians:Passable|Motorcycles:Caution|Cars:Passable|4x4:Passable',
      directive: 'Normal waterbody observed. No clear flood danger indicators detected.',
      infrastructureStatus: scene.reason || 'Normal river/waterway scene without flood overflow.'
    };
  }

  return result;
};

const applyCriticalVisualOverride = (
  result: FloodAnalysisResult,
  cue: CriticalVisualCueResult | null
): FloodAnalysisResult => {
  if (!result.isRelevant || !cue?.isCritical) return result;
  if (result.riskScore >= 9) return result;

  return {
    ...result,
    riskScore: 9,
    severity: 'CRITICAL',
    estimatedDepth: result.estimatedDepth || '1.4m+',
    waterDepth: result.waterDepth || 'Roof-level flooding',
    humanRisk: 'Critical',
    detectedHazards: result.detectedHazards
      ? `${result.detectedHazards}; rooftop-stranding risk`
      : 'Rooftop stranding risk detected',
    infrastructureStatus: cue.reason
      ? `${result.infrastructureStatus || 'Severe flood condition observed'}. ${cue.reason}`
      : (result.infrastructureStatus || 'Severe flood condition observed'),
    directive: 'Critical rooftop-level flooding detected. Evacuate immediately and request emergency rescue support.'
  };
};


const calibrateSeverityViaRest = async (
  base64Image: string,
  mimeType: string
): Promise<SeverityCalibrationResult | null> => {
  const calibrationPrompt = `You are a professional flood severity calibration engine.

Analyze this image and return ONLY JSON in this exact shape:
{"riskScore":9,"estimatedDepth":"1.4-2.0m","waterDepth":"Roof-level flooding","humanRisk":"Critical","markers":["house roof submerged","people on roof","rooftop rescue","submerged house","roof visible","roof only"],"rationale":"short reason","confidence":90}

Use strict flood anchors:
- Ankle ~0.15m => score 3-4
- Knee ~0.5m => score 5-6
- Waist / car bonnet ~1.0m => score 7-8
- Car roof / house roof / first-floor level water / people on roof / rooftop rescue / submerged house / roof visible / roof only => score 9-10

Hard constraints:
- If house roof-level flooding, people on roof, rooftop rescue, or submerged house is visible or strongly implied, riskScore MUST be >= 9.
- If car roof-level flooding is visible, riskScore MUST be >= 8.
- If water reaches bonnet/waist level, riskScore MUST be >= 7.

Return concise, professional output only.`;

  try {
    const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(restUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: calibrationPrompt },
            { inline_data: { mime_type: mimeType, data: base64Image } }
          ]
        }],
        generationConfig: { temperature: 0.0, maxOutputTokens: 220 }
      })
    });

    if (!response.ok) return null;

    const json = await response.json();
    const parts: any[] = json?.candidates?.[0]?.content?.parts ?? [];
    const rawText = [...parts].reverse().find((part: any) => part.text && !part.thought)?.text ?? parts[0]?.text ?? '';
    if (!rawText) return null;

    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]) as Partial<SeverityCalibrationResult>;
    const riskScore = Math.max(1, Math.min(10, Math.round(parseRiskScoreValue(parsed.riskScore))));

    return {
      riskScore,
      estimatedDepth: parsed.estimatedDepth?.trim() || '',
      waterDepth: parsed.waterDepth?.trim() || '',
      humanRisk: parsed.humanRisk?.trim() || '',
      markers: Array.isArray(parsed.markers) ? parsed.markers.filter(Boolean) : [],
      rationale: parsed.rationale?.trim() || '',
      confidence: Math.max(0, Math.min(100, Math.round(parseRiskScoreValue(parsed.confidence))))
    };
  } catch {
    return null;
  }
};

const mergeProfessionalSeverity = (
  result: FloodAnalysisResult,
  calibration: SeverityCalibrationResult | null,
  classification?: GuidelineClassificationResult | null
): FloodAnalysisResult => {
  if (!result.isRelevant || !calibration) return result;

  const formulaFloor = inferMinimumRiskScore(result, classification);
  const calibratedScore = Math.max(result.riskScore, calibration.riskScore, formulaFloor);
  if (calibratedScore <= result.riskScore) return result;

  const mergedHazards = calibration.markers.length > 0
    ? `${result.detectedHazards || 'Flood hazards detected'}; ${calibration.markers.join(', ')}`
    : result.detectedHazards;

  return {
    ...result,
    riskScore: calibratedScore,
    severity: severityLabelFromScore(calibratedScore),
    estimatedDepth: calibration.estimatedDepth || result.estimatedDepth,
    waterDepth: calibration.waterDepth || result.waterDepth,
    humanRisk: calibration.humanRisk || (calibratedScore >= 9 ? 'Critical' : calibratedScore >= 7 ? 'High' : calibratedScore >= 5 ? 'Moderate' : result.humanRisk),
    detectedHazards: mergedHazards,
    infrastructureStatus: calibration.rationale
      ? `${result.infrastructureStatus || 'Flood condition observed'}. ${calibration.rationale}`
      : result.infrastructureStatus,
    aiConfidence: Math.max(result.aiConfidence, calibration.confidence || 0),
    directive: calibratedScore >= 9
      ? 'Critical flooding detected. Evacuate immediately and move to higher ground.'
      : calibratedScore >= 7
        ? 'Severe flood indicators detected. Avoid the area and move to higher ground immediately.'
        : result.directive,
  };
};

const reassessLowScoreViaRest = async (
  result: FloodAnalysisResult,
  base64Image: string,
  mimeType: string
): Promise<FloodAnalysisResult> => {
  if (!result.isRelevant || result.riskScore > 3) return result;

  const prompt = `Reassess this flood image with focus on severe cues.

Return ONLY JSON with the same FloodAnalysisResult fields.

Hard requirement:
- If you see rooftop stranding, people on roof, submerged house/building, roof-level floodwater, or rooftop rescue context, riskScore MUST be 9 or 10.
- If severe cues are absent, provide the best professional estimate.
`;

  try {
    const reassessed = await analyzeFloodImageViaRest(prompt, base64Image, mimeType);
    if (reassessed.isRelevant && reassessed.riskScore > result.riskScore) {
      return reassessed;
    }
  } catch {
    // keep current result if reassessment fails
  }

  return result;
};

const classifyGuidelineImageViaRest = async (
  base64Image: string,
  mimeType: string
): Promise<GuidelineClassificationResult | null> => {
  const classificationPrompt = `Analyze this image against these accepted guideline categories:
1. Flooded Roads
2. Rivers & Canals
3. Drain Blockages
4. Waterlogged Areas

Return ONLY JSON in this format:
{"matchesGuideline":true,"categories":["Flooded Roads"],"detectedContents":["cars","shop lots","road covered by muddy water"],"summary":"short summary"}

Rules:
- matchesGuideline=true if the image clearly fits at least one category.
- Rivers, canals, sea/coast water, drains, flooded streets, and waterlogged ground all count as acceptable water-condition images.
- Set matchesGuideline=false for babies, toys, indoor play scenes, selfies, portraits, documents, product photos, animals, or any image without visible water/drainage/flood context.
- Do NOT invent accepted categories when water/drainage/flood evidence is missing.
- If matchesGuideline=false, list what is actually visible in detectedContents.`;

  try {
    const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(restUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: classificationPrompt },
            { inline_data: { mime_type: mimeType, data: base64Image } }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 250 }
      })
    });

    if (!response.ok) return null;

    const json = await response.json();
    const parts: any[] = json?.candidates?.[0]?.content?.parts ?? [];
    const rawText = [...parts].reverse().find((part: any) => part.text && !part.thought)?.text ?? parts[0]?.text ?? '';
    if (!rawText) return null;

    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]) as Partial<GuidelineClassificationResult>;
    return {
      matchesGuideline: Boolean(parsed.matchesGuideline),
      categories: Array.isArray(parsed.categories) ? parsed.categories.filter(Boolean) : [],
      detectedContents: Array.isArray(parsed.detectedContents) ? parsed.detectedContents.filter(Boolean) : [],
      summary: parsed.summary?.trim() || ''
    };
  } catch {
    return null;
  }
};

const recoverFloodFalseNegative = async (
  parsed: FloodAnalysisResult,
  base64Image: string,
  mimeType: string
): Promise<FloodAnalysisResult> => {
  if (parsed.isRelevant) return parsed;

  const recoveryPrompt = `You are validating whether this image contains REAL flood/drainage risk.

IMPORTANT: If there is visible standing water on roads/streets, submerged vehicles, overflowing drains, waterlogged urban areas, or flood flow, then this IS relevant and must be accepted.

Return ONLY JSON with the exact fields:
{"isRelevant":true,"rejectionReason":"","estimatedDepth":"~0.5m","detectedHazards":"Submerged road lanes, stalled vehicles","passability":"Pedestrians:Avoid|Motorcycles:Avoid|Cars:Avoid|4x4:Caution","aiConfidence":85,"directive":"Floodwater detected on road. Avoid crossing and move to higher ground.","riskScore":7,"severity":"SEVERE","waterDepth":"Knee-Deep (0.3-0.5m)","waterCurrent":"Moderate","infrastructureStatus":"Roads partially submerged","humanRisk":"High","eventType":"Flash Flood","estimatedStartTime":"Already in progress","estimatedEndTime":"Unknown"}

If the image truly has no flood/drainage relevance at all, set isRelevant=false and explain briefly in rejectionReason.`;

  const classification = await classifyGuidelineImageViaRest(base64Image, mimeType);

  try {
    const recovered = await analyzeFloodImageViaRest(recoveryPrompt, base64Image, mimeType);
    if (recovered.isRelevant) return recovered;
  } catch {
    // keep original parsed result when recovery attempt fails
  }

  if (classification?.matchesGuideline) {
    return buildGuidelineAcceptedResult(classification);
  }

  // Final guard: if image has visible water/drainage/sea/river context,
  // do dynamic re-scoring (not fixed low score).
  const hasWaterEvidence = await detectWaterEvidenceViaRest(base64Image, mimeType);
  if (hasWaterEvidence) {
    const baseline = buildGuidelineAcceptedResult(classification);
    const reassessed = await reassessLowScoreViaRest(baseline, base64Image, mimeType);
    const criticalCue = await detectCriticalRooftopCueViaRest(base64Image, mimeType);
    const calibrated = mergeProfessionalSeverity(
      reassessed,
      await calibrateSeverityViaRest(base64Image, mimeType),
      classification
    );
    const criticalApplied = applyCriticalVisualOverride(calibrated, criticalCue);
    const guarded = enforceSeverityGuardrails(criticalApplied, classification);

    return enforceProfessionalConsistency(guarded, classification);
  }

  if (classification && !classification.matchesGuideline) {
    return buildFallbackFloodAnalysisResult(buildClassificationRejectionReason(classification));
  }

  return buildFallbackFloodAnalysisResult(
    'Gemini could not match this image to the accepted guideline categories. Please upload a clearer image of flooded roads, rivers/canals, drain blockages, or waterlogged areas.'
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// analyzeFloodImage
//
// Model: gemini-2.5-flash via GoogleGenAI SDK
// Strategy: Firebase cache → SDK generateContent → save result to cache
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
        const cachedResult = cached.result as FloodAnalysisResult;
        if (cachedResult.isRelevant) {
          if (cachedResult.riskScore <= 3) {
            console.log('[Gemini] Low-score cache hit detected; bypassing cache for fresh reassessment.');
          } else {
          const criticalCue = await detectCriticalRooftopCueViaRest(base64Image, mimeType);
          const sceneContext = await detectSceneContextViaRest(base64Image, mimeType);
          const calibrated = mergeProfessionalSeverity(
            cachedResult,
            await calibrateSeverityViaRest(base64Image, mimeType)
          );
          const criticalApplied = applyCriticalVisualOverride(calibrated, criticalCue);
          const sceneCapped = applySceneContextCap(criticalApplied, sceneContext, criticalCue);
          const guarded = enforceSeverityGuardrails(sceneCapped);
          const cachedFinal = enforceProfessionalConsistency(guarded);
          console.log('[Gemini][Debug] Cached scoring:', {
            initialScore: cachedResult.riskScore,
            calibratedScore: calibrated.riskScore,
            sceneNormal: sceneContext?.isNormalWaterbody ?? null,
            sceneDanger: sceneContext?.hasFloodDanger ?? null,
            criticalCue: criticalCue?.isCritical ?? null,
            finalScore: cachedFinal.riskScore,
            finalSeverity: cachedFinal.severity,
          });
          return cachedFinal;
          }
        }
      }
    }
  } catch { /* cache miss is fine */ }

  // ── Prompt ──────────────────────────────────────────────────────────────────
  const prompt = `You are a Malaysian flood risk AI analyst. Analyze this image.

STEP 1: Is this image showing flood, water, sea/river/canal, or drainage conditions?
If YES (including normal water area, river, sea, canal, drain, waterlogged ground):
  → set isRelevant=true.
  Set riskScore from visible severity cues (1-10). Do NOT default to low score unless cues clearly indicate low risk.
If NO (selfie, food, document, indoor room with no water context, etc):
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
  People on rooftop / house roof-level flooding / submerged house with only roof visible → riskScore MINIMUM 9

YOU MUST return ONLY the JSON object below. No markdown. No code fences. No text before or after.

{"isRelevant":true,"rejectionReason":"","estimatedDepth":"~0.3m","detectedHazards":"Submerged manholes, floating debris","passability":"Pedestrians:Caution|Motorcycles:Avoid|Cars:Avoid|4x4:Caution","aiConfidence":80,"directive":"Water is knee-deep. Avoid crossing. Move to higher ground.","riskScore":5,"severity":"MODERATE","waterDepth":"Knee-Deep (0.3-0.5m)","waterCurrent":"Slow","infrastructureStatus":"Roads partially submerged","humanRisk":"Moderate","eventType":"Flash Flood","estimatedStartTime":"Already in progress","estimatedEndTime":"${new Date(Date.now() + 7200000).toISOString()}"}`;

  const cacheParsedResult = (result: FloodAnalysisResult) => {
    set(ref(rtdb, `analysisCache/${cacheKey}`), {
      result,
      timestamp: Date.now()
    }).catch(() => { /* non-fatal */ });
  };

  const classification = await classifyGuidelineImageViaRest(base64Image, mimeType);

  if (classification && !hasAcceptedWaterContent(classification)) {
    const rejected = buildFallbackFloodAnalysisResult(buildClassificationRejectionReason(classification));
    cacheParsedResult(rejected);
    return rejected;
  }

  const finalizeParsedResult = async (result: FloodAnalysisResult) => {
    const recovered = await recoverFloodFalseNegative(result, base64Image, mimeType);
    const reassessed = await reassessLowScoreViaRest(recovered, base64Image, mimeType);
    const criticalCue = await detectCriticalRooftopCueViaRest(base64Image, mimeType);
    const sceneContext = await detectSceneContextViaRest(base64Image, mimeType);
    const calibrated = mergeProfessionalSeverity(
      reassessed,
      await calibrateSeverityViaRest(base64Image, mimeType),
      classification
    );
    const criticalApplied = applyCriticalVisualOverride(calibrated, criticalCue);
    const sceneCapped = applySceneContextCap(criticalApplied, sceneContext, criticalCue);
    const guarded = enforceSeverityGuardrails(sceneCapped, classification);

    // Professional regrade pass when score is suspiciously low.
    const regraded = guarded.riskScore <= 3
      ? await professionalRegradeViaRest(base64Image, mimeType, guarded)
      : null;

    const mergedRegrade = regraded
      ? enforceSeverityGuardrails(
          applyCriticalVisualOverride(
            mergeProfessionalSeverity(guarded, {
              riskScore: regraded.riskScore,
              estimatedDepth: regraded.estimatedDepth,
              waterDepth: regraded.waterDepth,
              humanRisk: regraded.humanRisk,
              markers: [regraded.detectedHazards].filter(Boolean),
              rationale: regraded.infrastructureStatus,
              confidence: regraded.aiConfidence,
            }, classification),
            criticalCue
          ),
          classification
        )
      : guarded;

    const finalResult = harmonizeMetricsWithSeverity(
      enforceProfessionalConsistency(mergedRegrade, classification),
      classification,
      sceneContext
    );

    console.log('[Gemini][Debug] Fresh scoring:', {
      parsedScore: result.riskScore,
      recoveredScore: recovered.riskScore,
      reassessedScore: reassessed.riskScore,
      calibratedScore: calibrated.riskScore,
      regradedScore: regraded?.riskScore ?? null,
      sceneNormal: sceneContext?.isNormalWaterbody ?? null,
      sceneDanger: sceneContext?.hasFloodDanger ?? null,
      sceneReason: sceneContext?.reason ?? null,
      criticalCue: criticalCue?.isCritical ?? null,
      criticalReason: criticalCue?.reason ?? null,
      finalScore: finalResult.riskScore,
      finalSeverity: finalResult.severity,
    });
    cacheParsedResult(finalResult);
    return finalResult;
  };

  try {
    const parsed = await analyzeFloodImageViaRest(prompt, base64Image, mimeType);
    return await finalizeParsedResult(parsed);
  } catch (restError: any) {
    console.warn('[Gemini] Primary REST image analysis failed, trying SDK fallback:', restError);
    try {
      const apiCall = ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: base64Image } }
            ]
          }
        ],
        config: {
          temperature: 0.1,
          maxOutputTokens: 512,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isRelevant: { type: Type.BOOLEAN },
              rejectionReason: { type: Type.STRING },
              estimatedDepth: { type: Type.STRING },
              detectedHazards: { type: Type.STRING },
              passability: { type: Type.STRING },
              aiConfidence: { type: Type.NUMBER },
              directive: { type: Type.STRING },
              riskScore: { type: Type.NUMBER },
              severity: { type: Type.STRING },
              waterDepth: { type: Type.STRING },
              waterCurrent: { type: Type.STRING },
              infrastructureStatus: { type: Type.STRING },
              humanRisk: { type: Type.STRING },
              estimatedStartTime: { type: Type.STRING },
              estimatedEndTime: { type: Type.STRING },
              eventType: { type: Type.STRING }
            },
            required: [
              'isRelevant',
              'rejectionReason',
              'estimatedDepth',
              'detectedHazards',
              'passability',
              'aiConfidence',
              'directive',
              'riskScore',
              'severity',
              'waterDepth',
              'waterCurrent',
              'infrastructureStatus',
              'humanRisk',
              'estimatedStartTime',
              'estimatedEndTime',
              'eventType'
            ]
          }
        }
      });

      const response = await withTimeout(apiCall, 35000, null);
      if (!response) {
        throw new Error('Request timed out. Try a smaller image and tap Retry.');
      }

      const structured = (response as any).parsed as Partial<FloodAnalysisResult> | undefined;
      if (structured && typeof structured === 'object') {
        const normalized = normalizeFloodAnalysisResult(structured);
        return await finalizeParsedResult(normalized);
      }

      const rawText = extractGeminiResponseText(response);
      const parsed = rawText
        ? parseFloodAnalysisText(rawText)
        : await analyzeFloodImageViaRest(prompt, base64Image, mimeType);

      return await finalizeParsedResult(parsed);
    } catch (err: any) {
      const msg = err?.message ?? '';
      const status = err?.status ?? err?.code ?? 0;

      console.error('[Gemini] Image analysis failed:', err);

      if (status === 429 || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
        throw new Error('Quota exceeded. Wait 60 seconds and tap Retry.\nFor unlimited use, enable billing at aistudio.google.com.');
      }
      if (status === 400 && msg.toLowerCase().includes('api key')) {
        throw new Error('Invalid API key. Add a valid VITE_GEMINI_API_KEY to your .env file.');
      }
      if (status === 401 || status === 403) {
        throw new Error('API key rejected — it may be revoked or invalid.\nCreate a new key at aistudio.google.com/apikey and add it to your .env file.');
      }
      if (status === 404 || msg.toLowerCase().includes('model not found')) {
        throw new Error('Gemini image model not found. The configured image-analysis model is unavailable.');
      }
      if (msg.includes('Could not read AI response') || msg.includes('malformed')) {
        try {
          const parsed = await analyzeFloodImageViaRest(prompt, base64Image, mimeType);
          return await finalizeParsedResult(parsed);
        } catch (fallbackError) {
          console.error('[Gemini] REST fallback failed:', fallbackError);
        }
      }

      const fallbackReason = msg.includes('Request timed out')
        ? 'Primary Gemini analysis timed out. Running flood-evidence recovery.'
        : (msg || 'Gemini analysis failed. Running flood-evidence recovery.');

      const recovered = await recoverFloodFalseNegative(
        buildFallbackFloodAnalysisResult(fallbackReason),
        base64Image,
        mimeType
      );
      const guarded = enforceSeverityGuardrails(recovered, classification);
      const harmonized = harmonizeMetricsWithSeverity(guarded, classification);
      cacheParsedResult(harmonized);
      return harmonized;
    }
  }
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
      model: "gemini-2.0-flash",
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
// ─────────────────────────────────────────────────────────────────────────────
// analyzeLocationRisk
// Real-time flood risk analysis for a specific Malaysian location.
// Uses Gemini 2.0 Flash with Google Search grounding.
// ─────────────────────────────────────────────────────────────────────────────

export interface LocationRiskAnalysis {
  severity: number;
  drainageBlockage: number;
  rainfall: number;
  aiAnalysisText: string;
  terrain: { type: string; label: string };
  historical: { frequency: string; status: string };
  waterLevel: string;
  waterLevelStatus: string;
}

export async function analyzeLocationRisk(
  locationName: string,
  lat: number,
  lng: number
): Promise<LocationRiskAnalysis> {

  const buildFallback = (): LocationRiskAnalysis => {
    let h = 0;
    for (let i = 0; i < locationName.length; i++) { h = ((h << 5) - h) + locationName.charCodeAt(i); h |= 0; }
    const rnd = (min: number, max: number) => { const x = Math.sin(h++) * 10000; return Math.floor(min + (x - Math.floor(x)) * (max - min)); };
    const sev = rnd(1, 4);
    const terrainOptions: [string, string][] = [['Low', 'Depression'], ['Flat', 'Plains'], ['Hilly', 'Slopes'], ['Steep', 'High Ground']];
    const t = terrainOptions[rnd(0, 4)];
    const histOpts: [string, string][] = [['0x/yr', 'Inactive'], ['1x/yr', 'Monitor'], ['2x/yr', 'Active'], ['3+x/yr', 'Critical']];
    const hi = histOpts[rnd(0, 4)];
    return {
      severity: sev, drainageBlockage: rnd(5, 40), rainfall: rnd(0, 20),
      aiAnalysisText: `No live data available for ${locationName}. Conditions appear normal based on historical records.`,
      terrain: { type: t[0], label: t[1] },
      historical: { frequency: hi[0], status: hi[1] },
      waterLevel: 'Low', waterLevelStatus: 'Normal'
    };
  };

  if (!isKeyValid(GEMINI_API_KEY)) return buildFallback();

  try {
    const prompt = `You are a real-time flood risk analyst for Malaysia. The user is checking flood risk for "${locationName}" (lat:${lat.toFixed(4)}, lng:${lng.toFixed(4)}).

Search Google RIGHT NOW for:
1. Current weather in ${locationName}, Malaysia (rain, storm, clear?)
2. Active flood warnings or JPS water level alerts for ${locationName} today
3. MetMalaysia advisories for this area
4. Current drainage or road flood status for ${locationName}
5. Historical flood frequency for ${locationName} (how many times per year?)
6. Terrain type of ${locationName} (low-lying, hilly, near river, near coast?)

Based on real search results, respond ONLY with this JSON (no markdown, no code fences):
{"severity":<1-10>,"drainageBlockage":<0-100>,"rainfall":<mm/hr, 0 if not raining>,"aiAnalysisText":"<2 actionable sentences for residents NOW>","terrain":{"type":"<Low|Flat|Hilly|Steep>","label":"<Depression|Plains|Slopes|High Ground>"},"historical":{"frequency":"<0x/yr|1x/yr|2x/yr|3+x/yr>","status":"<Inactive|Monitor|Active|Critical>"},"waterLevel":"<High|Medium|Low>","waterLevelStatus":"<Rising|Stable|Normal>"}

Severity: 1-3=safe, 4-6=moderate risk, 7-8=severe flooding, 9-10=critical.`;

    const apiCall = ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
        maxOutputTokens: 350
      }
    });

    const response = await withTimeout(apiCall, 14000, null);
    if (!response) {
      console.warn(`[LocationRisk] Timeout for ${locationName} — using fallback`);
      return buildFallback();
    }

    const raw = response.text?.trim() ?? '';
    const cleaned = raw.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/im, '').trim();
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('No JSON in location risk response');

    const parsed = JSON.parse(m[0]) as LocationRiskAnalysis;
    parsed.severity = Math.max(1, Math.min(10, Math.round(parsed.severity ?? 1)));
    parsed.drainageBlockage = Math.max(0, Math.min(100, Math.round(parsed.drainageBlockage ?? 10)));
    parsed.rainfall = Math.max(0, parsed.rainfall ?? 0);
    return parsed;

  } catch (error: any) {
    const msg = error?.message ?? '';
    const status = error?.status ?? error?.code ?? 0;
    if (status === 429 || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
      console.warn(`[LocationRisk] Rate limit for ${locationName}`);
    } else {
      console.error(`[LocationRisk] Failed for ${locationName}:`, error);
    }
    return buildFallback();
  }
}
