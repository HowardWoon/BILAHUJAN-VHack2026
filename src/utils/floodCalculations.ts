import { MALAYSIAN_FLOOD_HISTORY } from '../data/historicalFloodData';

export interface ZoneLike {
  id?: string;
  severity?: number;
  state?: string;
  locationName?: string;
  reportId?: string | null;
  source?: string;
  isWeatherFallbackZone?: boolean;
  blockagePercent?: number;
  drainageBlockage?: number;
  firstReportedAt?: number | string;
  uploadedAt?: number | string;
  timestamp?: number | string;
}

export const isRealZone = (zone: ZoneLike | any): boolean => {
  return (
    zone?.isWeatherFallbackZone !== true &&
    zone?.source !== 'baseline' &&
    zone?.source !== 'seed' &&
    zone?.source !== 'hardcoded' &&
    Number(zone?.severity || 0) >= 2 &&
    (zone?.reportId != null || zone?.uploadedAt != null || zone?.source === 'user')
  );
};

export const isZoneExpired = (zone: any): boolean => {
  if (zone?.isExpired === true) return true;

  const expirySource = zone?.endTime ?? zone?.estimatedEndTime;
  if (!expirySource) return false;

  if (Number(zone?.severity || 0) <= 1) return false;

  const endTimeMs = toTimestampMs(expirySource);
  if (!endTimeMs) return false;

  return Date.now() >= endTimeMs;
};

export interface ReportLike {
  zoneId?: string;
  severity?: number;
  state?: string;
  locationName?: string;
  timestamp?: number | string;
  userId?: string;
}

export interface AgentAlertLike {
  zoneId?: string;
  dispatchedAt?: number | string;
}

export const normalizeStateName = (raw: string): string => {
  const trimmed = raw?.trim() ?? '';

  const map: Record<string, string> = {
    'Selangor': 'Selangor',
    'Wilayah Persekutuan Kuala Lumpur': 'Kuala Lumpur',
    'Federal Territory of Kuala Lumpur': 'Kuala Lumpur',
    'WP Kuala Lumpur': 'Kuala Lumpur',
    'Kuala Lumpur': 'Kuala Lumpur',
    'Wilayah Persekutuan Putrajaya': 'Putrajaya',
    'Federal Territory of Putrajaya': 'Putrajaya',
    'Putrajaya': 'Putrajaya',
    'Wilayah Persekutuan Labuan': 'Labuan',
    'Federal Territory of Labuan': 'Labuan',
    'Labuan': 'Labuan',
    'Pulau Pinang': 'Penang',
    'Penang': 'Penang',
    'Pinang': 'Penang',
    'Johor': 'Johor',
    'Johor Darul Takzim': 'Johor',
    'Kedah': 'Kedah',
    'Kedah Darul Aman': 'Kedah',
    'Kelantan': 'Kelantan',
    'Kelantan Darul Naim': 'Kelantan',
    'Melaka': 'Melaka',
    'Malacca': 'Melaka',
    'Negeri Sembilan': 'Negeri Sembilan',
    'Negeri Sembilan Darul Khusus': 'Negeri Sembilan',
    'Pahang': 'Pahang',
    'Pahang Darul Makmur': 'Pahang',
    'Perak': 'Perak',
    'Perak Darul Ridzuan': 'Perak',
    'Perlis': 'Perlis',
    'Perlis Indera Kayangan': 'Perlis',
    'Sabah': 'Sabah',
    'Sarawak': 'Sarawak',
    'Terengganu': 'Terengganu',
    'Terengganu Darul Iman': 'Terengganu'
  };

  return map[trimmed] ?? trimmed;
};

