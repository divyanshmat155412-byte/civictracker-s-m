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
  if (!(await isStaff(caller))) return jsonError(403, "Staff only");


  try {
    const { period } = await req.json(); // "weekly" or "monthly"

    const supabaseUrl = process.env["SUPABASE_URL"]!;
    const supabaseKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const daysBack = period === "monthly" ? 30 : 7;
    const since = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toISOString();

    // Fetch complaints in period
    const { data: complaints, error } = await supabase
      .from("complaints")
      .select("id, title, category, status, priority, location, created_at, resolved_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const total = complaints?.length || 0;
    const resolved = complaints?.filter((c: any) => c.status === "resolved").length || 0;
    const pending = complaints?.filter((c: any) => c.status === "pending").length || 0;
    const inProgress = complaints?.filter((c: any) => c.status === "in-progress").length || 0;
    const escalated = complaints?.filter((c: any) => c.status === "escalated").length || 0;

    // Category breakdown
    const categoryMap: Record<string, number> = {};
    complaints?.forEach((c: any) => {
      categoryMap[c.category] = (categoryMap[c.category] || 0) + 1;
    });

    // Priority breakdown
    const priorityMap: Record<string, number> = {};
    complaints?.forEach((c: any) => {
      priorityMap[c.priority] = (priorityMap[c.priority] || 0) + 1;
    });

    // Top areas
    const areaMap: Record<string, number> = {};
    complaints?.forEach((c: any) => {
      if (c.location) areaMap[c.location] = (areaMap[c.location] || 0) + 1;
    });
    const topAreas = Object.entries(areaMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Resolution rate
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    // Average resolution time (in days)
    const resolvedComplaints = complaints?.filter((c: any) => c.resolved_at && c.created_at) || [];
    let avgResolutionDays = 0;
    if (resolvedComplaints.length > 0) {
      const totalDays = resolvedComplaints.reduce((sum: number, c: any) => {
        const diff = new Date(c.resolved_at).getTime() - new Date(c.created_at).getTime();
        return sum + diff / (1000 * 60 * 60 * 24);
      }, 0);
      avgResolutionDays = Math.round((totalDays / resolvedComplaints.length) * 10) / 10;
    }

    // Generate AI summary
    const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
    let aiInsights = "";

    if (LOVABLE_API_KEY) {
      const prompt = `You are an analytics assistant for a civic complaint platform. Generate a brief 3-4 sentence insight summary for an admin report.

Period: Last ${daysBack} days
Total complaints: ${total}
Resolved: ${resolved} (${resolutionRate}%)
Pending: ${pending}, In Progress: ${inProgress}, Escalated: ${escalated}
Top categories: ${Object.entries(categoryMap).map(([k, v]) => `${k}: ${v}`).join(", ")}
Top areas: ${topAreas.map(a => `${a.name}: ${a.count}`).join(", ")}
Avg resolution time: ${avgResolutionDays} days

Provide actionable insights and trends. Be concise and direct.`;

      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: prompt }],
            stream: false,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          aiInsights = aiData.choices?.[0]?.message?.content?.trim() || "";
        }
      } catch (aiErr) {
        console.error("AI insights error:", aiErr);
      }
    }

    const report = {
      period: period === "monthly" ? "Monthly" : "Weekly",
      generatedAt: now.toISOString(),
      since,
      summary: {
        total,
        resolved,
        pending,
        inProgress,
        escalated,
        resolutionRate,
        avgResolutionDays,
      },
      categoryBreakdown: categoryMap,
      priorityBreakdown: priorityMap,
      topAreas,
      aiInsights,
      recentComplaints: complaints?.slice(0, 10) || [],
    };

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-admin-report error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};


export const Route = createFileRoute("/api/public/fn/generate-admin-report")({
  server: {
    handlers: {
      POST: ({ request }) => handler(request),
      OPTIONS: ({ request }) => handler(request),
    },
  },
});
