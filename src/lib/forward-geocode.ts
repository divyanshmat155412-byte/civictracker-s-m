/**
 * Forward geocoding: text query → list of place suggestions via Nominatim.
 */
export interface PlaceSuggestion {
  display_name: string;
  short_name: string;
  lat: number;
  lng: number;
}

const cache = new Map<string, PlaceSuggestion[]>();

export async function forwardGeocode(
  query: string,
  signal?: AbortSignal,
  limit = 5,
): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const key = `${q.toLowerCase()}::${limit}`;
  if (cache.has(key)) return cache.get(key)!;

  // Bias to India for civic-tracker. Remove `countrycodes` if you want global.
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
    q,
  )}&limit=${limit}&addressdetails=1&countrycodes=in`;

  try {
    const res = await fetch(url, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{
      display_name: string;
      lat: string;
      lon: string;
      address?: Record<string, string>;
    }>;
    const out: PlaceSuggestion[] = data.map((d) => {
      const a = d.address ?? {};
      const parts = [
        a.road || a.pedestrian || a.neighbourhood || a.suburb,
        a.city || a.town || a.village || a.municipality,
        a.state,
      ].filter(Boolean) as string[];
      return {
        display_name: d.display_name,
        short_name: parts.length ? parts.join(", ") : d.display_name.split(",").slice(0, 3).join(",").trim(),
        lat: parseFloat(d.lat),
        lng: parseFloat(d.lon),
      };
    });
    cache.set(key, out);
    return out;
  } catch {
    return [];
  }
}
