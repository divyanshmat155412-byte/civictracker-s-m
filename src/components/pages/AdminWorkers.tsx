import { invokeFunction } from "@/lib/invoke-function";
import { useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Truck, Plus, Trash2, Play, ArrowLeft } from "lucide-react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

const AdminWorkers = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading } = useUserRole();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [deptId, setDeptId] = useState("");
  const [assignWorker, setAssignWorker] = useState("");
  const [assignComplaint, setAssignComplaint] = useState("");

  const { data: workers = [] } = useQuery({
    queryKey: ["workers-admin"],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from("workers").select("id,name,department_id,is_active,created_at, departments(name)")).data || [],
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments-admin"],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from("departments").select("id,name,description,head_name,contact_email,created_at")).data || [],
  });

  const { data: activeComplaints = [] } = useQuery({
    queryKey: ["active-complaints-admin"],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from("complaints").select("id, complaint_id, title, location, status, latitude, longitude").in("status", ["pending", "in-progress"]).order("created_at", { ascending: false })).data || [],
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["assignments-admin"],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from("worker_assignments").select("*, workers(name), complaints(complaint_id, title)").neq("status", "completed").order("assigned_at", { ascending: false })).data || [],
  });

  if (isLoading) return <Layout><div className="container py-12 text-center text-muted-foreground">Loading...</div></Layout>;
  if (!isAdmin) return <Layout><div className="container py-12 text-center"><p className="text-destructive font-semibold">Admin access required.</p></div></Layout>;

  const addWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await supabase.from("workers").insert({
      name: name.trim(), phone: phone.trim() || null, department_id: deptId || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Worker added");
      setName(""); setPhone(""); setDeptId("");
      queryClient.invalidateQueries({ queryKey: ["workers-admin"] });
    }
  };

  const deleteWorker = async (id: string) => {
    if (!confirm("Delete this worker?")) return;
    await supabase.from("workers").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["workers-admin"] });
  };

  const assign = async () => {
    if (!assignWorker || !assignComplaint) {
      toast.error("Pick worker and complaint");
      return;
    }
    const { error } = await supabase.from("worker_assignments").insert({
      worker_id: assignWorker, complaint_id: assignComplaint, status: "en_route",
    });
    if (error) { toast.error(error.message); return; }
    await supabase.from("complaints").update({ status: "in-progress" }).eq("id", assignComplaint);
    toast.success("Worker assigned & complaint marked in progress 🚚");
    setAssignWorker(""); setAssignComplaint("");
    queryClient.invalidateQueries({ queryKey: ["assignments-admin"] });
    queryClient.invalidateQueries({ queryKey: ["active-complaints-admin"] });
  };

  const simulate = async (workerId: string, complaintId: string) => {
    const { error, data } = await invokeFunction("simulate-worker-movement", {
      body: { worker_id: workerId, complaint_id: complaintId },
    });
    if (error) toast.error(error.message);
    else toast.success(`Worker moved! ${data?.distance_m ?? "?"}m away`);
  };

  const completeAssignment = async (assignmentId: string, complaintId: string) => {
    await supabase.from("worker_assignments").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", assignmentId);
    await supabase.from("complaints").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", complaintId);
    toast.success("Marked complete ✅");
    queryClient.invalidateQueries({ queryKey: ["assignments-admin"] });
  };

  return (
    <Layout>
      <div className="container py-8 max-w-4xl">
        <button onClick={() => navigate("/admin")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </button>

        <h1 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
          <Truck className="w-6 h-6 text-primary" /> Workers & Live Tracking
        </h1>

        <div className="grid md:grid-cols-2 gap-5">
          {/* Add worker */}
          <form onSubmit={addWorker} className="bg-card rounded-xl border border-border p-5 shadow-card">
            <h2 className="font-semibold mb-3">Add Worker</h2>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Worker name *" required className="w-full mb-2 px-3 py-2 rounded-lg border border-input bg-background text-sm" />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone (optional)" className="w-full mb-2 px-3 py-2 rounded-lg border border-input bg-background text-sm" />
            <select value={deptId} onChange={e => setDeptId(e.target.value)} className="w-full mb-3 px-3 py-2 rounded-lg border border-input bg-background text-sm">
              <option value="">No department</option>
              {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button type="submit" className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-1">
              <Plus className="w-4 h-4" /> Add
            </button>
          </form>

          {/* Assign */}
          <div className="bg-card rounded-xl border border-border p-5 shadow-card">
            <h2 className="font-semibold mb-3">Assign Worker</h2>
            <select value={assignWorker} onChange={e => setAssignWorker(e.target.value)} className="w-full mb-2 px-3 py-2 rounded-lg border border-input bg-background text-sm">
              <option value="">Select worker</option>
              {workers.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select value={assignComplaint} onChange={e => setAssignComplaint(e.target.value)} className="w-full mb-3 px-3 py-2 rounded-lg border border-input bg-background text-sm">
              <option value="">Select complaint</option>
              {activeComplaints.filter((c: any) => c.latitude && c.longitude).map((c: any) => (
                <option key={c.id} value={c.id}>#{c.complaint_id} — {c.title.slice(0, 30)}</option>
              ))}
            </select>
            <button onClick={assign} className="w-full py-2 rounded-lg bg-accent text-accent-foreground text-sm font-semibold">
              Assign & Start Tracking
            </button>
            <p className="text-[10px] text-muted-foreground mt-2">Only complaints with GPS shown.</p>
          </div>
        </div>

        {/* Workers list */}
        <h2 className="font-semibold mt-8 mb-3">Workers ({workers.length})</h2>
        <div className="space-y-2">
          {workers.map((w: any) => (
            <div key={w.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground text-sm">{w.name}</p>
                <p className="text-xs text-muted-foreground">{w.phone || "—"} • {w.departments?.name || "Unassigned"}</p>
                <form className="mt-2 flex gap-1" onSubmit={async (e) => {
                  e.preventDefault();
                  const email = String(new FormData(e.currentTarget).get("email") || "");
                  const { error } = await supabase.rpc("admin_link_worker_account", { _worker_id: w.id, _email: email });
                  if (error) toast.error(error.message); else toast.success("Login linked — the worker now sees jobs at /worker");
                }}>
                  <input name="email" type="email" required placeholder="Worker login email" className="px-2 py-1 rounded border border-input bg-background text-xs" />
                  <button className="px-2 py-1 rounded bg-primary text-primary-foreground text-xs">Link login</button>
                </form>
              </div>
              <button onClick={() => deleteWorker(w.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Active assignments */}
        <h2 className="font-semibold mt-8 mb-3">Active Assignments ({assignments.length})</h2>
        <div className="space-y-2">
          {assignments.map((a: any) => (
            <div key={a.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground text-sm truncate">
                  <Truck className="w-3.5 h-3.5 inline mr-1" />{a.workers?.name} → #{a.complaints?.complaint_id} {a.complaints?.title}
                </p>
                <p className="text-xs text-muted-foreground capitalize">Status: {a.status.replace("_", " ")}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => simulate(a.worker_id, a.complaint_id)} className="px-3 py-1.5 rounded bg-primary/10 text-primary text-xs font-semibold flex items-center gap-1 hover:bg-primary/20">
                  <Play className="w-3 h-3" /> Move
                </button>
                <button onClick={() => completeAssignment(a.id, a.complaint_id)} className="px-3 py-1.5 rounded bg-accent/10 text-accent text-xs font-semibold hover:bg-accent/20">
                  ✓ Complete
                </button>
              </div>
            </div>
          ))}
          {assignments.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No active assignments. Assign a worker above to start.</p>}
        </div>

        <div className="mt-8 p-4 rounded-lg bg-primary/5 border border-primary/20 text-xs text-foreground">
          <p className="font-semibold mb-1">💡 How simulated tracking works:</p>
          <p className="text-muted-foreground">Click <strong>"Move"</strong> to advance the worker 20% closer to the complaint. Citizens see live updates on the complaint card. In production, replace this with a real worker GPS app.</p>
        </div>
      </div>
    </Layout>
  );
};

export default AdminWorkers;
