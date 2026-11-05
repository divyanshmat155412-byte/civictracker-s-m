import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Generic WhatsApp webhook — works with Twilio, Meta Cloud API, or simulator.
// Twilio sends form-urlencoded; Meta sends JSON. We support both, plus a simple JSON test format.
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!
    );

    const contentType = req.headers.get("content-type") || "";
    let from = "";
    let body = "";
    let mediaUrl: string | null = null;
    let latitude: number | null = null;
    let longitude: number | null = null;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      // Twilio format
      const form = await req.formData();
      from = String(form.get("From") || "").replace("whatsapp:", "");
      body = String(form.get("Body") || "");
      mediaUrl = form.get("MediaUrl0") ? String(form.get("MediaUrl0")) : null;
      const lat = form.get("Latitude");
      const lng = form.get("Longitude");
      if (lat) latitude = parseFloat(String(lat));
      if (lng) longitude = parseFloat(String(lng));
    } else {
      // JSON (Meta WhatsApp Cloud API or test format)
      const json = await req.json();
      // Simple test format: { from, body, mediaUrl?, latitude?, longitude? }
      if (json.from || json.body) {
        from = json.from || "";
        body = json.body || "";
        mediaUrl = json.mediaUrl || null;
        latitude = json.latitude ?? null;
        longitude = json.longitude ?? null;
      } else {
        // Meta webhook format
        const entry = json.entry?.[0]?.changes?.[0]?.value;
        const message = entry?.messages?.[0];
        if (message) {
          from = message.from || "";
          body = message.text?.body || message.image?.caption || "";
          if (message.location) {
            latitude = message.location.latitude;
            longitude = message.location.longitude;
          }
        }
      }
    }

    if (!body && !mediaUrl) {
      return new Response(JSON.stringify({ status: "ignored", reason: "empty message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use AI to extract structured complaint data
    const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
    let title = body.slice(0, 60) || "WhatsApp complaint";
    let description = body || "Submitted via WhatsApp";
    let category = "other";
    let priority = "medium";

    if (LOVABLE_API_KEY && body.trim().length > 5) {
      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "Extract a civic complaint from this WhatsApp message. Translate non-English to English." },
              { role: "user", content: body },
            ],
            tools: [{
              type: "function",
              function: {
                name: "extract",
                parameters: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    category: { type: "string", enum: ["garbage", "water", "pothole", "safety", "fire", "lighting", "sewage", "building", "noise", "other"] },
                    priority: { type: "string", enum: ["low", "medium", "high", "emergency"] },
                  },
                  required: ["title", "description", "category", "priority"],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "extract" } },
          }),
        });
        if (aiResp.ok) {
          const data = await aiResp.json();
          const args = JSON.parse(data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments || "{}");
          if (args.title) title = args.title;
          if (args.description) description = args.description;
          if (args.category) category = args.category;
          if (args.priority) priority = args.priority;
        }
      } catch (e) {
        console.error("AI extraction failed:", e);
      }
    }

    const location = latitude && longitude
      ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
      : "Submitted via WhatsApp";

    const { data: complaint, error } = await supabase
      .from("complaints")
      .insert({
        title,
        description,
        category,
        priority,
        location,
        latitude,
        longitude,
        photo_url: mediaUrl,
        submitted_by: `WhatsApp ${from}`,
        anonymous: false,
        source: "whatsapp",
        whatsapp_number: from,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("Insert error:", error);
      throw error;
    }

    return new Response(
      JSON.stringify({ status: "ok", complaint_id: complaint.complaint_id, id: complaint.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("whatsapp-webhook error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};


export const Route = createFileRoute("/api/public/fn/whatsapp-webhook")({
  server: {
    handlers: {
      POST: ({ request }) => handler(request),
      GET: ({ request }) => handler(request),
      OPTIONS: ({ request }) => handler(request),
    },
  },
});
