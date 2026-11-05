import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Self-service account deletion. Personal data (profile, roles, votes,
 * comments, subscriptions) is removed; complaints stay public for civic
 * accountability but are anonymised and unlinked from the account.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("complaints")
      .update({ submitted_by: "Deleted user", anonymous: true, whatsapp_number: null })
      .eq("user_id", uid);
    for (const table of [
      "complaint_comments",
      "complaint_upvotes",
      "complaint_verifications",
      "complaint_ratings",
      "poll_votes",
      "push_subscriptions",
      "reward_redemptions",
      "user_achievements",
      "admin_requests",
      "sms_log",
    ] as const) {
      await supabaseAdmin.from(table).delete().eq("user_id", uid);
    }
    await supabaseAdmin.from("workers").update({ user_id: null }).eq("user_id", uid);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (error) throw new Error("Could not delete account. Please try again.");
    return { deleted: true };
  });
