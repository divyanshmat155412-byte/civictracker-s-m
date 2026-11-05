import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  profile: any;
  userId: string;
}

const SmsOptInCard = ({ profile, userId }: Props) => {
  const [phone, setPhone] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("get_my_profile_contact");
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : data;
      setPhone(row?.phone_number || "");
      setOptIn(!!row?.sms_opt_in);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc("update_my_profile_contact", {
        _phone: phone.trim(),
        _opt_in: optIn,
      });
      if (error) throw error;
      toast.success("SMS preferences saved");
      queryClient.invalidateQueries({ queryKey: ["my-profile", userId] });
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-accent" /> SMS notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Get complaint updates via SMS — useful when you have low or no internet.</p>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Phone (E.164)</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter your phone"
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="rounded border-input" />
            Send me SMS updates about my complaints
          </label>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save"}
          </button>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default SmsOptInCard;