export const MALAYSIA_TOWNS: Record<string, string[]> = {
  'Johor': ['Johor Bahru', 'Batu Pahat', 'Muar', 'Kluang', 'Segamat', 'Mersing', 'Pontian', 'Kota Tinggi', 'Kulai', 'Skudai', 'Pasir Gudang', 'Tangkak', 'Simpang Renggam', 'Labis', 'Yong Peng', 'Ayer Hitam', 'Senai'],
  'Kedah': ['Alor Setar', 'Sungai Petani', 'Kulim', 'Langkawi', 'Baling', 'Kubang Pasu', 'Padang Serai', 'Pokok Sena', 'Yan', 'Pendang', 'Bandar Baharu', 'Kuah', 'Jitra', 'Gurun', 'Bedong'],
  'Kelantan': ['Kota Bharu', 'Tanah Merah', 'Pasir Mas', 'Gua Musang', 'Kuala Krai', 'Machang', 'Tumpat', 'Bachok', 'Pasir Puteh', 'Jeli', 'Rantau Panjang', 'Pengkalan Chepa'],
  'Melaka': ['Melaka City', 'Alor Gajah', 'Jasin', 'Masjid Tanah', 'Merlimau', 'Ayer Keroh', 'Bukit Katil', 'Bemban'],
  'Negeri Sembilan': ['Seremban', 'Port Dickson', 'Nilai', 'Rembau', 'Tampin', 'Bahau', 'Kuala Pilah', 'Jelebu', 'Jempol', 'Senawang', 'Rantau', 'Gemas'],
  'Pahang': ['Kuantan', 'Temerloh', 'Bentong', 'Raub', 'Pekan', 'Jerantut', 'Cameron Highlands', 'Bera', 'Rompin', 'Lipis', 'Maran', 'Mentakab', 'Tanah Rata', 'Muadzam Shah'],
  'Penang': ['George Town', 'Butterworth', 'Bayan Lepas', 'Balik Pulau', 'Nibong Tebal', 'Bukit Mertajam', 'Seberang Jaya', 'Kepala Batas', 'Batu Kawan', 'Permatang Pauh', 'Air Itam'],
  'Perak': ['Ipoh', 'Taiping', 'Teluk Intan', 'Lumut', 'Manjung', 'Kuala Kangsar', 'Seri Iskandar', 'Batu Gajah', 'Parit Buntar', 'Kampar', 'Tapah', 'Slim River', 'Bidor', 'Sitiawan', 'Gerik', 'Lenggong'],
  'Perlis': ['Kangar', 'Arau', 'Padang Besar', 'Simpang Empat', 'Kuala Perlis'],
  'Sabah': ['Kota Kinabalu', 'Sandakan', 'Tawau', 'Lahad Datu', 'Keningau', 'Semporna', 'Kota Belud', 'Ranau', 'Beaufort', 'Papar', 'Tuaran', 'Kudat', 'Penampang', 'Putatan'],
  'Sarawak': ['Kuching', 'Miri', 'Sibu', 'Bintulu', 'Limbang', 'Sri Aman', 'Sarikei', 'Kapit', 'Mukah', 'Betong', 'Lawas', 'Saratok', 'Serian', 'Marudi', 'Bau'],
  'Selangor': ['Shah Alam', 'Petaling Jaya', 'Klang', 'Subang Jaya', 'Sepang', 'Rawang', 'Ampang', 'Kajang', 'Bandar Kajang', 'Puchong', 'Cheras', 'Setia Alam', 'Banting', 'Kuala Selangor', 'Sabak Bernam', 'Semenyih', 'Bangi', 'Cyberjaya'],
  'Terengganu': ['Kuala Terengganu', 'Kemaman', 'Dungun', 'Besut', 'Hulu Terengganu', 'Setiu', 'Marang', 'Chukai', 'Kerteh'],
  'Kuala Lumpur': ['Chow Kit', 'Titiwangsa', 'Kepong', 'Bangsar', 'Bukit Jalil', 'Wangsa Maju', 'Setapak', 'Segambut', 'Bukit Bintang', 'Damansara', 'Sentul', 'Pudu', 'Sri Petaling', 'Setiawangsa'],
  'Putrajaya': ['Putrajaya'],
  'Labuan': ['Labuan Town', 'Victoria']
};

export const ALL_STATE_NAMES = [
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan',
  'Pahang', 'Penang', 'Perak', 'Perlis', 'Sabah', 'Sarawak',
  'Selangor', 'Terengganu', 'Kuala Lumpur', 'Putrajaya', 'Labuan',
  'Pulau Pinang', 'Wilayah Persekutuan Kuala Lumpur',
];

export const isStateOnly = (name: string): boolean => {
  const normalized = normalizeStateName((name || '').trim());
  if (!normalized) return false;
  return ALL_STATE_NAMES.some((stateName) => normalizeStateName(stateName) === normalized);
};

