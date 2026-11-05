import { Download, FileText } from "lucide-react";
import { exportToCSV, exportToPDF } from "@/lib/export-utils";

interface ExportButtonsProps {
  data: any[];
  filename: string;
  title: string;
}

const ExportButtons = ({ data, filename, title }: ExportButtonsProps) => {
  if (data.length === 0) return null;

  return (
    <div className="flex gap-2">
      <button
        onClick={() => exportToCSV(data, filename)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors border border-green-500/20"
      >
        <Download className="w-3.5 h-3.5" /> CSV
      </button>
      <button
        onClick={() => exportToPDF(data, title)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors border border-blue-500/20"
      >
        <FileText className="w-3.5 h-3.5" /> PDF
      </button>
    </div>
  );
};

export default ExportButtons;
