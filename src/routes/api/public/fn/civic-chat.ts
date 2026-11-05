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
    const { messages: rawMessages, language } = await req.json();
    const messages = sanitizeChat(rawMessages);
    const lang = language === "hi" ? "hi" : "en";
    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch recent complaints for context
    const supabaseUrl = process.env["SUPABASE_URL"]!;
    const supabaseKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: recentComplaints } = await supabase
      .from("complaints")
      .select("complaint_id, title, category, status, priority, location, created_at, upvotes")
      .order("created_at", { ascending: false })
      .limit(20);

    const { count: totalCount } = await supabase.from("complaints").select("*", { count: "exact", head: true });
    const { count: resolvedCount } = await supabase.from("complaints").select("*", { count: "exact", head: true }).eq("status", "resolved");
    const { count: pendingCount } = await supabase.from("complaints").select("*", { count: "exact", head: true }).eq("status", "pending");

    const complaintsContext = recentComplaints?.map(c => 
      `#${c.complaint_id}: "${c.title}" | ${c.category} | ${c.status} | ${c.priority} priority | ${c.location} | ${c.upvotes} upvotes`
    ).join("\n") || "No complaints found.";

    const systemPrompt = `You are "Civic AI", a helpful assistant for Civic Tracker — a citizen complaint management platform. You help users understand complaints, navigate the app, and learn about civic issues.

Current Database Stats:
- Total complaints: ${totalCount || 0}
- Resolved: ${resolvedCount || 0}
- Pending: ${pendingCount || 0}

Recent Complaints:
${complaintsContext}

Guidelines:
- Answer questions about complaints, their status, categories, and trends
- Help users understand how to submit complaints, track them, and use the platform
- Provide insights about civic issues based on complaint data
- Be friendly, concise, and helpful
- If asked about a specific complaint, reference its ID and details
- If you don't have specific data, say so honestly
- The user's preferred language is: ${lang === "hi" ? "Hindi (हिन्दी)" : "English"}.
  ${lang === "hi"
    ? "ALWAYS reply in natural, fluent Hindi using Devanagari script. If the user mixes Hindi and English (Hinglish), respond in Hindi but keep proper nouns (names, IDs, category labels like 'Garbage') as-is. Never reply only in English when the user is in Hindi mode."
    : "Reply in English unless the user clearly writes in Hindi."}
- Keep responses under 200 words unless asked for detail`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("civic-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};


export const Route = createFileRoute("/api/public/fn/civic-chat")({
  server: {
    handlers: {
      POST: ({ request }) => handler(request),
      OPTIONS: ({ request }) => handler(request),
    },
  },
});
