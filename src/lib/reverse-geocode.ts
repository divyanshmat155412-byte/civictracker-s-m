import { CITIES, type City } from "./cities";

const CITY_LOWER: Record<string, City> = CITIES.reduce((acc, c) => {
  acc[c.toLowerCase()] = c;
  return acc;
}, {} as Record<string, City>);

// Common aliases returned by Nominatim that should map to a supported city
const ALIASES: Record<string, City> = {
  bengaluru: "Bangalore",
  bombay: "Mumbai",
  calcutta: "Kolkata",
  madras: "Chennai",
  "new delhi": "Delhi",
};

export interface ReverseGeocodeResult {
  city: City | null;
  /** Short human-readable street/area address (without city/state/country). */
  address: string | null;
}

const cache = new Map<string, ReverseGeocodeResult>();

function pickCity(...candidates: (string | undefined | null)[]): City | null {
  for (const raw of candidates) {
    if (!raw) continue;
    const key = raw.trim().toLowerCase();
    if (CITY_LOWER[key]) return CITY_LOWER[key];
    if (ALIASES[key]) return ALIASES[key];
  }
  return null;
}

function buildAddress(a: Record<string, string | undefined>, displayName?: string): string | null {
  // Build a richer address: street/area + locality + city + state.
  const parts = [
    a.house_number,
    a.road || a.pedestrian || a.footway || a.path,
    a.neighbourhood || a.suburb || a.quarter || a.residential,
    a.city_district || a.town || a.village,
    a.city || a.municipality,
    a.state_district || a.county,
    a.state,
  ]
    .filter((p): p is string => Boolean(p && p.trim()))
    // De-duplicate while preserving order
    .filter((p, i, arr) => arr.findIndex((x) => x.toLowerCase() === p.toLowerCase()) === i);

  const postcode = a.postcode?.trim();

  if (parts.length === 0) {
    // Fallback to Nominatim's display_name minus the country suffix
    if (displayName) {
      const trimmed = displayName.split(",").slice(0, 5).map((s) => s.trim()).join(", ");
      const base = trimmed || null;
      if (!base) return null;
      return postcode && !base.includes(postcode) ? `${base} - ${postcode}` : base;
    }
    return null;
  }
  const base = parts.slice(0, 6).join(", ");
  return postcode ? `${base} - ${postcode}` : base;
}


/**
 * Reverse-geocode lat/lng to a supported city + a short street/area address
 * using OpenStreetMap Nominatim.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<ReverseGeocodeResult> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (cache.has(key)) return cache.get(key)!;

  // zoom=18 returns street-level detail while still including admin fields.
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
  try {
    const res = await fetch(url, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { city: null, address: null };
    const data = await res.json();
    const a = data?.address ?? {};
    const result: ReverseGeocodeResult = {
      city: pickCity(
        a.city,
        a.town,
        a.municipality,
        a.city_district,
        a.county,
        a.state_district,
        a.state,
      ),
      address: buildAddress(a, data?.display_name),
    };
    cache.set(key, result);
    return result;
  } catch {
    return { city: null, address: null };
  }
}


/** Backwards-compatible helper that only returns the matched city. */
export async function reverseGeocodeCity(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<City | null> {
  const r = await reverseGeocode(lat, lng, signal);
  return r.city;
}
