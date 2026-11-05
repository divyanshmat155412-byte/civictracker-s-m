import { useUiText } from "@/hooks/useUiText";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Crown, Shield } from "lucide-react";
import Layout from "@/components/Layout";
import AdminRequestsManager from "@/components/AdminRequestsManager";
import CityOnboarding from "@/components/CityOnboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsRootAdmin } from "@/hooks/useIsRootAdmin";
import { SUPER_ADMIN_LABEL } from "@/lib/main-admin";

type Overview = Record<string, any>;

const Stat = ({ label, value }: { label: string; value: any }) => (
  <Card><CardContent className="p-4">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-2xl font-bold text-foreground">{value ?? "—"}</div>
  </CardContent></Card>
);

const SuperAdminDashboard = () => {
  const tx = useUiText();
  const { user } = useAuth();
  const { isMainAdmin, isLoading } = useIsRootAdmin();
  const [actionFilter, setActionFilter] = useState("");

  const { data: ov } = useQuery({
    queryKey: ["root-overview"],
    enabled: isMainAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("root_platform_overview" as any);
      if (error) throw error;
      return data as Overview;
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["root-audit", actionFilter],
    enabled: isMainAdmin,
    queryFn: async () => {
      let q = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
      if (actionFilter) q = q.ilike("action", `%${actionFilter}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!user || isLoading) return <Layout><div className="container mx-auto p-12 text-center text-muted-foreground">{tx("Loading…")}</div></Layout>;
  if (!isMainAdmin) {
    return (
      <Layout><div className="container mx-auto px-4 py-12 text-center">
        <Shield className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{tx("Restricted")}</h1>
        <p className="text-muted-foreground">{tx("Only the ")}{tx(SUPER_ADMIN_LABEL)} {tx(" can open this page.")}</p>
      </div></Layout>
    );
  }

  const short = (id: string) => (id?.startsWith("00000000") ? "system" : `User ${id?.slice(0, 8)}`);

  return (
    <Layout>
      <div className="container mx-auto max-w-6xl px-4 py-8 space-y-8">
        <div className="flex items-center gap-3">
          <Crown className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{tx(SUPER_ADMIN_LABEL)}</h1>
            <p className="text-sm text-muted-foreground">{tx("Platform-wide overview, applications and activity across every city.")}</p>
          </div>
        </div>

        <section>
          <h2 className="font-semibold mb-3">{tx("Platform overview")}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Cities" value={ov?.cities} />
            <Stat label="Wards" value={ov?.wards} />
            <Stat label="Zones" value={ov?.zones} />
            <Stat label="Citizens" value={ov?.citizens} />
            <Stat label="City Admins" value={ov?.city_admins} />
            <Stat label="Officers" value={ov?.officers} />
            <Stat label="Field workers" value={ov?.field_workers} />
            <Stat label="Pending applications" value={ov?.pending_applications} />
            <Stat label="Total complaints" value={ov?.complaints} />
            <Stat label="Resolved" value={ov?.resolved} />
            <Stat label="Pending" value={ov?.pending} />
            <Stat label="Overdue" value={ov?.overdue} />
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <Card><CardHeader><CardTitle className="text-base">{tx("City-wise performance")}</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              {(ov?.by_city ?? []).map((c: any) => (
                <div key={c.city} className="flex justify-between border-b border-border py-1">
                  <span className="font-medium">{c.city}</span>
                  <span className="text-muted-foreground">{c.resolved}/{c.total} {tx(" resolved · ")}{c.overdue} {tx(" overdue · ")}{c.avg_hours ?? "—"}{tx("h avg")}</span>
                </div>
              ))}
              {(ov?.by_city ?? []).length === 0 && <p className="text-muted-foreground">{tx("No complaints yet.")}</p>}
            </CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">{tx("Department performance")}</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              {(ov?.by_department ?? []).map((d: any) => (
                <div key={d.department} className="flex justify-between border-b border-border py-1">
                  <span className="font-medium">{d.department}</span>
                  <span className="text-muted-foreground">{d.resolved}/{d.total} {tx(" resolved · ")}{d.overdue} {tx(" overdue")}</span>
                </div>
              ))}
            </CardContent></Card>
          <Card className="md:col-span-2"><CardHeader><CardTitle className="text-base">{tx("Admin activity (actions recorded)")}</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              {(ov?.by_admin ?? []).map((a: any) => (
                <div key={a.user_id} className="flex justify-between border-b border-border py-1">
                  <span>{short(a.user_id)}</span>
                  <span className="text-muted-foreground">{a.actions} {tx(" actions · last ")}{new Date(a.last_action).toLocaleString()}</span>
                </div>
              ))}
              {(ov?.by_admin ?? []).length === 0 && <p className="text-muted-foreground">{tx("No City Admin activity yet.")}</p>}
            </CardContent></Card>
        </section>

        <CityOnboarding />

        <AdminRequestsManager />

        <section>
          <div className="flex items-center justify-between mb-3 gap-2">
            <h2 className="font-semibold">{tx("Audit log (protected, read-only)")}</h2>
            <input value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} placeholder={tx("Filter action…")}
              className="rounded-lg border border-input bg-card px-3 py-2 text-sm" />
          </div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr>
                <th className="p-2">{tx("When")}</th><th className="p-2">{tx("Actor")}</th><th className="p-2">{tx("Action")}</th><th className="p-2">{tx("Target")}</th><th className="p-2">{tx("City")}</th><th className="p-2">{tx("Details")}</th>
              </tr></thead>
              <tbody>
                {logs.map((l: any) => (
                  <tr key={l.id} className="border-t border-border align-top">
                    <td className="p-2 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="p-2 whitespace-nowrap">{short(l.user_id)}</td>
                    <td className="p-2">{l.action}</td>
                    <td className="p-2">{l.target_type} {l.target_id?.slice(0, 12)}</td>
                    <td className="p-2">{l.city ?? "—"}</td>
                    <td className="p-2 text-xs text-muted-foreground max-w-xs break-all">{l.details ? JSON.stringify(l.details) : ""}</td>
                  </tr>
                ))}
                {logs.length === 0 && <tr><td className="p-4 text-center text-muted-foreground" colSpan={6}>{tx("No activity yet.")}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default SuperAdminDashboard;
