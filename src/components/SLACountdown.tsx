import { useEffect, useState } from "react";
import { Timer, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SLACountdownProps {
  category: string;
  createdAt: string;
  status: string;
}

import { useUiText } from "@/hooks/useUiText";

const SLACountdown = ({ category, createdAt, status }: SLACountdownProps) => {
  const tx = useUiText();
  const [now, setNow] = useState(Date.now());

  const { data: slaConfig } = useQuery({
    queryKey: ["sla-config"],
    queryFn: async () => {
      const { data } = await supabase.from("sla_config").select("*");
      return data || [];
    },
    staleTime: 60000,
  });

  useEffect(() => {
    if (status === "resolved") return;
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, [status]);

  if (status === "resolved" || !slaConfig) return null;

  const config = slaConfig.find((s: any) => s.category === category);
  if (!config) return null;

  const deadlineMs = new Date(createdAt).getTime() + config.deadline_hours * 60 * 60 * 1000;
  const remaining = deadlineMs - now;
  const isOverdue = remaining <= 0;
  const hoursLeft = Math.abs(Math.floor(remaining / (60 * 60 * 1000)));
  const minsLeft = Math.abs(Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000)));

  const urgency = isOverdue ? "overdue" : remaining < 6 * 60 * 60 * 1000 ? "critical" : remaining < 24 * 60 * 60 * 1000 ? "warning" : "ok";
  const colors = {
    overdue: "bg-destructive/10 text-destructive border-destructive/20",
    critical: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    warning: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    ok: "bg-green-500/10 text-green-600 border-green-500/20",
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${colors[urgency]}`}>
      {isOverdue ? <AlertTriangle className="w-2.5 h-2.5" /> : <Timer className="w-2.5 h-2.5" />}
      {isOverdue ? `${tx("Overdue")} ${hoursLeft} ${tx("hours")} ${minsLeft} ${tx("minutes")}` : `${hoursLeft} ${tx("hours")} ${minsLeft} ${tx("minutes")} ${tx("left")}`}
    </span>
  );
};

export default SLACountdown;