export const isStateDuplicate = (name: string): boolean => {
  const parts = (name || '').split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 2) return false;
  return normalizeStateName(parts[0]) === normalizeStateName(parts[1]);
};

export const getMainTown = (state: string): string => {
  const capitals: Record<string, string> = {
    'Johor': 'Johor Bahru',
    'Kedah': 'Alor Setar',
    'Kelantan': 'Kota Bharu',
    'Melaka': 'Melaka City',
    'Negeri Sembilan': 'Seremban',
    'Pahang': 'Kuantan',
    'Penang': 'George Town',
    'Perak': 'Ipoh',
    'Perlis': 'Kangar',
    'Sabah': 'Kota Kinabalu',
    'Sarawak': 'Kuching',
    'Selangor': 'Shah Alam',
    'Terengganu': 'Kuala Terengganu',
    'Kuala Lumpur': 'Kuala Lumpur',
    'Putrajaya': 'Putrajaya',
    'Labuan': 'Labuan Town',
  };

  return capitals[state] ?? state;
};

const FT_DEDUP: Record<string, string> = {
  'Kuala Lumpur': 'Kuala Lumpur',
  'Putrajaya': 'Putrajaya',
  'Labuan': 'Labuan Town',
};

export const deduplicateFTName = (locationName: string): string => {
  const FT_DEDUP_STRINGS: Record<string, string> = {
    'Kuala Lumpur, Kuala Lumpur': 'Kuala Lumpur',
    'Putrajaya, Putrajaya': 'Putrajaya',
    'Labuan, Labuan': 'Labuan Town',
    'kuala lumpur, kuala lumpur': 'Kuala Lumpur',
    'putrajaya, putrajaya': 'Putrajaya',
    'labuan, labuan': 'Labuan Town',
  };

  return FT_DEDUP_STRINGS[locationName] ?? FT_DEDUP_STRINGS[locationName.toLowerCase()] ?? locationName;
};

export const normalizeToTownState = (
  fullAddress: string,
  geocodeComponents?: Array<{ types: string[]; long_name: string; short_name: string }>
): string => {
  if (geocodeComponents && geocodeComponents.length > 0) {
    const town =
      geocodeComponents.find((c) => c.types.includes('locality'))?.long_name ||
      geocodeComponents.find((c) => c.types.includes('sublocality_level_1'))?.long_name ||
      geocodeComponents.find((c) => c.types.includes('administrative_area_level_2'))?.long_name ||
      geocodeComponents.find((c) => c.types.includes('administrative_area_level_3'))?.long_name;

    const stateRaw =
      geocodeComponents.find((c) => c.types.includes('administrative_area_level_1'))?.long_name ?? '';
    const state = normalizeStateName(stateRaw);

    if (town && state) {
      const townNorm = normalizeStateName(town.trim());
      if (townNorm === state && FT_DEDUP[state]) {
        return FT_DEDUP[state];
      }
      return `${town}, ${state}`;
    }
    if (state) return `${getMainTown(state)}, ${state}`;
  }

  for (const [state, towns] of Object.entries(MALAYSIA_TOWNS)) {
    for (const town of towns) {
      const townRegex = new RegExp(`\\b${town}\\b`, 'i');
      if (townRegex.test(fullAddress || '')) {
        return `${town}, ${state}`;
      }
    }
  }

  const cleaned = (fullAddress || '')
    .replace(/^[A-Z0-9]{4,}\+[A-Z0-9]{2,4}\s*/i, '')
    .replace(/^\d+[A-Za-z]?[-\/]?\d*[A-Za-z]?,\s*/, '')
    .replace(/,?\s*\d{5}\s*/g, ', ')
    .replace(/,?\s*Malaysia\s*$/i, '')
    .replace(/Wilayah Persekutuan\s*/gi, '')
    .replace(/Federal Territory of\s*/gi, '')
    .replace(/Darul\s+\w+/gi, '')
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const parts = cleaned
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 1 && !/^\d+$/.test(part));

  if (parts.length >= 2) {
    const state = normalizeStateName(parts[parts.length - 1]);
    let town = parts[parts.length - 2];
    const isStreet = /^(jalan|jln|lorong|persiaran|lebuh|lebuhraya|kampung|kg\.?)\s/i.test(town);
    if (!isStreet) {
      if (normalizeStateName(town) === state) {
        if (FT_DEDUP[state]) return FT_DEDUP[state];
        return `${getMainTown(state)}, ${state}`;
      }
      return deduplicateFTName(`${town}, ${state}`);
    }
    if (parts.length >= 3) {
      town = parts[parts.length - 3];
    }

    if (normalizeStateName(town) === state) {
      if (FT_DEDUP[state]) return FT_DEDUP[state];
      return `${getMainTown(state)}, ${state}`;
    }

    return deduplicateFTName(`${town}, ${state}`);
  }

  if (parts.length === 1) {
    const state = normalizeStateName(parts[0]);
    if (isStateOnly(state)) {
      if (FT_DEDUP[state]) return FT_DEDUP[state];
      return `${getMainTown(state)}, ${state}`;
    }
    return deduplicateFTName(state);
  }

  return deduplicateFTName(fullAddress);
};

