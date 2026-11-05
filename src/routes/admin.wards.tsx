import { useUiText } from "@/hooks/useUiText";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useCities } from "@/hooks/useCities";
import { WardImport, CityRouting, NeedsChecking } from "@/components/WardConfigTools";

export const Route = createFileRoute("/admin/wards")({
  head: () => ({
    meta: [
      { title: "Wards & Zones — Civic Tracker Admin" },
      { name: "description", content: "Configure municipal wards and zones per city." },
      { property: "og:title", content: "Wards & Zones — Civic Tracker Admin" },
      { property: "og:description", content: "Configure municipal wards and zones per city." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WardsPage,
});

function WardsPage() {
  const tx = useUiText();
  const { cities: CITIES } = useCities();
  const { isModerator } = useUserRole();
  const qc = useQueryClient();
  const [city, setCity] = useState("Ratlam");
  const [form, setForm] = useState({ ward_number: "", name: "", zone: "", center_lat: "", center_lng: "" });

  const { data: wards = [] } = useQuery({
    queryKey: ["wards", city],
    queryFn: async () => {
      const { data } = await supabase.from("wards").select("*").eq("city", city).order("ward_number");
      return data ?? [];
    },
  });
  const { data: counts = {} } = useQuery({
    queryKey: ["ward-counts", city],
    queryFn: async () => {
      const { data } = await supabase.from("complaints").select("ward_id, status").eq("city", city).not("ward_id", "is", null);
      const m: Record<string, { total: number; open: number }> = {};
      (data ?? []).forEach((c) => {
        const k = c.ward_id as string;
        m[k] ??= { total: 0, open: 0 };
        m[k].total++;
        if (c.status !== "resolved") m[k].open++;
      });
      return m;
    },
  });

  const add = async () => {
    const { error } = await supabase.from("wards").insert({
      city, ward_number: Number(form.ward_number), name: form.name, zone: form.zone,
      center_lat: Number(form.center_lat), center_lng: Number(form.center_lng),
    });
    if (error) return toast.error(error.message);
    toast.success(tx("Ward added"));
    setForm({ ward_number: "", name: "", zone: "", center_lat: "", center_lng: "" });
    qc.invalidateQueries({ queryKey: ["wards"] });
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("wards").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["wards"] });
  };

  return (
    <Layout>
      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold text-foreground">{tx("Wards & Zones")}</h1>
          <select value={city} onChange={(e) => setCity(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-foreground" aria-label={tx("City")}>
            {CITIES.map((c) => <option key={c}>{tx(c)}</option>)}
          </select>
        </div>
        <p className="text-sm text-muted-foreground">{tx("New complaints are placed in a ward automatically from GPS: inside a ward boundary when one is uploaded, otherwise the nearest ward centre within its radius. Anything outside is flagged for checking.")}</p>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr><th className="p-3">#</th><th className="p-3">{tx("Ward")}</th><th className="p-3">{tx("Zone")}</th><th className="p-3">{tx("Complaints")}</th><th className="p-3">{tx("Open")}</th>{isModerator && <th />}</tr>
            </thead>
            <tbody>
              {wards.map((w) => (
                <tr key={w.id} className="border-t border-border text-foreground">
                  <td className="p-3">{w.ward_number}</td><td className="p-3">{tx(w.name)}{w.is_demo && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{tx("demo")}</span>}{w.boundary ? <span className="ml-1 text-[10px] text-muted-foreground">{tx("boundary")}</span> : null}</td><td className="p-3">{tx(w.zone)}</td>
                  <td className="p-3">{counts[w.id]?.total ?? 0}</td><td className="p-3">{counts[w.id]?.open ?? 0}</td>
                  {isModerator && <td className="p-3 text-right"><button onClick={() => remove(w.id)} className="text-destructive">{tx("Remove")}</button></td>}
                </tr>
              ))}
              {wards.length === 0 && <tr><td colSpan={6} className="p-4 text-muted-foreground">{tx("No wards configured for ")}{city} {tx(" yet.")}</td></tr>}
            </tbody>
          </table>
        </div>
        {isModerator && (
          <div className="grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-6">
            {(["ward_number", "name", "zone", "center_lat", "center_lng"] as const).map((k) => (
              <input key={k} placeholder={k.replace("_", " ")} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                className="rounded-lg border border-input bg-background px-3 py-2 text-foreground" />
            ))}
            <button onClick={add} className="rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground">{tx("Add ward")}</button>
          </div>
        )}
        {isModerator && <NeedsChecking city={city} />}
        {isModerator && <WardImport city={city} />}
        {isModerator && <CityRouting city={city} />}
      </div>
    </Layout>
  );
}
