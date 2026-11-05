import { createFileRoute } from "@tanstack/react-router";
import { jsonError } from "@/lib/server/api-guard";
import { createClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Send SMS notifications (simulated by default; Twilio when TWILIO_API_KEY is set)
// Used by admins to notify a citizen about complaint updates.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendSmsBody {
  to: string;
  body: string;
  complaint_id?: string;
  user_id?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = process.env["SUPABASE_URL"]!;
    const SERVICE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verify caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const { data: rootRow } = await supabase.from("app_config").select("value").eq("key", "root_admin_user_id").maybeSingle();
    const isMainAdmin = !!rootRow?.value && rootRow.value === user.id;
    if (!roleRow && !isMainAdmin) {
      return new Response(JSON.stringify({ error: "Admins only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { to, body, complaint_id } = (await req.json()) as SendSmsBody;
    if (!to || !body) {
      return new Response(JSON.stringify({ error: "to and body required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // Basic E.164-ish check
    const phone = to.trim();
    if (!/^\+?[1-9]\d{7,14}$/.test(phone.replace(/\s|-/g, ""))) {
      return new Response(JSON.stringify({ error: "Invalid phone number (use E.164 e.g. +9198XXXXXXXX)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (body.length > 480) {
      return new Response(JSON.stringify({ error: "Message too long (max 480 chars)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Recipient must be the citizen behind a complaint in a city this admin manages
    if (!complaint_id) return jsonError(400, "Choose the complaint this message is about");
    const { data: target } = await supabase.from("complaints").select("city, user_id, whatsapp_number").eq("id", complaint_id).maybeSingle();
    if (!target) return jsonError(404, "Complaint not found");
    const { data: cityOk } = await supabase.rpc("admin_can_manage_city", { _user_id: user.id, _city: target.city });
    if (cityOk !== true) return jsonError(403, "You can only message citizens in your city");
    const norm = (v: string | null | undefined) => (v || "").replace(/[\s-]/g, "").replace(/^\+/, "");
    let allowedPhones = [norm(target.whatsapp_number)];
    if (target.user_id) {
      const { data: prof } = await supabase.from("profiles").select("phone_number, sms_opt_in").eq("user_id", target.user_id).maybeSingle();
      if (prof?.sms_opt_in) allowedPhones.push(norm(prof.phone_number));
    }
    allowedPhones = allowedPhones.filter(Boolean);
    if (!allowedPhones.includes(norm(phone))) return jsonError(403, "Number does not belong to this complaint's citizen");
    const user_id = target.user_id;

    let provider = "simulated";
    let status = "simulated";
    let error: string | null = null;

    const TWILIO_KEY = process.env["TWILIO_API_KEY"];
    const LOVABLE_KEY = process.env["LOVABLE_API_KEY"];
    const TWILIO_FROM = process.env["TWILIO_FROM_NUMBER"];

    if (TWILIO_KEY && LOVABLE_KEY && TWILIO_FROM) {
      try {
        const resp = await fetch(`https://connector-gateway.lovable.dev/twilio/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_KEY}`,
            "X-Connection-Api-Key": TWILIO_KEY,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: phone, From: TWILIO_FROM, Body: body }),
        });
        const json = await resp.json();
        if (!resp.ok) {
          provider = "twilio";
          status = "failed";
          error = `Twilio ${resp.status}: ${JSON.stringify(json)}`;
        } else {
          provider = "twilio";
          status = "sent";
        }
      } catch (e: any) {
        provider = "twilio";
        status = "failed";
        error = e?.message || "Twilio call failed";
      }
    }

    const { data: log, error: insertErr } = await supabase
      .from("sms_log")
      .insert({
        phone_number: phone,
        body,
        status,
        provider,
        complaint_id: complaint_id || null,
        user_id: user_id || null,
        error,
      })
      .select()
      .single();

    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, log, simulated: provider === "simulated" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send-sms error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};


export const Route = createFileRoute("/api/public/fn/send-sms")({
  server: {
    handlers: {
      POST: ({ request }) => handler(request),
      OPTIONS: ({ request }) => handler(request),
    },
  },
});
