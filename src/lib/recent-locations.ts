const KEY = "ct_recent_locations";
const MAX = 3;

export interface RecentLocation {
  label: string;
  lat: number;
  lng: number;
  ts: number;
}

export function getRecentLocations(): RecentLocation[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, MAX);
  } catch {
    return [];
  }
}

export function pushRecentLocation(loc: Omit<RecentLocation, "ts">) {
  if (!loc.label || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return;
  const existing = getRecentLocations();
  const dedup = existing.filter(
    (r) =>
      r.label.toLowerCase() !== loc.label.toLowerCase() &&
      !(Math.abs(r.lat - loc.lat) < 0.0005 && Math.abs(r.lng - loc.lng) < 0.0005),
  );
  const next: RecentLocation[] = [{ ...loc, ts: Date.now() }, ...dedup].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}
