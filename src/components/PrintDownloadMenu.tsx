import { useUiText } from "@/hooks/useUiText";
import { useState, useRef } from "react";
import { Printer, Download, FileText, X, Check, Loader2, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link } from "@/lib/router-compat";
import { toast } from "sonner";
import PosterSheet from "@/components/PosterSheet";

interface PrintDownloadMenuProps {
  complaint: any;
}

const PrintDownloadMenu = ({ complaint }: PrintDownloadMenuProps) => {
  const tx = useUiText();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "print" | "download">("menu");
  const [downloading, setDownloading] = useState(false);
  const hiddenPosterRef = useRef<HTMLDivElement>(null);

  const reset = () => {
    setView("menu");
  };

  const handleDownloadPdf = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const node = hiddenPosterRef.current?.querySelector(".poster-sheet") as HTMLElement | null;
      if (!node) throw new Error("Poster not ready");
      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, Math.min(imgHeight, pageHeight));
      pdf.save(`complaint-${complaint.complaint_id}.pdf`);
      toast.success(tx("PDF downloaded"));
    } catch (err) {
      console.error(err);
      toast.error(tx("Could not generate PDF"));
    } finally {
      setDownloading(false);
    }
  };

  const Trigger = (
    <button
      type="button"
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
      title={tx("Print or download")}
    >
      <Printer className="w-3.5 h-3.5" />
      <span>{tx("Print / PDF")}</span>
    </button>
  );

  const MenuView = (
    <div className="space-y-2">
      <button
        onClick={() => setView("print")}
        className="group/row w-full flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-muted/30 hover:bg-primary/5 hover:border-primary/30 transition-all text-left"
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary shrink-0">
          <Printer className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground">{tx("Print poster")}</div>
          <div className="text-[11px] text-muted-foreground">{tx("Show steps to print")}</div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover/row:translate-x-0.5 transition-transform" />
      </button>
      <button
        onClick={() => setView("download")}
        className="group/row w-full flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-muted/30 hover:bg-success/5 hover:border-success/30 transition-all text-left"
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-success/15 to-success/5 text-success shrink-0">
          <Download className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground">{tx("Download as PDF")}</div>
          <div className="text-[11px] text-muted-foreground">{tx("Show steps to download")}</div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover/row:translate-x-0.5 transition-transform" />
      </button>
    </div>
  );

  const PrintSteps = (
    <div className="space-y-3">
      <button
        onClick={reset}
        className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        {tx(" ← Back ")}</button>
      <div className="flex items-center gap-2">
        <Printer className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">{tx("How to print this poster")}</h4>
      </div>
      <ol className="space-y-2.5">
        {[
          "Click the 'Open print view' button below to load the printable A4 poster.",
          "When the new tab opens, click the blue 'Print poster' button at the top right.",
          "In the system print dialog, choose your printer (or 'Save as PDF').",
          "Set paper size to A4 and margins to 'None' for best results.",
          "Click 'Print' to send it to the printer.",
        ].map((step, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold shrink-0 mt-0.5">
              {i + 1}
            </span>
            <span className="text-xs text-foreground/80 leading-relaxed">{tx(step)}</span>
          </li>
        ))}
      </ol>
      <Link
        to={`/complaints/${complaint.complaint_id}/poster`}
        onClick={() => setOpen(false)}
        className="mt-2 w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-sm font-semibold shadow-md hover:opacity-90 transition-opacity"
      >
        <Printer className="w-4 h-4" /> {tx(" Open print view ")}</Link>
      <p className="text-[10px] text-muted-foreground flex items-start gap-1.5">
        <Check className="w-3 h-3 text-success mt-0.5 shrink-0" />
        {tx(" Tip: You can also press Ctrl/Cmd + P from the print view. ")}</p>
    </div>
  );

  const DownloadSteps = (
    <div className="space-y-3">
      <button
        onClick={reset}
        className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        {tx(" ← Back ")}</button>
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-success" />
        <h4 className="text-sm font-semibold text-foreground">{tx("How to download as PDF")}</h4>
      </div>
      <ol className="space-y-2.5">
        {[
          "Click the green 'Download PDF now' button below.",
          "We'll generate an A4 poster of this complaint instantly.",
          "Your browser will save the file as 'complaint-" + complaint.complaint_id + ".pdf' to your Downloads folder.",
          "Open the file from your Downloads to view, share, or print it.",
        ].map((step, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-success/15 text-success text-[10px] font-bold shrink-0 mt-0.5">
              {i + 1}
            </span>
            <span className="text-xs text-foreground/80 leading-relaxed">{tx(step)}</span>
          </li>
        ))}
      </ol>
      <button
        onClick={handleDownloadPdf}
        disabled={downloading}
        className="mt-2 w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-success to-emerald-600 text-success-foreground text-sm font-semibold shadow-md hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {downloading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> {tx(" Generating PDF… ")}</>
        ) : (
          <>
            <Download className="w-4 h-4" /> {tx(" Download PDF now ")}</>
        )}
      </button>
      <p className="text-[10px] text-muted-foreground flex items-start gap-1.5">
        <Check className="w-3 h-3 text-success mt-0.5 shrink-0" />
        {tx(" On mobile, the PDF will open or download depending on your browser. ")}</p>
    </div>
  );

  const Body = view === "print" ? PrintSteps : view === "download" ? DownloadSteps : MenuView;

  const HiddenPoster = (
    <div
      ref={hiddenPosterRef}
      aria-hidden
      style={{
        position: "fixed",
        left: "-10000px",
        top: 0,
        pointerEvents: "none",
        opacity: 0,
      }}
    >
      <PosterSheet complaint={complaint} />
    </div>
  );

  if (isMobile) {
    return (
      <>
        <Sheet
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) reset();
          }}
        >
          <SheetTrigger asChild>{Trigger}</SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-3xl border-t border-border/50 bg-popover/95 backdrop-blur-xl px-4 pb-8 pt-3 max-h-[85vh] overflow-y-auto"
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted-foreground/30" />
            <SheetHeader className="text-left mb-4">
              <SheetTitle className="text-base">{tx("Print or download")}</SheetTitle>
            </SheetHeader>
            {Body}
          </SheetContent>
        </Sheet>
        {HiddenPoster}
      </>
    );
  }

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
      >
        <PopoverTrigger asChild>{Trigger}</PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-80 p-4 rounded-2xl border border-border/50 bg-popover/95 backdrop-blur-xl shadow-2xl"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">{tx("Print or download")}</h3>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-md text-muted-foreground hover:bg-muted"
              aria-label={tx("Close")}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {Body}
        </PopoverContent>
      </Popover>
      {HiddenPoster}
    </>
  );
};

export default PrintDownloadMenu;
