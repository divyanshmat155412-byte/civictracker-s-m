import { useUiText } from "@/hooks/useUiText";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_CONFIG } from "@/lib/types";
import { parseWardCsv, parseWardGeoJson } from "@/lib/ward-import";

export function WardImport({ city }: { city: string }) {
  const tx = useUiText();
  const qc = useQueryClient();
  const [demo, setDemo] = useState(false);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const onFile = async (file: File) => {
    const text = await file.text();
    const isGeo = /\.(geo)?json$/i.test(file.name) || text.trim().startsWith("{");
    const { rows, errors } = isGeo ? parseWardGeoJson(text) : parseWardCsv(text);
    if (errors.length) toast.error(errors.slice(0, 3).join(" · "));
    if (!rows.length) return;
    setBusy(true);
    const { error } = await supabase.from("wards").upsert(
      rows.map((r) => ({ ...r, city, is_demo: demo, source: source || (demo ? "Demonstration data" : file.name) })) as never,
      { onConflict: "city,ward_number" },
    );
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} ${tx("wards imported for")} ${tx(city)}`);
    qc.invalidateQueries({ queryKey: ["wards"] });
  };
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
      <h2 className="font-semibold text-foreground">{tx("Bulk import wards")}</h2>
      <p className="text-muted-foreground">{tx("CSV columns: ")}<code>ward_number,name,zone,center_lat,center_lng,radius_m</code>{tx(". Or a GeoJSON file of ward boundaries with ")}<code>ward_number</code>, <code>name</code>, <code>zone</code> {tx(" properties. Existing ward numbers are updated.")}</p>
      <input value={source} onChange={(e) => setSource(e.target.value)} placeholder={tx("Data source (e.g. Nagar Nigam ward map 2024)")} className="w-full rounded-lg border border-input bg-background px-3 py-2" />
      <label className="flex items-center gap-2"><input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} /> {tx(" This is demonstration data, not official boundaries")}</label>
      <input type="file" accept=".csv,.json,.geojson" disabled={busy} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    </div>
  );
}

export function CityRouting({ city }: { city: string }) {
  const tx = useUiText();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["city-routing", city],
    queryFn: async () => {
      const [r, d] = await Promise.all([
        supabase.from("city_category_routing").select("id,category,department_id,deadline_hours").eq("city", city),
        supabase.from("departments").select("id,name,city").or(`city.is.null,city.eq.${city}`).order("name"),
      ]);
      return { rules: r.data ?? [], depts: d.data ?? [] };
    },
  });
  const save = async (category: string, department_id: string, deadline_hours: string) => {
    const existing = data?.rules.find((r) => r.category === category);
    if (!department_id) {
      if (existing) await supabase.from("city_category_routing").delete().eq("id", existing.id);
    } else {
      const row = { city, category, department_id, deadline_hours: deadline_hours ? Number(deadline_hours) : null };
      const { error } = existing
        ? await supabase.from("city_category_routing").update(row).eq("id", existing.id)
        : await supabase.from("city_category_routing").insert(row);
      if (error) return toast.error(error.message);
    }
    toast.success(tx("Routing saved"));
    qc.invalidateQueries({ queryKey: ["city-routing", city] });
  };
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-sm">
      <h2 className="font-semibold text-foreground">{tx("Category → department for ")}{city}</h2>
      <p className="mb-3 text-muted-foreground">{tx("Unmapped categories use the shared platform department and are flagged for checking.")}</p>
      <div className="space-y-2">
        {Object.entries(CATEGORY_CONFIG).map(([cat, cfg]) => {
          const rule = data?.rules.find((r) => r.category === cat);
          return (
            <RoutingRow key={cat + (rule?.id ?? "")} label={(cfg as { label: string }).label} depts={data?.depts ?? []}
              dept={rule?.department_id ?? ""} hours={rule?.deadline_hours?.toString() ?? ""}
              onSave={(d, h) => save(cat, d, h)} />
          );
        })}
      </div>
    </div>
  );
}

function RoutingRow({ label, depts, dept, hours, onSave }: { label: string; depts: { id: string; name: string; city: string | null }[]; dept: string; hours: string; onSave: (d: string, h: string) => void }) {
  const tx = useUiText();
  const [d, setD] = useState(dept), [h, setH] = useState(hours);
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.5fr_6rem_auto] sm:items-center">
      <span className="text-foreground">{tx(label)}</span>
      <select value={d} onChange={(e) => setD(e.target.value)} className="rounded-lg border border-input bg-background px-2 py-1.5">
        <option value="">{tx("Shared default")}</option>
        {depts.map((x) => <option key={x.id} value={x.id}>{tx(x.name)}{x.city ? "" : tx(" (shared)")}</option>)}
      </select>
      <input value={h} onChange={(e) => setH(e.target.value)} placeholder={tx("hours")} inputMode="numeric" className="rounded-lg border border-input bg-background px-2 py-1.5" />
      <button onClick={() => onSave(d, h)} className="rounded-lg border border-border px-3 py-1.5">{tx("Save")}</button>
    </div>
  );
}

export function NeedsChecking({ city }: { city: string }) {
  const tx = useUiText();
  const { data = [] } = useQuery({
    queryKey: ["needs-checking", city],
    queryFn: async () => (await supabase.from("complaints").select("id,complaint_id,title,location_status,routing_status")
      .eq("city", city).or("location_status.eq.needs_verification,routing_status.in.(manual_needed,shared_fallback)")
      .neq("status", "resolved").order("created_at", { ascending: false }).limit(50)).data ?? [],
  });
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-sm">
      <h2 className="font-semibold text-foreground">{tx("Complaints needing a ward or department check (")}{data.length})</h2>
      {data.length === 0 ? <p className="text-muted-foreground">{tx("None right now.")}</p> : (
        <ul className="mt-2 space-y-1">
          {data.map((c) => (
            <li key={c.id}>
              <Link to="/complaints/$id" params={{ id: c.complaint_id }} className="text-primary">{c.complaint_id}</Link>{" "}
              <span className="text-foreground">{c.title}</span>{" "}
              <span className="text-muted-foreground">— {c.location_status === "needs_verification" ? tx("ward unknown") : ""}{c.routing_status !== "city" && c.routing_status !== "corrected" ? tx(" department not city-mapped") : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
