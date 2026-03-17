import { get, ref, remove, update } from 'firebase/database';
import { rtdb } from '../firebase';
import { getMainTown, isStateDuplicate, isStateOnly, normalizeStateName, normalizeToTownState } from './floodCalculations';

export const fixFederalTerritoryDuplicates = async (): Promise<void> => {
  const snap = await get(ref(rtdb, 'liveZones'));
  const zones = Object.entries(snap.val() ?? {}) as [string, any][];

  const DUPLICATES = [
    'Kuala Lumpur, Kuala Lumpur',
    'Putrajaya, Putrajaya',
    'Labuan, Labuan',
  ];

  const FIXES: Record<string, string> = {
    'Kuala Lumpur, Kuala Lumpur': 'Kuala Lumpur',
    'Putrajaya, Putrajaya': 'Putrajaya',
    'Labuan, Labuan': 'Labuan Town',
  };

  for (const [id, zone] of zones) {
    const locationName = String(zone?.locationName ?? '');
    if (DUPLICATES.includes(locationName)) {
      await update(ref(rtdb, `liveZones/${id}`), {
        locationName: FIXES[locationName],
      });
      console.log(`Fixed: "${locationName}" → "${FIXES[locationName]}"`);
    }
  }
};

export const purgeHardcodedSeedZones = async (): Promise<number> => {
  const snapshot = await get(ref(rtdb, 'liveZones'));
  const zones = Object.entries(snapshot.val() ?? {}) as [string, any][];
  let deleted = 0;

  for (const [zoneId, zone] of zones) {
    const source = String(zone?.source || '').toLowerCase().trim();

    const isSafe =
      source === 'user' ||
      zone?.uploadedAt != null ||
      zone?.reportId != null;

    const isSeed =
      source === 'baseline' ||
      source === 'seed' ||
      zone?.isWeatherFallbackZone === true;

    if (isSeed && !isSafe) {
      await remove(ref(rtdb, `liveZones/${zoneId}`));
      deleted += 1;
    }
  }

  return deleted;
};

export const deduplicateBaselineZones = async (): Promise<number> => {
  const zonesRef = ref(rtdb, 'liveZones');
  const snapshot = await get(zonesRef);
  if (!snapshot.exists()) return 0;

  const zones = Object.entries(snapshot.val() || {}) as [string, any][];
  const seen = new Map<string, string>();
  const deletions: Promise<void>[] = [];

  for (const [zoneId, zone] of zones) {
    if (String(zone?.source || '').toLowerCase().trim() !== 'baseline') {
      continue;
    }

    const locationName = String(zone?.locationName || '').trim();
    const state = String(zone?.state || '').trim();
    if (!locationName || !state) {
      continue;
    }

    const key = `${locationName.toLowerCase()}|${state.toLowerCase()}`;
    if (seen.has(key)) {
      deletions.push(remove(ref(rtdb, `liveZones/${zoneId}`)));
    } else {
      seen.set(key, zoneId);
    }
  }

  if (deletions.length > 0) {
    await Promise.all(deletions);
  }

  return deletions.length;
};

export const resetBaselineSeverities = async (): Promise<void> => {
  const snap = await get(ref(rtdb, 'liveZones'));
  const zones = Object.entries(snap.val() ?? {}) as [string, any][];
  let fixed = 0;

  for (const [id, zone] of zones) {
    const isBaseline =
      zone?.isWeatherFallbackZone === true ||
      zone?.source === 'baseline' ||
      zone?.source === 'seed' ||
      zone?.source === 'hardcoded' ||
      (!zone?.reportId && !zone?.uploadedAt && zone?.source !== 'user');

    if (isBaseline && Number(zone?.severity ?? 1) !== 1) {
      await update(ref(rtdb, `liveZones/${id}`), {
        severity: 1,
        isWeatherFallbackZone: true,
        source: 'baseline',
      });
      fixed += 1;
      console.log(`[reset] ${zone?.locationName || id}: ${zone?.severity} → 1`);
    }
  }

  console.log(`[reset] Fixed ${fixed} baseline zones`);
};

export const migrateLocationNames = async (): Promise<void> => {
  const snap = await get(ref(rtdb, 'liveZones'));
  const zones = Object.entries(snap.val() ?? {}) as [string, any][];
  let fixed = 0;

  for (const [id, zone] of zones) {
    const name = String(zone?.locationName ?? '').trim();
    const state = normalizeStateName(String(zone?.state ?? '').trim());
    const needsFix =
      !name ||
      isStateOnly(name) ||
      isStateDuplicate(name) ||
      /^[A-Z0-9]{4,}\+/i.test(name) ||
      /\d{5}/.test(name) ||
      /Wilayah Persekutuan/i.test(name) ||
      /,.*,.*,/.test(name);

    if (!needsFix) {
      continue;
    }

    let newName = name;
    if (zone?.lat != null && zone?.lng != null) {
      try {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json`
          + `?latlng=${zone.lat},${zone.lng}`
          + `&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
        ).then((response) => response.json());

        const comps = res.results?.[0]?.address_components ?? [];
        const addr = res.results?.[0]?.formatted_address ?? name;
        newName = normalizeToTownState(addr, comps);
      } catch {
        newName = state
          ? `${getMainTown(state)}, ${state}`
          : normalizeToTownState(name);
      }
    } else {
      newName = state
        ? `${getMainTown(state)}, ${state}`
        : normalizeToTownState(name);
    }

    const fixedState = state || undefined;
    await update(ref(rtdb, `liveZones/${id}`), {
      locationName: newName,
      state: fixedState,
    });
    console.log(`[migration] "${name}" → "${newName}"`);
    fixed += 1;
  }

  console.log(`[migration] Fixed ${fixed} zones`);
};
