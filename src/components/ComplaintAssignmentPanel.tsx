import { useUiText } from "@/hooks/useUiText";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type C = { id: string; city: string; ward_id: string | null; zone: string | null; department_id: string | null; location_status?: string | null; routing_status?: string | null };

const LOC_LABEL: Record<string, string> = {
  boundary: "Ward found from GPS (inside ward boundary)",
  nearest_centre: "Ward estimated from nearest ward centre",
  needs_verification: "Location needs verification — no ward matched",
  corrected: "Ward corrected by city admin",
};
const ROUTE_LABEL: Record<string, string> = {
  city: "Routed to this city's department",
  shared_fallback: "Sent to a shared department — city mapping missing",
  manual_needed: "Needs manual routing",
  corrected: "Department corrected by city admin",
};

/** City / ward / zone / department, plus correction tools for that city's admin. */
export default function ComplaintAssignmentPanel({ complaint }: { complaint: C }) {
  const tx = useUiText();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: ward } = useQuery({
    queryKey: ["ward", complaint.ward_id],
    enabled: !!complaint.ward_id,
    queryFn: async () => (await supabase.from("wards").select("ward_number,name,zone,is_demo").eq("id", complaint.ward_id!).single()).data,
  });
  const { data: canFix = false } = useQuery({
    queryKey: ["can-fix", user?.id, complaint.city],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: root }, { data: roles }] = await Promise.all([
        supabase.rpc("is_main_admin"),
        supabase.from("user_roles").select("role,city").eq("user_id", user!.id).eq("role", "admin"),
      ]);
      return !!root || (roles ?? []).some((r) => !r.city || r.city.toLowerCase() === complaint.city.toLowerCase());
    },
  });
  const [open, setOpen] = useState(false);
  const [wardId, setWardId] = useState("");
  const [deptId, setDeptId] = useState("");
  const [note, setNote] = useState("");
  const { data: options } = useQuery({
    queryKey: ["fix-options", complaint.city],
    enabled: open,
    queryFn: async () => {
      const [w, d] = await Promise.all([
        supabase.from("wards").select("id,ward_number,name,zone").eq("city", complaint.city).order("ward_number"),
        supabase.from("departments").select("id,name,city").or(`city.is.null,city.eq.${complaint.city}`).order("name"),
      ]);
      return { wards: w.data ?? [], depts: d.data ?? [] };
    },
  });

  const save = async () => {
    const { error } = await supabase.rpc("admin_correct_complaint", {
      _complaint_id: complaint.id, _ward_id: wardId || null, _department_id: deptId || null, _note: note || null,
    } as never);
    if (error) return toast.error(error.message);
    toast.success(tx("Assignment corrected and logged"));
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["complaint-detail"] });
    qc.invalidateQueries({ queryKey: ["ward"] });
  };

  const flagged = complaint.location_status === "needs_verification" || complaint.routing_status === "manual_needed" || complaint.routing_status === "shared_fallback";
  return (
    <div className={`mt-4 rounded-xl border p-4 text-sm ${flagged ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}>
      <div className="grid gap-1 sm:grid-cols-2">
        <p><span className="text-muted-foreground">{tx("City:")}</span> {complaint.city}</p>
        <p><span className="text-muted-foreground">{tx("Ward:")}</span> {ward ? `${ward.ward_number} · ${ward.name}` : tx("Not assigned")}{ward?.is_demo ? tx(" (demo data)") : ""}</p>
        <p><span className="text-muted-foreground">{tx("Zone:")}</span> {complaint.zone || "—"}</p>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{LOC_LABEL[complaint.location_status ?? ""] ?? ""}</p>
      <p className="text-xs text-muted-foreground">{ROUTE_LABEL[complaint.routing_status ?? ""] ?? ""}</p>
      {canFix && (
        <div className="mt-3">
          {!open ? (
            <button onClick={() => setOpen(true)} className="text-xs font-semibold text-primary">{tx("Correct ward / department")}</button>
          ) : (
            <div className="space-y-2">
              <select value={wardId} onChange={(e) => setWardId(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2">
                <option value="">{tx("Keep ward")}</option>
                {options?.wards.map((w) => <option key={w.id} value={w.id}>{w.ward_number} · {w.name} ({w.zone})</option>)}
              </select>
              <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2">
                <option value="">{tx("Keep department")}</option>
                {options?.depts.map((d) => <option key={d.id} value={d.id}>{d.name}{d.city ? "" : tx(" (shared)")}</option>)}
              </select>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tx("Reason (saved in activity log)")} className="w-full rounded-lg border border-input bg-background px-3 py-2" />
              <div className="flex gap-2">
                <button onClick={save} disabled={!wardId && !deptId} className="rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50">{tx("Save correction")}</button>
                <button onClick={() => setOpen(false)} className="rounded-lg border border-border px-3 py-2">{tx("Cancel")}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
