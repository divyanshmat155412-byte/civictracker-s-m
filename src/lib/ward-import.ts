export type WardRow = {
  ward_number: number; name: string; zone: string;
  center_lat: number; center_lng: number; radius_m: number;
  boundary: unknown | null;
};

const num = (v: unknown) => (v === "" || v === null || v === undefined ? NaN : Number(v));

/** CSV header: ward_number,name,zone,center_lat,center_lng[,radius_m] */
export function parseWardCsv(text: string): { rows: WardRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const errors: string[] = [];
  if (!lines.length) return { rows: [], errors: ["File is empty"] };
  const head = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const idx = (k: string) => head.indexOf(k);
  for (const k of ["ward_number", "name", "zone", "center_lat", "center_lng"]) if (idx(k) < 0) errors.push(`Missing column: ${k}`);
  if (errors.length) return { rows: [], errors };
  const rows: WardRow[] = [];
  lines.slice(1).forEach((line, i) => {
    const c = line.split(",").map((x) => x.trim());
    const r: WardRow = {
      ward_number: num(c[idx("ward_number")]), name: c[idx("name")] ?? "", zone: c[idx("zone")] ?? "",
      center_lat: num(c[idx("center_lat")]), center_lng: num(c[idx("center_lng")]),
      radius_m: idx("radius_m") >= 0 && c[idx("radius_m")] ? num(c[idx("radius_m")]) : 1000, boundary: null,
    };
    const e = validate(r);
    if (e) errors.push(`Row ${i + 2}: ${e}`); else rows.push(r);
  });
  return { rows, errors };
}

/** GeoJSON FeatureCollection of Polygon/MultiPolygon; properties ward_number, name, zone. */
export function parseWardGeoJson(text: string): { rows: WardRow[]; errors: string[] } {
  let fc: { type?: string; features?: Array<{ geometry?: { type: string; coordinates: number[][][] | number[][][][] }; properties?: Record<string, unknown> }> };
  try { fc = JSON.parse(text); } catch { return { rows: [], errors: ["Not valid JSON"] }; }
  if (fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) return { rows: [], errors: ["Expected a GeoJSON FeatureCollection"] };
  const rows: WardRow[] = [], errors: string[] = [];
  fc.features.forEach((f, i) => {
    const g = f.geometry, p = f.properties ?? {};
    if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) { errors.push(`Feature ${i + 1}: geometry must be Polygon or MultiPolygon`); return; }
    const outer = (g.type === "Polygon" ? (g.coordinates as number[][][])[0] : (g.coordinates as number[][][][])[0][0]) ?? [];
    const pts = outer.slice(0, -1).length ? outer.slice(0, -1) : outer;
    const lng = pts.reduce((s, q) => s + q[0], 0) / pts.length, lat = pts.reduce((s, q) => s + q[1], 0) / pts.length;
    const r: WardRow = {
      ward_number: num(p.ward_number ?? p.ward_no ?? p.number), name: String(p.name ?? p.ward_name ?? ""), zone: String(p.zone ?? ""),
      center_lat: lat, center_lng: lng, radius_m: 1000, boundary: g,
    };
    const e = validate(r);
    if (e) errors.push(`Feature ${i + 1}: ${e}`); else rows.push(r);
  });
  return { rows, errors };
}

function validate(r: WardRow): string | null {
  if (!Number.isInteger(r.ward_number) || r.ward_number < 1) return "ward_number must be a whole number";
  if (!r.name) return "name is required";
  if (!r.zone) return "zone is required";
  if (!(r.center_lat >= -90 && r.center_lat <= 90) || !(r.center_lng >= -180 && r.center_lng <= 180)) return "invalid coordinates";
  if (!(r.radius_m > 0)) return "radius_m must be positive";
  return null;
}
