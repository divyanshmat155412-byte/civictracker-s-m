import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Navigation, Camera, CheckCircle2, Clock } from "lucide-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { photoUrlFor } from "@/lib/photo-url";

export const Route = createFileRoute("/worker")({
  head: () => ({
    meta: [
      { title: "Field Worker Jobs — Civic Tracker" },
      { name: "description", content: "Assigned civic repair jobs with exact location, photos and deadlines." },
      { property: "og:title", content: "Field Worker Jobs — Civic Tracker" },
      { property: "og:description", content: "Assigned civic repair jobs with exact location, photos and deadlines." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkerPage,
});

type Job = {
  assignment_id: string; assignment_status: string; complaint: string; complaint_code: string;
  title: string; description: string; category: string; priority: string; location: string;
  latitude: number | null; longitude: number | null; photo_url: string | null;
  after_photo_url: string | null; due_at: string | null; status: string;
};

function WorkerPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["worker-jobs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_worker_jobs");
      if (error) throw error;
      return (data ?? []) as Job[];
    },
  });

  if (!user) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 text-center">
          <Link to="/auth" className="text-primary underline">Sign in</Link> to see your assigned jobs.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
        <h1 className="text-3xl font-bold text-foreground">My assigned jobs</h1>
        {isLoading ? <p className="text-muted-foreground">Loading…</p> : jobs.length === 0 ? (
          <p className="text-muted-foreground">No jobs assigned to your account yet. Ask your officer to link your email in Workers.</p>
        ) : jobs.map((j) => <JobCard key={j.assignment_id} job={j} onDone={() => qc.invalidateQueries({ queryKey: ["worker-jobs"] })} userId={user.id} />)}
      </div>
    </Layout>
  );
}

function JobCard({ job, onDone, userId }: { job: Job; onDone: () => void; userId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const done = job.assignment_status === "completed";
  const overdue = !done && job.due_at && new Date(job.due_at) < new Date();

  const update = async (status: "in-progress" | "completed") => {
    setBusy(true);
    try {
      let after: string | null = null;
      if (status === "completed") {
        if (!file) { toast.error("Upload the after-repair photo first"); return; }
        const path = `${userId}/after-${Date.now()}.${file.name.split(".").pop() || "jpg"}`;
        const { error: upErr } = await supabase.storage.from("complaint-photos").upload(path, file);
        if (upErr) throw upErr;
        after = photoUrlFor(path);
      }
      const { error } = await supabase.rpc("worker_update_job", { _assignment_id: job.assignment_id, _status: status, _after_photo_url: after ?? undefined });
      if (error) throw error;
      toast.success(status === "completed" ? "Job completed with photo proof" : "Marked as in progress");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link to="/complaints/$id" params={{ id: job.complaint }} className="font-semibold text-foreground hover:text-primary">
            #{job.complaint_code} · {job.title}
          </Link>
          <p className="text-sm text-muted-foreground capitalize">{job.category.replace("-", " ")} · {job.priority}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${done ? "bg-success/15 text-success" : overdue ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>
          {done ? "Completed" : overdue ? "Overdue" : job.assignment_status}
        </span>
      </div>
      <p className="text-sm text-foreground">{job.description}</p>
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{job.location}</span>
        {job.due_at && <span className="flex items-center gap-1"><Clock className="h-4 w-4" />Due {new Date(job.due_at).toLocaleString()}</span>}
      </div>
      {job.photo_url && <img src={job.photo_url} alt="Reported problem" className="h-40 w-full rounded-lg object-cover" />}
      <div className="flex flex-wrap gap-2">
        {job.latitude && job.longitude && (
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${job.latitude},${job.longitude}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm text-foreground">
            <Navigation className="h-4 w-4" /> Open location
          </a>
        )}
        {!done && (
          <>
            <button disabled={busy} onClick={() => update("in-progress")} className="rounded-lg border border-border px-3 py-2 text-sm text-foreground">Start work</button>
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm text-foreground">
              <Camera className="h-4 w-4" /> {file ? file.name.slice(0, 18) : "After photo"}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <button disabled={busy || !file} onClick={() => update("completed")} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              <CheckCircle2 className="h-4 w-4" /> Complete job
            </button>
          </>
        )}
      </div>
    </div>
  );
}
