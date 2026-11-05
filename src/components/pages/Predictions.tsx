import { invokeFunction } from "@/lib/invoke-function";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Loader2, Brain } from "lucide-react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";

const TrendIcon = ({ trend }: { trend: string }) => {
  if (trend === "rising") return <TrendingUp className="w-4 h-4 text-destructive" />;
  if (trend === "declining") return <TrendingDown className="w-4 h-4 text-green-500" />;
  return <Minus className="w-4 h-4 text-muted-foreground" />;
};

const Predictions = () => {
  const { t, language } = useLanguage();

  const trendLabel = (trend: string) => {
    if (trend === "rising") return t("predictions.rising");
    if (trend === "declining") return t("predictions.declining");
    return t("predictions.stable");
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["predictions", language],
    queryFn: async () => {
      const resp = await invokeFunction("predict-trends", { body: { language } });
      if (resp.error) throw resp.error;
      return resp.data;
    },
    staleTime: 300000,
    retry: false,
  });

  return (
    <Layout>
      <div className="container py-8 md:py-12 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-2">
            <Brain className="w-7 h-7 text-primary" />
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">{t("predictions.title")}</h1>
          </div>
          <p className="text-muted-foreground text-sm mb-8">{t("predictions.subtitle")}</p>
        </motion.div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">{t("predictions.analyzing")}</span>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">{t("predictions.failed")}</p>
            <button onClick={() => refetch()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">{t("predictions.retry")}</button>
          </div>
        ) : (
          <>
            {data?.summary && (
              <Card className="mb-6">
                <CardContent className="p-5">
                  <p className="text-sm text-foreground">{data.summary}</p>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4">
              {data?.predictions?.map((p: any, i: number) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card>
                    <CardContent className="p-4 flex items-start gap-4">
                      <TrendIcon trend={p.trend} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-bold text-foreground capitalize">{p.category}</span>
                          {p.area && <span className="text-xs text-muted-foreground">• {p.area}</span>}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            p.trend === "rising" ? "bg-destructive/10 text-destructive" :
                            p.trend === "declining" ? "bg-green-500/10 text-green-600" :
                            "bg-muted text-muted-foreground"
                          }`}>{trendLabel(p.trend)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{p.insight}</p>
                        {p.expected_count && (
                          <p className="text-xs text-muted-foreground mt-1">{t("predictions.expected")}: ~{p.expected_count} {t("predictions.complaintsNext2Weeks")}</p>
                        )}
                      </div>
                      {p.confidence && (
                        <span className="text-[10px] text-muted-foreground shrink-0">{Math.round(p.confidence * 100)}% {t("predictions.confidence")}</span>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default Predictions;
