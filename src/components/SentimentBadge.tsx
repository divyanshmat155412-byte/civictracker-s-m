import { AlertTriangle, Frown, Meh, Smile, Heart } from "lucide-react";

const SENTIMENT_CONFIG: Record<string, { icon: typeof Frown; color: string; bg: string }> = {
  critical: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-500/10" },
  frustrated: { icon: Frown, color: "text-orange-600", bg: "bg-orange-500/10" },
  concerned: { icon: Meh, color: "text-yellow-600", bg: "bg-yellow-500/10" },
  neutral: { icon: Smile, color: "text-blue-600", bg: "bg-blue-500/10" },
  hopeful: { icon: Heart, color: "text-green-600", bg: "bg-green-500/10" },
};

const SentimentBadge = ({ label }: { label: string | null }) => {
  if (!label) return null;
  const config = SENTIMENT_CONFIG[label] || SENTIMENT_CONFIG.neutral;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.bg} ${config.color}`}>
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
};

export default SentimentBadge;
