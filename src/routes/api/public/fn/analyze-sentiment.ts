import { createFileRoute } from "@tanstack/react-router";
import { getCaller, isStaff, canManageCity, sanitizeChat, jsonError } from "@/lib/api-guard";
import { createClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const caller = await getCaller(req);
  if (!caller) return jsonError(401, "Please sign in to use this feature");


  try {
    const { complaintId, text } = await req.json();
    if (!text) {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: `Analyze the sentiment and urgency of this civic complaint. Text: "${text}"` }],
        tools: [{
          type: "function",
          function: {
            name: "analyze_sentiment",
            description: "Analyze sentiment of a complaint",
            parameters: {
              type: "object",
              properties: {
                score: { type: "number", description: "Sentiment score from -1 (very negative/urgent) to 1 (positive)" },
                label: { type: "string", enum: ["critical", "frustrated", "concerned", "neutral", "hopeful"] },
                urgency: { type: "string", enum: ["immediate", "high", "moderate", "low"] }
              },
              required: ["score", "label", "urgency"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "analyze_sentiment" } }
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Sentiment analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let result = { score: 0, label: "neutral", urgency: "moderate" };
    
    if (toolCall?.function?.arguments) {
      try { result = JSON.parse(toolCall.function.arguments); } catch { /* default */ }
    }

    // Update complaint if ID provided
    if (complaintId) {
      const supabaseUrl = process.env["SUPABASE_URL"]!;
      const supabaseKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: c } = await supabase.from("complaints").select("user_id, city").eq("id", complaintId).maybeSingle();
      const allowed = !!c && (c.user_id === caller.user.id || (await canManageCity(caller, c.city)));
      if (allowed) {
      await supabase.from("complaints").update({
        sentiment_score: result.score,
        sentiment_label: result.label,
      }).eq("id", complaintId);
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-sentiment error:", e);
    return new Response(
      JSON.stringify({ error: "Request could not be completed. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};


export const Route = createFileRoute("/api/public/fn/analyze-sentiment")({
  server: {
    handlers: {
      POST: ({ request }) => handler(request),
      OPTIONS: ({ request }) => handler(request),
    },
  },
});
