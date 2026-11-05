import { useUiText } from "@/hooks/useUiText";
import { MapPin, Calendar, AlertTriangle } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { CATEGORY_CONFIG, STATUS_CONFIG, ComplaintCategory } from "@/lib/types";

interface PosterSheetProps {
  complaint: any;
  /** When true, applies `page-break-after: always` so multiple sheets print one-per-page. */
  pageBreakAfter?: boolean;
}

/**
 * A4 portrait poster sheet for a single complaint. Hardcoded ink-friendly colors
 * (black/white/gray) are intentional — posters print identically regardless of theme.
 */
const PosterSheet = ({ complaint, pageBreakAfter = false }: PosterSheetProps) => {
  const tx = useUiText();
  const catConfig = CATEGORY_CONFIG[complaint.category as ComplaintCategory];
  const statusConfig = STATUS_CONFIG[complaint.status as keyof typeof STATUS_CONFIG];
  const isUrgent = complaint.priority === "high" || complaint.priority === "emergency";
  const url = `${window.location.origin}/complaints/${complaint.complaint_id}`;
  const formattedDate = new Date(complaint.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className="poster-sheet bg-white text-black shadow-elevated rounded-md overflow-hidden flex flex-col"
      style={{
        width: "210mm",
        minHeight: "297mm",
        pageBreakAfter: pageBreakAfter ? "always" : undefined,
      }}
    >
      {/* Header band */}
      <div
        className="px-10 py-6 flex items-center justify-between"
        style={{
          background: isUrgent
            ? "linear-gradient(135deg, hsl(0 75% 45%), hsl(15 85% 50%))"
            : "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8))",
          color: "white",
        }}
      >
        <div>
          <div className="text-[11px] uppercase tracking-[0.25em] font-semibold opacity-80">
            {tx(" Civic Notice ")}</div>
          <div className="font-display text-3xl font-bold mt-1">CivicTrack</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest opacity-80">{tx("Reference")}</div>
          <div className="font-mono text-xl font-bold">#{complaint.complaint_id}</div>
        </div>
      </div>

      {/* Urgency strip */}
      {isUrgent && (
        <div className="px-10 py-2 bg-red-50 border-y-2 border-red-600 flex items-center gap-2 text-red-700">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">
            {complaint.priority === "emergency" ? "Emergency — immediate attention required" : "High priority issue"}
          </span>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 px-10 py-8 flex flex-col gap-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full text-white"
            style={{ backgroundColor: catConfig?.color || "#666" }}
          >
            {tx(catConfig?.label)}
          </span>
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full"
            style={{
              backgroundColor: (statusConfig?.color || "#666") + "22",
              color: statusConfig?.color,
              border: `1px solid ${statusConfig?.color}55`,
            }}
          >
            {tx(statusConfig?.label)}
          </span>
        </div>

        <h1 className="font-display text-4xl font-bold leading-tight text-gray-900">
          {complaint.title}
        </h1>

        <div className="grid grid-cols-2 gap-6">
          {complaint.photo_url ? (
            <div className="rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-50">
              <img
                src={complaint.photo_url}
                alt={complaint.title}
                className="w-full h-[80mm] object-cover"
                crossOrigin="anonymous"
              />
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 h-[80mm] flex items-center justify-center text-gray-400 text-sm">
              {tx(" No photo provided ")}</div>
          )}

          <div className="flex flex-col gap-3 text-sm text-gray-700">
            <p className="leading-relaxed line-clamp-[10] whitespace-pre-wrap">
              {complaint.description}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm border-y border-gray-200 py-4">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 text-gray-500 shrink-0" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{tx("Location")}</div>
              <div className="text-gray-900 font-medium">{complaint.location}</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 mt-0.5 text-gray-500 shrink-0" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{tx("Reported on")}</div>
              <div className="text-gray-900 font-medium">{formattedDate}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[auto,1fr] gap-6 items-center">
          <div className="bg-white p-3 border-2 border-gray-900 rounded-md">
            <QRCodeCanvas value={url} size={170} level="H" includeMargin={false} />
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">
                {tx(" Scan to view live status ")}</div>
              <h3 className="font-display text-xl font-bold text-gray-900 mt-1">
                {tx(" Track this issue in real time ")}</h3>
            </div>
            <ol className="text-xs text-gray-700 space-y-1.5 list-decimal list-inside">
              <li>{tx("Open the camera app on your phone.")}</li>
              <li>{tx("Point it at the QR code above.")}</li>
              <li>{tx("Tap the link that appears to view updates, comments, and verifications.")}</li>
            </ol>
            <div className="text-[10px] text-gray-500 break-all font-mono">{url}</div>
          </div>
        </div>

        <div
          className="rounded-lg px-5 py-4 text-center"
          style={{ background: "hsl(var(--primary) / 0.08)", border: "1px dashed hsl(var(--primary) / 0.4)" }}
        >
          <div className="text-[10px] uppercase tracking-[0.25em] font-bold" style={{ color: "hsl(var(--primary))" }}>
            {tx(" Help your community ")}</div>
          <div className="text-sm text-gray-800 mt-1">
            {tx(" Verify, upvote, or comment on this complaint to help authorities prioritise it. ")}</div>
        </div>
      </div>

      <div className="px-10 py-4 bg-gray-900 text-gray-300 flex items-center justify-between text-[10px]">
        <div className="font-mono">civictrack.app</div>
        <div className="uppercase tracking-widest">{tx("Posted by the community · Please do not remove")}</div>
      </div>
    </div>
  );
};

export default PosterSheet;
