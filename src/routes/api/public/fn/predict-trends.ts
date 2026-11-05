import { createFileRoute } from "@tanstack/react-router";
import { getCaller, isStaff, canManageCity, sanitizeChat, jsonError, enforceAiQuota } from "@/lib/api-guard";
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
  const limited = await enforceAiQuota(caller, "predict-trends");
  if (limited) return limited;


  try {
    const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let language: string | undefined;
    try {
      const body = await req.json();
      language = body?.language;
    } catch { /* no body */ }
    const lang = language === "hi" ? "hi" : "en";

    const supabaseUrl = process.env["SUPABASE_URL"]!;
    const supabaseKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get last 90 days of complaints
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: complaints } = await supabase
      .from("complaints")
      .select("category, location, priority, created_at, status")
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    if (!complaints || complaints.length === 0) {
      return new Response(JSON.stringify({ predictions: [], message: "Not enough data for predictions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build weekly aggregation
    const weeklyData: Record<string, Record<string, number>> = {};
    complaints.forEach((c: any) => {
      const week = c.created_at.slice(0, 10);
      const weekNum = Math.floor(new Date(week).getTime() / (7 * 24 * 60 * 60 * 1000));
      const key = `W${weekNum}`;
      if (!weeklyData[key]) weeklyData[key] = {};
      weeklyData[key][c.category] = (weeklyData[key][c.category] || 0) + 1;
    });

    const areaData: Record<string, number> = {};
    complaints.forEach((c: any) => {
      const area = c.location?.split(",")[0]?.trim() || "Unknown";
      areaData[area] = (areaData[area] || 0) + 1;
    });

    const prompt = `You are a predictive analytics AI for a civic complaint platform. Based on the following data from the last 90 days, predict trends for the next 2 weeks.

Weekly complaint data by category: ${JSON.stringify(weeklyData)}
Complaints by area: ${JSON.stringify(areaData)}
Total complaints: ${complaints.length}

Provide predictions as structured data.
${lang === "hi"
  ? "IMPORTANT: Write every human-readable text field ('insight' and 'summary') in natural, fluent Hindi using Devanagari script. Keep the 'trend' enum values exactly as 'rising'/'stable'/'declining' in English, but translate all descriptive text into Hindi."
  : "Write all human-readable text in English."}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        tools: [{
          type: "function",
          function: {
            name: "predict_trends",
            description: "Return trend predictions",
            parameters: {
              type: "object",
              properties: {
                predictions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string" },
                      area: { type: "string" },
                      trend: { type: "string", enum: ["rising", "stable", "declining"] },
                      expected_count: { type: "number" },
                      confidence: { type: "number" },
                      insight: { type: "string" }
                    },
                    required: ["category", "trend", "insight"]
                  }
                },
                summary: { type: "string" }
              },
              required: ["predictions", "summary"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "predict_trends" } }
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Prediction failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let result = { predictions: [], summary: "Unable to generate predictions" };
    
    if (toolCall?.function?.arguments) {
      try { result = JSON.parse(toolCall.function.arguments); } catch { /* default */ }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("predict-trends error:", e);
    return new Response(
      JSON.stringify({ error: "Request could not be completed. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};


export const Route = createFileRoute("/api/public/fn/predict-trends")({
  server: {
    handlers: {
      POST: ({ request }) => handler(request),
      OPTIONS: ({ request }) => handler(request),
    },
  },
});
