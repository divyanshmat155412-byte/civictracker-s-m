import { useUiText } from "@/hooks/useUiText";
import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const SatisfactionRating = ({ complaintId }: { complaintId: string }) => {
  const tx = useUiText();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("complaint_ratings")
        .select("rating")
        .eq("complaint_id", complaintId);
      if (data && data.length > 0) {
        const avg = data.reduce((s, r) => s + r.rating, 0) / data.length;
        setAvgRating(Math.round(avg * 10) / 10);
        setTotalRatings(data.length);
      }
      if (user) {
        const { data: myRating } = await supabase
          .from("complaint_ratings")
          .select("rating, feedback")
          .eq("complaint_id", complaintId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (myRating) {
          setRating(myRating.rating);
          setSubmitted(true);
        }
      }
    };
    fetch();
  }, [complaintId, user]);

  const handleRate = async (value: number) => {
    if (!user || submitted) return;
    setRating(value);
    setShowFeedback(true);
  };

  const handleSubmit = async () => {
    if (!user) return;
    const { error } = await supabase.from("complaint_ratings").insert({
      complaint_id: complaintId,
      user_id: user.id,
      rating,
      feedback: feedback.trim() || null,
    });
    if (error) { toast.error(tx("Couldn't save your rating. Please try again.")); return; }
    setSubmitted(true);
    setShowFeedback(false);
    setTotalRatings((p) => p + 1);
    setAvgRating((prev) => {
      const total = prev * (totalRatings) + rating;
      return Math.round((total / (totalRatings + 1)) * 10) / 10;
    });
  };

  return (
    <div className="mt-2 p-2.5 rounded-lg bg-accent/30 border border-accent/50">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-foreground">{tx("Rate resolution:")}</span>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onClick={() => handleRate(s)}
              onMouseEnter={() => !submitted && setHover(s)}
              onMouseLeave={() => setHover(0)}
              disabled={submitted || !user}
              aria-label={`${tx("Rate resolution:")} ${s} ★`}
              className="disabled:cursor-default"
            >
              <Star
                className={`w-4 h-4 transition-colors ${
                  s <= (hover || rating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"
                }`}
              />
            </button>
          ))}
        </div>
        {totalRatings > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {avgRating}★ ({totalRatings})
          </span>
        )}
      </div>

      {showFeedback && (
        <div className="mt-2 flex gap-2">
          <input
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder={tx("Optional feedback...")}
            maxLength={200}
            className="flex-1 text-xs px-2 py-1 rounded border border-input bg-card text-foreground placeholder:text-muted-foreground"
          />
          <button onClick={handleSubmit} className="text-xs px-3 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90">
            {tx(" Submit ")}</button>
        </div>
      )}

      {submitted && <p className="text-[10px] text-muted-foreground mt-1">{tx("✓ Thanks for your rating!")}</p>}
    </div>
  );
};

export default SatisfactionRating;
