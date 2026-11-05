import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Send, Clock, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useIsRootAdmin } from "@/hooks/useIsRootAdmin";
import { useCities } from "@/hooks/useCities";


const AdminRequestForm = () => {
  const { cities: CITIES } = useCities();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [designation, setDesignation] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [reason, setReason] = useState("");
  const [city, setCity] = useState("");
  const { isMainAdmin } = useIsRootAdmin();

  const { data: existingRequest, isLoading } = useQuery({
    queryKey: ["admin-request", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_requests")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const fullReason = `Designation: ${designation}${employeeId ? ` | Employee ID: ${employeeId}` : ""}${reason ? ` | Reason: ${reason}` : ""}`;
      const { error } = await supabase.from("admin_requests").insert({
        user_id: user.id,
        email: user.email || "",
        full_name: fullName,
        reason: fullReason,
        requested_city: city,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-request"] });
    },
  });

  if (isLoading) return null;

  // Main admin already has access, no need to show this form
  if (isMainAdmin) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto mt-6 p-6 rounded-xl bg-card border border-border shadow-card text-center">
        <Shield className="w-8 h-8 text-secondary mx-auto" />
        <h3 className="font-display font-semibold text-foreground mt-3 mb-1">You are the Platform Super Admin</h3>
        <p className="text-muted-foreground text-sm">You already have full admin access. No request needed.</p>
      </motion.div>
    );
  }

  if (existingRequest) {
    const statusIcons = {
      pending: <Clock className="w-8 h-8 text-yellow-500" />,
      approved: <CheckCircle className="w-8 h-8 text-green-500" />,
      rejected: <XCircle className="w-8 h-8 text-destructive" />,
    };
    const statusMessages = {
      pending: "Your admin access request is pending review by the Platform Super Admin.",
      approved: `Approved — you are City Admin for ${existingRequest.requested_city ?? "your city"}. Refresh the page to see the admin tools.`,
      rejected: "Your admin access request was rejected. You have no admin permissions.",
    };
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto mt-6 p-6 rounded-xl bg-card border border-border shadow-card text-center">
        {statusIcons[existingRequest.status as keyof typeof statusIcons]}
        <h3 className="font-display font-semibold text-foreground mt-3 mb-1">
          Request {existingRequest.status === "pending" ? "Submitted" : existingRequest.status === "approved" ? "Approved" : "Rejected"}
        </h3>
        <p className="text-muted-foreground text-sm">
          {statusMessages[existingRequest.status as keyof typeof statusMessages]}
        </p>
        {existingRequest.decision_note && <p className="text-sm text-foreground mt-2">Note from Super Admin: {existingRequest.decision_note}</p>}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto mt-6">
      <div className="p-6 rounded-xl bg-card border border-border shadow-card">
        <h3 className="font-display font-semibold text-foreground mb-1">Nagar Palika Employee — Request Admin Access</h3>
        <p className="text-muted-foreground text-sm mb-4">
          If you are a Nagar Palika employee or municipal official, submit a request below. The Platform Super Admin will review and approve your access.
        </p>
        {!user?.email_confirmed_at ? (
          <p className="text-sm text-destructive">Please verify your email address first (check your inbox for the link), then sign in again.</p>
        ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Applying as <strong className="text-foreground">{user.email}</strong> (your verified account email). Only the Platform Super Admin sees this application.</p>
          <input
            type="text"
            placeholder="Your full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-input bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="text"
            placeholder="Designation / Department (e.g. Sanitary Inspector, Ward Officer)"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            className="w-full rounded-lg border border-input bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="text"
            placeholder="Employee ID (optional)"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full rounded-lg border border-input bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <select value={city} onChange={(e) => setCity(e.target.value)}
            className="w-full rounded-lg border border-input bg-card px-4 py-3 text-sm text-foreground">
            <option value="">City you work for…</option>
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <textarea
            placeholder="Why do you need admin access? Mention your role and responsibilities."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-input bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
          <button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending || !fullName.trim() || !designation.trim() || !city}
            className="w-full py-3 rounded-lg gradient-accent text-accent-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {submitMutation.isPending ? "Submitting..." : "Submit Request"}
          </button>
          {submitMutation.error && <p className="text-sm text-destructive">{(submitMutation.error as Error).message}</p>}
        </div>
        )}
      </div>
    </motion.div>
  );
};

export default AdminRequestForm;
