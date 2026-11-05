import { createFileRoute } from "@tanstack/react-router";
import { getCaller, isStaff, canManageCity, sanitizeChat, jsonError } from "@/lib/api-guard";
import { createClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Move a worker one step closer to a complaint location (simulation).
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const caller = await getCaller(req);
  if (!caller) return jsonError(401, "Please sign in to use this feature");
  if (!(await isStaff(caller))) return jsonError(403, "Staff only");


  try {
    const { worker_id, complaint_id } = await req.json();
    if (!worker_id || !complaint_id) {
      return new Response(JSON.stringify({ error: "worker_id and complaint_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!
    );

    const { data: complaint } = await supabase
      .from("complaints")
      .select("latitude, longitude, city")
      .eq("id", complaint_id)
      .maybeSingle();

    if (complaint && !(await canManageCity(caller, (complaint as any).city))) return jsonError(403, "Not your city");
    const { data: w } = await supabase.from("workers").select("city").eq("id", worker_id).maybeSingle();
    if (!w || (w.city && !(await canManageCity(caller, w.city)))) return jsonError(403, "Not your city");

    if (!complaint?.latitude || !complaint?.longitude) {
      return new Response(JSON.stringify({ error: "Complaint has no location" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existing } = await supabase
      .from("worker_locations")
      .select("latitude, longitude")
      .eq("worker_id", worker_id)
      .maybeSingle();

    let curLat = existing?.latitude ?? complaint.latitude - 0.02;
    let curLng = existing?.longitude ?? complaint.longitude - 0.02;

    // Move 20% of remaining distance toward target
    const newLat = curLat + (complaint.latitude - curLat) * 0.2;
    const newLng = curLng + (complaint.longitude - curLng) * 0.2;

    const { error } = await supabase
      .from("worker_locations")
      .upsert({ worker_id, latitude: newLat, longitude: newLng, updated_at: new Date().toISOString() }, { onConflict: "worker_id" });

    if (error) throw error;

    // Distance in meters (approx)
    const R = 6371000;
    const dLat = (complaint.latitude - newLat) * Math.PI / 180;
    const dLng = (complaint.longitude - newLng) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(newLat * Math.PI/180) * Math.cos(complaint.latitude * Math.PI/180) * Math.sin(dLng/2)**2;
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return new Response(JSON.stringify({ ok: true, latitude: newLat, longitude: newLng, distance_m: Math.round(distance) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("simulate-worker-movement error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};


export const Route = createFileRoute("/api/public/fn/simulate-worker-movement")({
  server: {
    handlers: {
      POST: ({ request }) => handler(request),
      OPTIONS: ({ request }) => handler(request),
    },
  },
});
