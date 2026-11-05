import { createFileRoute } from "@tanstack/react-router";
import { getCaller, isStaff, canManageCity, sanitizeChat, jsonError } from "@/lib/api-guard";

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
    const { text, sourceLanguage } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const langName: Record<string, string> = {
      hi: "Hindi",
      mr: "Marathi",
      ta: "Tamil",
      bn: "Bengali",
      te: "Telugu",
      gu: "Gujarati",
      pa: "Punjabi",
      en: "English",
    };
    const sourceLabel = langName[sourceLanguage] || "auto-detected language";

    const systemPrompt = `You are a civic complaint assistant. The user spoke in ${sourceLabel}. Your job:
1. Translate their complaint to clear English.
2. Generate a short title (max 8 words).
3. Suggest a category from: garbage, water, pothole, safety, fire, lighting, sewage, building, noise, other.
4. Suggest a priority: low, medium, high, emergency.

Respond using the structured output tool.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        tools: [{
          type: "function",
          function: {
            name: "process_complaint",
            description: "Process a spoken complaint into structured English data.",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string", description: "Translated to English, full details." },
                category: { type: "string", enum: ["garbage", "water", "pothole", "safety", "fire", "lighting", "sewage", "building", "noise", "other"] },
                priority: { type: "string", enum: ["low", "medium", "high", "emergency"] },
                original_text: { type: "string", description: "Cleaned version of the original spoken text." },
              },
              required: ["title", "description", "category", "priority", "original_text"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "process_complaint" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No structured output from AI");
    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("voice-transcribe error:", e);
    return new Response(
      JSON.stringify({ error: "Request could not be completed. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};


export const Route = createFileRoute("/api/public/fn/voice-transcribe")({
  server: {
    handlers: {
      POST: ({ request }) => handler(request),
      OPTIONS: ({ request }) => handler(request),
    },
  },
});
