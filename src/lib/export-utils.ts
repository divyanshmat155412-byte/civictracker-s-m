import { escapeHtml, csvSafe } from "@/lib/html-escape";
export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csv = [
    headers.map((h) => csvSafe(h)).join(","),
    ...data.map((row) =>
      headers.map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return "";
        const str = csvSafe(String(val)).replace(/"/g, '""');
        return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str}"` : str;
      }).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

export const exportToPDF = async (data: any[], title: string) => {
  // Generate a simple HTML-based PDF using print
  const headers = Object.keys(data[0] || {});
  const html = `
    <!DOCTYPE html>
    <html><head><title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; }
      h1 { color: #333; font-size: 18px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; }
      th { background: #f5f5f5; padding: 8px; text-align: left; border: 1px solid #ddd; font-weight: bold; }
      td { padding: 6px 8px; border: 1px solid #ddd; }
      tr:nth-child(even) { background: #fafafa; }
      .footer { margin-top: 20px; font-size: 10px; color: #888; }
    </style></head>
    <body>
      <h1>${escapeHtml(title)}</h1>
      <p style="font-size:11px;color:#666;">Generated on ${new Date().toLocaleString()} • ${data.length} records</p>
      <table>
        <thead><tr>${headers.map((h) => `<th>${escapeHtml(h.replace(/_/g, " ").toUpperCase())}</th>`).join("")}</tr></thead>
        <tbody>${data.map((row) => `<tr>${headers.map((h) => `<td>${escapeHtml(row[h])}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
      <div class="footer">Civic Tracker Report</div>
    </body></html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.print(); }, 500);
  }
};
