// Checks an image by its real bytes (magic numbers), not its name or browser-reported type.
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export type SafeImage = { mime: string; ext: string };

export function sniffImage(b: Uint8Array): SafeImage | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a)
    return { mime: "image/png", ext: "png" };
  const s = (i: number, n: number) => String.fromCharCode(...b.slice(i, i + n));
  if (s(0, 4) === "RIFF" && s(8, 4) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (s(0, 6) === "GIF87a" || s(0, 6) === "GIF89a") return { mime: "image/gif", ext: "gif" };
  if (s(4, 4) === "ftyp") {
    const brand = s(8, 4);
    if (["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].includes(brand)) return { mime: "image/heic", ext: "heic" };
  }
  return null;
}

/** Returns the safe type of a photo, or an error message for the user. */
export async function validatePhotoFile(file: File): Promise<SafeImage | { error: string }> {
  if (file.size > MAX_PHOTO_BYTES) return { error: "Photo is too large (maximum 5 MB)" };
  if (file.size === 0) return { error: "Photo file is empty" };
  const part = file.slice(0, 16);
  const buf = typeof part.arrayBuffer === "function" ? await part.arrayBuffer() : await new Response(part).arrayBuffer();
  const head = new Uint8Array(buf);
  return sniffImage(head) ?? { error: "Only JPG, PNG, WebP, GIF or HEIC photos are allowed" };
}
