const KEY = "ct_complaint_draft";
const MAX_PHOTO_BYTES = 2_000_000; // ~2MB cap to stay under localStorage quota

export interface ComplaintDraft {
  title: string;
  description: string;
  category: string;
  priority: string;
  location: string;
  manualLat: string;
  manualLng: string;
  anonymous: boolean;
  photoDataUrl?: string;
  photoName?: string;
  photoType?: string;
}

export function loadDraft(): Partial<ComplaintDraft> | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveDraft(d: Partial<ComplaintDraft>) {
  try {
    const hasContent = Boolean(
      d.title || d.description || d.location || d.category || d.photoDataUrl
    );
    if (!hasContent) {
      localStorage.removeItem(KEY);
      return;
    }
    // Drop photo if too large to avoid QuotaExceededError
    const payload = { ...d };
    if (payload.photoDataUrl && payload.photoDataUrl.length > MAX_PHOTO_BYTES) {
      delete payload.photoDataUrl;
      delete payload.photoName;
      delete payload.photoType;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(payload));
    } catch {
      // Quota exceeded — retry without photo
      delete payload.photoDataUrl;
      delete payload.photoName;
      delete payload.photoType;
      localStorage.setItem(KEY, JSON.stringify(payload));
    }
  } catch {}
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function dataUrlToFile(dataUrl: string, name: string, type: string): File | null {
  try {
    const [header, b64] = dataUrl.split(",");
    if (!b64) return null;
    const mime = type || (header.match(/data:(.*?);base64/)?.[1] ?? "image/jpeg");
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], name || `photo-${Date.now()}.jpg`, { type: mime });
  } catch {
    return null;
  }
}
