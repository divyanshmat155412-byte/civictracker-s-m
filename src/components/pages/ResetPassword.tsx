import { useUiText } from "@/hooks/useUiText";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle } from "lucide-react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";

const ResetPassword = () => {
  const tx = useUiText();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    // Listen for the PASSWORD_RECOVERY event from the auth state change
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    // Also check if we already have a session (user clicked the link and was auto-logged in)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Check URL hash for type=recovery
        const hash = window.location.hash;
        if (hash.includes("type=recovery")) {
          setIsRecovery(true);
        } else {
          setIsRecovery(true); // If they landed here with a session, assume recovery
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(tx("Passwords do not match."));
      return;
    }

    if (password.length < 6) {
      setError(tx("Password must be at least 6 characters."));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => navigate("/", { replace: true }), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  if (!isRecovery) {
    return (
      <Layout>
        <div className="container py-20 flex justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">{tx("Verifying recovery link...")}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-12 md:py-20 flex justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <h1 className="font-display text-3xl font-bold text-foreground">
              {tx(" Set New Password ")}</h1>
            <p className="text-muted-foreground mt-2">
              {tx(" Enter your new password below ")}</p>
          </div>

          <div className="bg-card rounded-xl border border-border p-6 shadow-card">
            {success ? (
              <div className="text-center py-4">
                <CheckCircle className="w-12 h-12 text-success mx-auto mb-3" />
                <p className="text-foreground font-semibold">{tx("Password updated!")}</p>
                <p className="text-muted-foreground text-sm mt-1">{tx("Redirecting you to the homepage...")}</p>
              </div>
            ) : (
              <>
                {error && (
                  <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                    {error}
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">{tx("New Password")}</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        required
                        minLength={6}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">{tx("Confirm Password")}</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-lg gradient-accent text-accent-foreground font-semibold flex items-center justify-center gap-2 shadow-elevated disabled:opacity-50 transition-transform hover:scale-[1.02]"
                  >
                    {loading ? tx("Updating...") : tx("Update Password")}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default ResetPassword;