export const extractStateFromGeocode = (geocodeResult: any): string => {
  const components = geocodeResult?.address_components ?? [];
  const stateComp = components.find((component: any) =>
    Array.isArray(component?.types) && component.types.includes('administrative_area_level_1')
  );

  if (stateComp?.long_name) {
    return normalizeStateName(String(stateComp.long_name)) || 'Unknown';
  }

  const formattedAddress = String(geocodeResult?.formatted_address || '');
  const parts = formattedAddress.split(',').map((part) => part.trim()).filter(Boolean);
  const malaysiaIndex = parts.findIndex((part) => /^malaysia$/i.test(part));
  if (malaysiaIndex > 0) {
    return normalizeStateName(parts[malaysiaIndex - 1]) || 'Unknown';
  }

  return 'Unknown';
};

export const trimToCity = (fullAddress: string): string => {
  const normalized = normalizeToTownState(fullAddress || '');
  if (!normalized || /^\d+$/.test(normalized)) {
    return 'Unknown Location';
  }

  return normalized;
};

export const mean = (values: number[]): number => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const toTimestampMs = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
    }

    const ddmmyyyyMatch = trimmed.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,)?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]m)$/i
    );
    if (ddmmyyyyMatch) {
      const [, dayRaw, monthRaw, yearRaw, hourRaw, minuteRaw, secondRaw, meridiemRaw] = ddmmyyyyMatch;
      const day = Number(dayRaw);
      const month = Number(monthRaw);
      const year = Number(yearRaw);
      const minute = Number(minuteRaw);
      const second = Number(secondRaw || '0');
      const meridiem = meridiemRaw.toLowerCase();

      let hour = Number(hourRaw) % 12;
      if (meridiem === 'pm') {
        hour += 12;
      }

      const parsed = new Date(year, month - 1, day, hour, minute, second).getTime();
      if (Number.isFinite(parsed)) return parsed;
    }

    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  if (value && typeof value === 'object' && 'seconds' in (value as any)) {
    const seconds = Number((value as any).seconds);
    if (Number.isFinite(seconds)) return seconds * 1000;
  }

  return 0;
};

export const severityToBlockage = (severity: number): number =>
  severity >= 10 ? 98 : severity >= 9 ? 94 : severity >= 7 ? 80 : severity >= 5 ? 65 : severity >= 3 ? 40 : 15;

export const isDrainageBlocked = (severity: number): boolean => severityToBlockage(severity) > 60;

export const severityToRiskLabel = (severity: number): string => {
  if (severity >= 10) return 'CATASTROPHIC';
  if (severity >= 9) return 'CRITICAL';
  if (severity >= 7) return 'SEVERE';
  if (severity >= 5) return 'MODERATE';
  if (severity >= 3) return 'MINOR';
  return 'NORMAL';
};

export const severityToAssessment = (severity: number): string => {
  if (severity >= 9) return 'Catastrophic flooding. Immediate evacuation is imperative. Life is at risk.';
  if (severity >= 7) return 'Severe flooding. Vehicles and pedestrians cannot pass safely. Evacuate now.';
  if (severity >= 5) return 'Moderate flooding. Cars at risk of stalling. Avoid the area if possible.';
  if (severity >= 3) return 'Minor pooling. Motorcycles and pedestrians should proceed with caution.';
  return 'No significant flood risk detected. Conditions are safe.';
};

