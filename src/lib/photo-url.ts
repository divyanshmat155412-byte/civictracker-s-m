// Photos live in a private storage bucket; they are served through the
// app's own /api/public/photo route so links work for everyone.
export function photoUrlFor(filePath: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/api/public/photo/${filePath.split("/").map(encodeURIComponent).join("/")}`;
}
