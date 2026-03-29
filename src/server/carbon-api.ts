// ─── Electricity Maps carbon intensity client ─────────────────────────────────
//
// Fetches real-time grid carbon intensity (gCO2/kWh) for a lat/lng coordinate.
// Results are cached per zone for 15 minutes to respect rate limits.
// Returns null on any error or missing API key — callers treat null as "no data".

export interface CarbonIntensityResult {
  zone: string;
  gCO2perKWh: number;
  fossilFuelPercentage?: number;
  updatedAt: number;
}

interface CacheEntry {
  result: CarbonIntensityResult;
  fetchedAt: number;
}

// Zone-keyed cache (zone string → entry)
const zoneCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Lat/lng → zone cache to avoid redundant zone lookups
const coordToZone = new Map<string, string>();

function coordKey(lat: number, lng: number): string {
  // Round to 2 decimal places to reuse nearby coords
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

export async function fetchCarbonIntensity(
  lat: number,
  lng: number
): Promise<CarbonIntensityResult | null> {
  const apiKey = process.env.ELECTRICITY_MAPS_API_KEY;
  if (!apiKey) return null;

  const key = coordKey(lat, lng);

  // Check coord → zone mapping first
  const cachedZone = coordToZone.get(key);
  if (cachedZone) {
    const entry = zoneCache.get(cachedZone);
    if (entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS) {
      return entry.result;
    }
  }

  try {
    const url = `https://api.electricitymap.org/v3/carbon-intensity/latest?lat=${lat}&lon=${lng}`;
    const response = await fetch(url, {
      headers: { "auth-token": apiKey },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.warn(`[carbon-api] HTTP ${response.status} for lat=${lat},lng=${lng}`);
      return null;
    }

    const data = (await response.json()) as {
      zone?: string;
      carbonIntensity?: number;
      fossilFuelPercentage?: number;
      datetime?: string;
    };

    if (!data.zone || typeof data.carbonIntensity !== "number") {
      console.warn("[carbon-api] Unexpected response shape", data);
      return null;
    }

    const result: CarbonIntensityResult = {
      zone: data.zone,
      gCO2perKWh: data.carbonIntensity,
      fossilFuelPercentage: data.fossilFuelPercentage,
      updatedAt: Date.now(),
    };

    // Cache by zone
    zoneCache.set(data.zone, { result, fetchedAt: Date.now() });
    coordToZone.set(key, data.zone);

    return result;
  } catch (err) {
    console.warn("[carbon-api] Fetch failed:", (err as Error).message);
    return null;
  }
}

export type CarbonTier = "green" | "moderate" | "high";

export function getCarbonTier(gCO2perKWh: number): CarbonTier {
  if (gCO2perKWh < 100) return "green";
  if (gCO2perKWh < 300) return "moderate";
  return "high";
}
