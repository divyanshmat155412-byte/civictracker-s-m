import { useEffect } from "react";
import { useParams, Link } from "@/lib/router-compat";
import { ArrowLeft, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { COMPLAINT_COLS } from "@/lib/db-columns";
import PosterSheet from "@/components/PosterSheet";

const ComplaintPoster = () => {
  const { id } = useParams<{ id: string }>();

  const { data: complaint, isLoading } = useQuery({
    queryKey: ["complaint-poster", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: byCode } = await supabase
        .from("complaints")
        .select(COMPLAINT_COLS)
        .eq("complaint_id", id!)
        .maybeSingle();
      if (byCode) return byCode;
      const { data } = await supabase
        .from("complaints")
        .select(COMPLAINT_COLS)
        .eq("id", id!)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (complaint) {
      const prev = document.title;
      document.title = `Poster · #${complaint.complaint_id} · ${complaint.title}`;
      return () => {
        document.title = prev;
      };
    }
  }, [complaint]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading poster…</div>;
  }

  if (!complaint) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="font-display text-2xl font-bold">Complaint not found</h1>
        <Link to="/complaints" className="text-primary text-sm">← Back to complaints</Link>
      </div>
    );
  }

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
          <Link
            to={`/complaints/${complaint.complaint_id}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" /> Back to complaint
          </Link>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Printer className="w-4 h-4" /> Print poster
          </button>
        </div>
      </div>

      <div className="flex justify-center py-6 px-4 print:p-0">
        <PosterSheet complaint={complaint} />
      </div>
    </div>
  );
};

export default ComplaintPoster;
