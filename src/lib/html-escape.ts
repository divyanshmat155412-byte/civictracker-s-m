/** Escape text before inserting it into an HTML string (map popups, print exports). */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Neutralise spreadsheet formulas (=, +, -, @, tab, CR) in CSV cells. */
export function csvSafe(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
