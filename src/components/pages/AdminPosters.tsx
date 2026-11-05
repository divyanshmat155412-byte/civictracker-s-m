import { useUiText } from "@/hooks/useUiText";
import { useEffect, useMemo } from "react";
import { useSearchParams, Link } from "@/lib/router-compat";
import { ArrowLeft, Printer, FileWarning } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { COMPLAINT_COLS } from "@/lib/db-columns";
import PosterSheet from "@/components/PosterSheet";

const AdminPosters = () => {
  const tx = useUiText();
  const [params] = useSearchParams();
  const ids = useMemo(() => {
    const raw = params.get("ids") || "";
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }, [params]);
  const autoPrint = params.get("autoprint") === "1";

  const { data: complaints = [], isLoading } = useQuery({
    queryKey: ["admin-posters-batch", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("complaints")
        .select(COMPLAINT_COLS)
        .in("id", ids);
      if (error) throw error;
      // Preserve the order from the URL so admins control the sequence
      const byId = new Map((data || []).map((c) => [c.id, c]));
      return ids.map((id) => byId.get(id)).filter(Boolean) as any[];
    },
  });

  // Auto-trigger the browser print dialog once images have a moment to load
  useEffect(() => {
    if (!autoPrint || isLoading || complaints.length === 0) return;
    const t = setTimeout(() => window.print(), 800);
    return () => clearTimeout(t);
  }, [autoPrint, isLoading, complaints.length]);

  return (
    <div className="min-h-screen bg-muted/30 print:bg-white">
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          html, body { background: white !important; }
          .no-print { display: none !important; }
          .poster-sheet {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border">
        <div className="max-w-[230mm] mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> {tx(" Back to admin ")}</Link>
          <div className="text-xs text-muted-foreground">
            {complaints.length} {tx(" poster")}{complaints.length === 1 ? "" : "s"} {tx(" ready ")}</div>
          <button
            onClick={() => window.print()}
            disabled={complaints.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Printer className="w-4 h-4" /> {tx(" Print all ")}</button>
        </div>
      </div>

      {ids.length === 0 ? (
        <div className="max-w-md mx-auto py-20 px-6 text-center">
          <FileWarning className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h1 className="font-display text-xl font-bold text-foreground">{tx("No complaints selected")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tx(" Go back to the admin panel, tick complaints to print, then click \"Print posters\". ")}</p>
        </div>
      ) : isLoading ? (
        <div className="text-center py-20 text-muted-foreground">{tx("Preparing posters…")}</div>
      ) : (
        <div className="flex flex-col items-center gap-6 py-6 px-4 print:gap-0 print:p-0">
          {complaints.map((c, idx) => (
            <PosterSheet key={c.id} complaint={c} pageBreakAfter={idx < complaints.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPosters;
