export type ComplaintCategory =
  | "garbage"
  | "waterlogging"
  | "broken-road"
  | "theft"
  | "fire"
  | "streetlight"
  | "drainage"
  | "encroachment"
  | "noise"
  | "other";

export type ComplaintStatus = "pending" | "in-progress" | "resolved" | "escalated";
export type ComplaintPriority = "low" | "medium" | "high" | "emergency";

export interface Complaint {
  id: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  priority: ComplaintPriority;
  photoUrl?: string;
  location: string;
  coordinates?: { lat: number; lng: number };
  timestamp: Date;
  upvotes: number;
  anonymous: boolean;
  submittedBy: string;
}

export const CATEGORY_CONFIG: Record<ComplaintCategory, { label: string; icon: string; color: string }> = {
  garbage: { label: "Garbage", icon: "Trash2", color: "hsl(var(--warning))" },
  waterlogging: { label: "Waterlogging", icon: "Droplets", color: "hsl(var(--info))" },
  "broken-road": { label: "Broken Road", icon: "AlertTriangle", color: "hsl(var(--destructive))" },
  theft: { label: "Theft", icon: "ShieldAlert", color: "hsl(var(--destructive))" },
  fire: { label: "Fire", icon: "Flame", color: "hsl(var(--destructive))" },
  streetlight: { label: "Streetlight", icon: "Lightbulb", color: "hsl(var(--warning))" },
  drainage: { label: "Drainage", icon: "Pipette", color: "hsl(var(--info))" },
  encroachment: { label: "Encroachment", icon: "Building", color: "hsl(var(--muted-foreground))" },
  noise: { label: "Noise Pollution", icon: "Volume2", color: "hsl(var(--muted-foreground))" },
  other: { label: "Other", icon: "MoreHorizontal", color: "hsl(var(--muted-foreground))" },
};

export const STATUS_CONFIG: Record<ComplaintStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "hsl(var(--warning))" },
  "in-progress": { label: "In Progress", color: "hsl(var(--info))" },
  resolved: { label: "Resolved", color: "hsl(var(--success))" },
  escalated: { label: "Escalated", color: "hsl(var(--destructive))" },
};

/** Hindi display names for categories (UI only; stored values stay in English keys). */
export const CATEGORY_LABEL_HI: Record<ComplaintCategory, string> = {
  garbage: "कचरा",
  waterlogging: "जलभराव",
  "broken-road": "टूटी सड़क",
  theft: "चोरी",
  fire: "आग",
  streetlight: "स्ट्रीट लाइट",
  drainage: "नाली",
  encroachment: "अतिक्रमण",
  noise: "ध्वनि प्रदूषण",
  other: "अन्य",
};
