import { useUiText } from "@/hooks/useUiText";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPinned } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCities } from "@/hooks/useCities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Super Admin: onboard a new city with its profile, then link to wards/departments/admins. */
const CityOnboarding = () => {
  const tx = useUiText();
  const qc = useQueryClient();
  const { profiles } = useCities();
  const [f, setF] = useState({ name: "", state: "", municipal_body: "", center_lat: "", center_lng: "", contact_email: "" });
  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("cities").insert({
      name: f.name, state: f.state || null, municipal_body: f.municipal_body || null,
      center_lat: f.center_lat ? Number(f.center_lat) : null, center_lng: f.center_lng ? Number(f.center_lng) : null,
      contact_email: f.contact_email || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message.includes("duplicate") ? "That city already exists" : error.message);
    toast.success(`${f.name} onboarded — now add wards, departments and a City Admin`);
    setF({ name: "", state: "", municipal_body: "", center_lat: "", center_lng: "", contact_email: "" });
    qc.invalidateQueries({ queryKey: ["cities"] });
  };
  const toggle = async (id: string, is_active: boolean) => {
    const { error } = await supabase.from("cities").update({ is_active }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["cities"] });
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPinned className="h-5 w-5" /> {tx(" Onboard a new city")}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={add} className="grid sm:grid-cols-3 gap-2">
          <Input required placeholder={tx("City name")} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <Input placeholder={tx("State")} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} />
          <Input placeholder={tx("Municipal body (e.g. Nagar Nigam)")} value={f.municipal_body} onChange={(e) => setF({ ...f, municipal_body: e.target.value })} />
          <Input placeholder={tx("Centre latitude")} inputMode="decimal" value={f.center_lat} onChange={(e) => setF({ ...f, center_lat: e.target.value })} />
          <Input placeholder={tx("Centre longitude")} inputMode="decimal" value={f.center_lng} onChange={(e) => setF({ ...f, center_lng: e.target.value })} />
          <Input placeholder={tx("Office contact email")} type="email" value={f.contact_email} onChange={(e) => setF({ ...f, contact_email: e.target.value })} />
          <Button type="submit" disabled={busy || !f.name.trim()} className="sm:col-span-3">{tx("Add city")}</Button>
        </form>
        <p className="text-xs text-muted-foreground">
          {tx(" Next steps: add its wards & zones (Admin → Wards & Zones), city departments (Departments page), then approve or grant a City Admin for it (Users & Roles). ")}</p>
        <div className="space-y-1 text-sm">
          {profiles.map((c) => (
            <div key={c.id} className="flex items-center justify-between border-b border-border py-1 gap-2">
              <span><b>{c.name}</b>{c.state ? `, ${c.state}` : ""} <span className="text-muted-foreground">{c.municipal_body ?? ""}</span></span>
              <Button size="sm" variant="ghost" onClick={() => toggle(c.id, !c.is_active)}>{c.is_active ? tx("Deactivate") : tx("Activate")}</Button>
            </div>
          ))}
          {profiles.length === 0 && <p className="text-muted-foreground">{tx("No onboarded cities yet — the 15 built-in cities remain available.")}</p>}
        </div>
      </CardContent>
    </Card>
  );
};
export default CityOnboarding;
