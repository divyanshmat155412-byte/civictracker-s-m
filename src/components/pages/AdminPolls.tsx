import { useUiText } from "@/hooks/useUiText";
import { useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Trash2, ArrowLeft } from "lucide-react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

const AdminPolls = () => {
  const tx = useUiText();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, isLoading } = useUserRole();
  const queryClient = useQueryClient();

  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [endsAt, setEndsAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 16);
  });
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [submitting, setSubmitting] = useState(false);

  const { data: polls = [] } = useQuery({
    queryKey: ["admin-polls"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("polls").select("*, poll_options(*), poll_votes(id)").order("created_at", { ascending: false });
      return data || [];
    },
  });

  if (isLoading) return <Layout><div className="container py-12 text-center text-muted-foreground">{tx("Loading...")}</div></Layout>;
  if (!isAdmin) return <Layout><div className="container py-12 text-center"><p className="text-destructive font-semibold">{tx("Admin access required.")}</p></div></Layout>;

  const addOption = () => setOptions([...options, ""]);
  const removeOption = (i: number) => setOptions(options.filter((_, idx) => idx !== i));
  const updateOption = (i: number, val: string) => setOptions(options.map((o, idx) => idx === i ? val : o));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = options.map(o => o.trim()).filter(Boolean);
    if (!question.trim() || validOptions.length < 2) {
      toast.error(tx("Add a question and at least 2 options."));
      return;
    }
    setSubmitting(true);
    try {
      const { data: poll, error: pErr } = await supabase
        .from("polls")
        .insert({
          question: question.trim(),
          description: description.trim() || null,
          ends_at: new Date(endsAt).toISOString(),
          created_by: user!.id,
        })
        .select()
        .single();
      if (pErr) throw pErr;

      const { error: oErr } = await supabase.from("poll_options").insert(
        validOptions.map((text, idx) => ({ poll_id: poll.id, option_text: text, display_order: idx }))
      );
      if (oErr) throw oErr;

      toast.success(tx("Poll created! 🗳️"));
      setQuestion(""); setDescription(""); setOptions(["", ""]);
      queryClient.invalidateQueries({ queryKey: ["admin-polls"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const deletePoll = async (id: string) => {
    if (!confirm(tx("Delete this poll and all its votes?"))) return;
    const { error } = await supabase.from("polls").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(tx("Poll deleted"));
      queryClient.invalidateQueries({ queryKey: ["admin-polls"] });
    }
  };

  return (
    <Layout>
      <div className="container py-8 max-w-3xl">
        <button onClick={() => navigate("/polls")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> {tx(" Back to Polls ")}</button>

        <h1 className="font-display text-2xl font-bold mb-6">{tx("Manage Polls")}</h1>

        <form onSubmit={handleCreate} className="bg-card rounded-xl border border-border p-5 shadow-card mb-8">
          <h2 className="font-semibold mb-4">{tx("Create New Poll")}</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">{tx("Question")}</label>
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={tx("E.g. What's the biggest issue in your area this month?")}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background text-sm"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">{tx("Description (optional)")}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">{tx("Ends at")}</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-input bg-background text-sm"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">{tx("Options")}</label>
              <div className="space-y-2 mt-1">
                {options.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={opt}
                      onChange={(e) => updateOption(i, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm"
                    />
                    {options.length > 2 && (
                      <button type="button" onClick={() => removeOption(i)} className="px-3 rounded-lg bg-muted hover:bg-destructive hover:text-destructive-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addOption} className="text-xs flex items-center gap-1 text-primary font-semibold hover:underline">
                  <Plus className="w-3 h-3" /> {tx(" Add option ")}</button>
              </div>
            </div>
            <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold disabled:opacity-50">
              {submitting ? tx("Creating...") : tx("Create Poll")}
            </button>
          </div>
        </form>

        <h2 className="font-semibold mb-3">{tx("Existing Polls (")}{polls.length})</h2>
        <div className="space-y-2">
          {polls.map((p: any) => (
            <div key={p.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{p.question}</p>
                <p className="text-xs text-muted-foreground">
                  {p.poll_options?.length || 0} {tx(" options • ")}{p.poll_votes?.length || 0} {tx(" votes • Ends ")}{new Date(p.ends_at).toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => deletePoll(p.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default AdminPolls;