export const severityToDescription = (severity: number): string => {
  if (severity >= 8) return 'Water depth and current indicate high danger to people and vehicles.';
  if (severity >= 6) return 'Floodwater is significant and road accessibility is heavily reduced.';
  if (severity >= 4) return 'Moderate water rise detected in low-lying or poorly drained roads.';
  if (severity >= 2) return 'Light flooding signs present. Continue monitoring and stay alert.';
  return 'No active flood indicators detected. Monitoring continues.';
};

export const severityToBadge = (severity: number): { text: string; className: string; icon: string } => {
  if (severity >= 8) return { text: 'CRITICAL', className: 'bg-red-600 text-white animate-pulse', icon: 'priority_high' };
  if (severity >= 6) return { text: 'SEVERE', className: 'bg-orange-500 text-white', icon: 'warning' };
  if (severity >= 4) return { text: 'FLOOD', className: 'bg-yellow-500 text-black', icon: 'flood' };
  if (severity >= 2) return { text: 'CAUTION', className: 'bg-teal-500 text-white', icon: 'info' };
  return { text: 'CLEAR', className: 'bg-green-600 text-white', icon: 'check' };
};

export const severityToHeroBg = (severity: number): string => {
  if (severity >= 10) return 'from-[#5f0000] to-[#1a0000]';
  if (severity >= 9) return 'from-red-700 to-red-900';
  if (severity >= 7) return 'from-red-500 to-red-700';
  if (severity >= 5) return 'from-orange-400 to-orange-600';
  if (severity >= 3) return 'from-yellow-400 to-amber-500';
  return 'from-green-500 to-emerald-600';
};

export const severityToBorderColor = (severity: number): string => {
  if (severity >= 8) return 'border-l-red-500';
  if (severity >= 4) return 'border-l-orange-500';
  if (severity >= 2) return 'border-l-yellow-500';
  return 'border-l-green-500';
};

export const severityToCardClass = (severity: number): string => {
  if (severity >= 8) return 'bg-[#3d0000] border-l-4 border-l-red-500 border border-red-800/50';
  if (severity >= 6) return 'bg-[#2d1500] border-l-4 border-l-orange-500 border border-orange-800/40';
  if (severity >= 4) return 'bg-[#2d2000] border-l-4 border-l-yellow-500 border border-yellow-800/40';
  if (severity >= 2) return 'bg-[#001a1a] border-l-4 border-l-teal-500 border border-teal-800/40';
  return 'bg-[#1a1a2e] border-l-4 border-l-green-500 border border-slate-700/50';
};

export const severityToWaterDepth = (severity: number): string => {
  if (severity >= 10) return 'Catastrophic Inundation / Above 1.5m';
  if (severity >= 9) return 'Roof-Level / Above 1.3m';
  if (severity >= 7) return 'Waist to Chest (0.5-1.2m)';
  if (severity >= 5) return 'Knee-Deep (0.2-0.5m)';
  if (severity >= 3) return 'Ankle-Deep (<0.2m)';
  return 'Dry / Surface Damp';
};

export const severityToRainfallRange = (severity: number): string => {
  if (severity >= 10) return '> 60 mm/hr';
  if (severity >= 9) return '> 50 mm/hr';
  if (severity >= 7) return '35 - 50 mm/hr';
  if (severity >= 5) return '20 - 35 mm/hr';
  if (severity >= 3) return '10 - 20 mm/hr';
  return '< 10 mm/hr';
};

export const severityToPeakPrediction = (severity: number): string => {
  if (severity >= 10) return 'Flood is at catastrophic peak now';
  if (severity >= 9) return '< 0.5 hours';
  if (severity >= 7) return '1.5 hours';
  if (severity >= 5) return '3 hours';
  if (severity >= 3) return '6 hours';
  return 'no peak predicted';
};

export const deriveAIConfidence = (
  baselineConfidencePct: number,
  reportsAgreeingWithin1: number,
  totalReports: number,
  historicalMatch: boolean,
  severity?: number
): number => {
  const clampedBaseline = Math.max(0, Math.min(100, Number(baselineConfidencePct || 0))) / 100;
  const computed = calcAIConfidence(clampedBaseline, reportsAgreeingWithin1, totalReports, historicalMatch);

  if (typeof severity === 'number') {
    if (severity >= 10) return Math.max(95, Math.min(98, computed));
    if (severity >= 9) return Math.max(92, Math.min(97, computed));
    if (severity >= 7) return Math.max(85, computed);
  }

  return computed;
};

