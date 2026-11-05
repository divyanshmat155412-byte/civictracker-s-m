import { describe, it, expect } from "vitest";
import { parseWardCsv, parseWardGeoJson } from "@/lib/ward-import";

describe("ward import", () => {
  it("parses CSV rows with default 1000 m radius", () => {
    const { rows, errors } = parseWardCsv("ward_number,name,zone,center_lat,center_lng\n1,Old Town,Zone A,23.3,75.0");
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ ward_number: 1, name: "Old Town", zone: "Zone A", radius_m: 1000 });
  });
  it("rejects CSV rows with bad coordinates", () => {
    const { rows, errors } = parseWardCsv("ward_number,name,zone,center_lat,center_lng\n2,X,Z,200,75");
    expect(rows).toHaveLength(0);
    expect(errors[0]).toContain("Row 2");
  });
  it("keeps GeoJSON polygon and computes its centre", () => {
    const g = { type: "FeatureCollection", features: [{ properties: { ward_number: 3, name: "N", zone: "Z" },
      geometry: { type: "Polygon", coordinates: [[[75, 23], [75.02, 23], [75.02, 23.02], [75, 23.02], [75, 23]]] } }] };
    const { rows } = parseWardGeoJson(JSON.stringify(g));
    expect(rows[0].center_lat).toBeCloseTo(23.01);
    expect(rows[0].center_lng).toBeCloseTo(75.01);
    expect(rows[0].boundary).not.toBeNull();
  });
});
