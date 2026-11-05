import { createFileRoute } from "@tanstack/react-router";
import { getCaller, isStaff, canManageCity, sanitizeChat, jsonError } from "@/lib/server/api-guard";
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
    const { complaint_id, title, description, category, location } = await req.json();
    if (!complaint_id) return jsonError(400, "complaint_id is required");
    const admin = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!);
    const { data: owned } = await admin.from("complaints").select("user_id, city, priority, created_at").eq("id", complaint_id).maybeSingle();
    if (!owned) return jsonError(404, "Complaint not found");
    const isOwnerFresh = owned.user_id === caller.user.id && Date.now() - new Date(owned.created_at).getTime() < 15 * 60 * 1000;
    if (!isOwnerFresh && !(await canManageCity(caller, owned.city))) return jsonError(403, "Not allowed for this complaint");
    const priority = owned.priority;

    const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `You are a civic complaint AI assistant. Analyze this citizen complaint and return a JSON object with these fields:
1. "summary": A concise 1-2 sentence summary highlighting issue type, location, and urgency.
2. "suggested_category": Best category from [garbage, waterlogging, broken-road, theft, fire, streetlight, drainage, encroachment, noise, other].
3. "suggested_priority": Recommended priority from [low, medium, high, emergency] based on severity, safety risk, and public impact.
4. "sentiment": The complaint's tone from [angry, frustrated, neutral, concerned, urgent].

Complaint details:
- Title: ${title}
- User-selected Category: ${category}
- Location: ${location}
- User-selected Priority: ${priority}
- Description: ${description}

Return ONLY valid JSON, no markdown, no explanation.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        stream: false,
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_complaint",
              description: "Analyze a civic complaint and return structured analysis",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string", description: "1-2 sentence summary" },
                  suggested_category: {
                    type: "string",
                    enum: ["garbage", "waterlogging", "broken-road", "theft", "fire", "streetlight", "drainage", "encroachment", "noise", "other"],
                  },
                  suggested_priority: {
                    type: "string",
                    enum: ["low", "medium", "high", "emergency"],
                  },
                  sentiment: {
                    type: "string",
                    enum: ["angry", "frustrated", "neutral", "concerned", "urgent"],
                  },
                },
                required: ["summary", "suggested_category", "suggested_priority", "sentiment"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_complaint" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    
    // Extract from tool call response
    let analysis = { summary: "", suggested_category: category, suggested_priority: priority, sentiment: "neutral" };
    
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        analysis = JSON.parse(toolCall.function.arguments);
      } catch {
        // Fallback to content if tool call parsing fails
        const content = data.choices?.[0]?.message?.content || "";
        analysis.summary = content.trim();
      }
    } else {
      analysis.summary = data.choices?.[0]?.message?.content?.trim() || "";
    }

    // Update the complaint with AI analysis
    const supabaseUrl = process.env["SUPABASE_URL"]!;
    const supabaseKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Build update: always set summary, only override category/priority if AI suggests different AND user chose defaults
    const updateData: Record<string, string> = { ai_summary: analysis.summary };
    
    // If AI detected a more severe priority, upgrade it
    const priorityOrder = ["low", "medium", "high", "emergency"];
    const currentIdx = priorityOrder.indexOf(priority);
    const suggestedIdx = priorityOrder.indexOf(analysis.suggested_priority);
    if (suggestedIdx > currentIdx) {
      updateData.priority = analysis.suggested_priority;
    }

    const { error: updateError } = await supabase
      .from("complaints")
      .update(updateData)
      .eq("id", complaint_id);

    if (updateError) {
      console.error("DB update error:", updateError);
      return new Response(JSON.stringify({ error: "Failed to save summary", ...analysis }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-summary error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};


export const Route = createFileRoute("/api/public/fn/generate-summary")({
  server: {
    handlers: {
      POST: ({ request }) => handler(request),
      OPTIONS: ({ request }) => handler(request),
    },
  },
});