export const severityToRainfall = (severity: number): number =>
  severity >= 10 ? 65 : severity >= 9 ? 55 : severity >= 7 ? 45 : severity >= 5 ? 25 : severity >= 3 ? 12 : 5;

export const calcHistoricalRiskScore = (state: string, locationName: string): number => {
  const stateLower = (state || '').toLowerCase().trim();
  const locationLower = (locationName || '').toLowerCase().trim();

  const records = MALAYSIAN_FLOOD_HISTORY.filter((record) => {
    const recordState = (record.state || '').toLowerCase().trim();
    const recordName = (record.name || '').toLowerCase().trim();
    return recordState === stateLower || (locationLower && locationLower.includes(recordName));
  });

  const maxRecords = 10;
  return Math.min(10, (records.length / maxRecords) * 10);
};

export const reportDensity30min = (zoneId: string, reports: ReportLike[]): number => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  return reports.filter((report) => report.zoneId === zoneId && toTimestampMs(report.timestamp) > cutoff).length;
};

export const calcZoneSeverity = (
  geminiScore: number,
  rainfallMmHr: number,
  historicalRiskScore: number,
  reportCount30min: number
): number => {
  const rainfallScore = Math.min(10, rainfallMmHr / 6);
  const reportDensityScore = Math.min(10, reportCount30min * 2);

  const weighted =
    0.5 * geminiScore +
    0.25 * rainfallScore +
    0.15 * historicalRiskScore +
    0.1 * reportDensityScore;

  return Math.round(Math.min(10, Math.max(1, weighted)));
};

export const calcStateSeverity = (zones: ZoneLike[], state: string): number => {
  const stateLower = (state || '').toLowerCase().trim();
  const severities = zones
    .filter((zone) => (zone.state || '').toLowerCase().trim() === stateLower)
    .filter((zone) => !zone.isWeatherFallbackZone && zone.reportId != null)
    .map((zone) => Number(zone.severity || 1));

  return severities.length > 0 ? Math.max(...severities) : 1;
};

export const calcDrainageEfficiency = (zones: ZoneLike[]): number => {
  if (!zones.length) return 100;

  const realZones = zones.filter((zone) => Number(zone.severity || 0) >= 4 && !zone.isWeatherFallbackZone);
  if (!realZones.length) return 100;

  const avgBlockage = mean(
    realZones.map((zone) => {
      const explicit = Number(zone.blockagePercent ?? zone.drainageBlockage);
      return Number.isFinite(explicit) && explicit > 0 ? explicit : severityToBlockage(Number(zone.severity || 1));
    })
  );

  const affectedRatio = realZones.length / Math.max(1, zones.length);
  return Math.max(0, Math.round(100 - avgBlockage * affectedRatio));
};

export const calcAvgResponseTime = (zones: ZoneLike[], alerts: AgentAlertLike[]): number => {
  const matched = zones
    .map((zone) => {
      const alert = alerts.find((entry) => entry.zoneId === zone.id);
      if (!alert) return null;
      const firstReportedAt = toTimestampMs(zone.firstReportedAt ?? zone.uploadedAt ?? zone.timestamp);
      const dispatchedAt = toTimestampMs(alert.dispatchedAt);
      if (!firstReportedAt || !dispatchedAt || dispatchedAt < firstReportedAt) return null;
      return (dispatchedAt - firstReportedAt) / 60000;
    })
    .filter((minutes): minutes is number => typeof minutes === 'number' && Number.isFinite(minutes));

  if (!matched.length) return 0;
  return Math.round(mean(matched));
};

export const calcAIConfidence = (
  geminiConfidence: number,
  reportsAgreeingWithin1: number,
  totalReports: number,
  historicalMatch: boolean
): number => {
  const agreementScore = totalReports > 0 ? reportsAgreeingWithin1 / totalReports : 0.5;
  const histScore = historicalMatch ? 1.0 : 0.5;

  return Math.round((0.4 * geminiConfidence + 0.3 * agreementScore + 0.3 * histScore) * 100);
};
