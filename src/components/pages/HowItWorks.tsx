import { motion } from "framer-motion";
import {
  UserPlus,
  FileText,
  Clock,
  Search,
  Loader,
  AlertTriangle,
  CheckCircle2,
  Bell,
} from "lucide-react";
import Layout from "@/components/Layout";
import { useLanguage } from "@/contexts/LanguageContext";

const steps = [
  {
    icon: UserPlus,
    titleKey: "hiw.step1Title" as const,
    descKey: "hiw.step1Desc" as const,
    color: "from-blue-500 to-cyan-400",
    ring: "ring-blue-400/30",
    glow: "shadow-[0_8px_30px_-6px_rgba(59,130,246,0.45)]",
    dot: "bg-blue-500",
  },
  {
    icon: FileText,
    titleKey: "hiw.step2Title" as const,
    descKey: "hiw.step2Desc" as const,
    color: "from-emerald-500 to-green-400",
    ring: "ring-emerald-400/30",
    glow: "shadow-[0_8px_30px_-6px_rgba(16,185,129,0.45)]",
    dot: "bg-emerald-500",
  },
  {
    icon: Clock,
    titleKey: "hiw.step3Title" as const,
    descKey: "hiw.step3Desc" as const,
    color: "from-amber-500 to-yellow-400",
    ring: "ring-amber-400/30",
    glow: "shadow-[0_8px_30px_-6px_rgba(245,158,11,0.45)]",
    dot: "bg-amber-500",
  },
  {
    icon: Search,
    titleKey: "hiw.step4Title" as const,
    descKey: "hiw.step4Desc" as const,
    color: "from-violet-500 to-purple-400",
    ring: "ring-violet-400/30",
    glow: "shadow-[0_8px_30px_-6px_rgba(139,92,246,0.45)]",
    dot: "bg-violet-500",
  },
  {
    icon: Loader,
    titleKey: "hiw.step5Title" as const,
    descKey: "hiw.step5Desc" as const,
    color: "from-sky-500 to-indigo-400",
    ring: "ring-sky-400/30",
    glow: "shadow-[0_8px_30px_-6px_rgba(14,165,233,0.45)]",
    dot: "bg-sky-500",
  },
  {
    icon: AlertTriangle,
    titleKey: "hiw.step6Title" as const,
    descKey: "hiw.step6Desc" as const,
    color: "from-rose-500 to-red-400",
    ring: "ring-rose-400/30",
    glow: "shadow-[0_8px_30px_-6px_rgba(244,63,94,0.45)]",
    dot: "bg-rose-500",
  },
  {
    icon: CheckCircle2,
    titleKey: "hiw.step7Title" as const,
    descKey: "hiw.step7Desc" as const,
    color: "from-teal-500 to-emerald-400",
    ring: "ring-teal-400/30",
    glow: "shadow-[0_8px_30px_-6px_rgba(20,184,166,0.45)]",
    dot: "bg-teal-500",
  },
  {
    icon: Bell,
    titleKey: "hiw.step8Title" as const,
    descKey: "hiw.step8Desc" as const,
    color: "from-orange-500 to-amber-400",
    ring: "ring-orange-400/30",
    glow: "shadow-[0_8px_30px_-6px_rgba(249,115,22,0.45)]",
    dot: "bg-orange-500",
  },
];

const HowItWorks = () => {
  const { t } = useLanguage();

  return (
    <Layout>
      <div className="container py-12 md:py-20 max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <h1 className="font-display text-4xl md:text-5xl font-extrabold text-gradient tracking-tight">
            {t("hiw.title")}
          </h1>
          <p className="text-muted-foreground text-base md:text-lg mt-3 max-w-2xl mx-auto">
            {t("hiw.subtitle")}
          </p>
          <div className="h-1.5 w-24 rounded-full gradient-accent mt-6 mx-auto shadow-[0_0_20px_hsl(30_90%_55%/0.5)]" />
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/40 via-accent/30 to-primary/10 -translate-x-1/2 hidden md:block" />
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/40 via-accent/30 to-primary/10 md:hidden" />

          <div className="flex flex-col gap-12 md:gap-16">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const isLeft = i % 2 === 0;

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: isLeft ? -60 : 60, scale: 0.92 }}
                  whileInView={{ opacity: 1, x: 0, scale: 1 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{
                    delay: 0.08 * i,
                    duration: 0.6,
                    type: "spring",
                    stiffness: 120,
                  }}
                  className="relative"
                >
                  {/* Center dot - desktop */}
                  <div className="hidden md:block absolute left-1/2 top-8 -translate-x-1/2 z-10">
                    <div className={`w-5 h-5 rounded-full ${step.dot} ring-4 ${step.ring} shadow-lg`} />
                  </div>

                  {/* Left dot - mobile */}
                  <div className="md:hidden absolute left-6 top-6 -translate-x-1/2 z-10">
                    <div className={`w-4 h-4 rounded-full ${step.dot} ring-4 ${step.ring} shadow-lg`} />
                  </div>

                  {/* Card */}
                  <div
                    className={`
                      ml-12 md:ml-0
                      md:w-[calc(50%-2.5rem)]
                      ${isLeft ? "md:mr-auto md:pr-0" : "md:ml-auto md:pl-0"}
                    `}
                  >
                    <div
                      className={`
                        group relative overflow-hidden rounded-2xl border border-border/50
                        bg-card/80 backdrop-blur-xl p-6 md:p-7
                        transition-all duration-500
                        hover:border-border hover:-translate-y-1
                        hover:${step.glow}
                      `}
                    >
                      {/* Step number badge */}
                      <div className="absolute top-4 right-4 text-[11px] font-black tracking-widest text-muted-foreground/40 uppercase">
                        Step {String(i + 1).padStart(2, "0")}
                      </div>

                      {/* Gradient accent top bar */}
                      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${step.color} opacity-60 group-hover:opacity-100 transition-opacity duration-500`} />

                      {/* Background glow */}
                      <div className={`absolute -top-16 -right-16 w-32 h-32 rounded-full bg-gradient-to-br ${step.color} opacity-[0.06] blur-2xl group-hover:opacity-[0.15] transition-opacity duration-700 pointer-events-none`} />

                      {/* Icon */}
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-4 shadow-lg ring-2 ${step.ring} group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>

                      {/* Content */}
                      <h3 className="font-display text-lg font-bold text-foreground mb-2">
                        {t(step.titleKey)}
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {t(step.descKey)}
                      </p>

                      {/* Connector arrow - desktop only */}
                      <div
                        className={`
                          hidden md:block absolute top-8 
                          ${isLeft ? "-right-6" : "-left-6"}
                          w-0 h-0
                          border-t-[8px] border-t-transparent
                          border-b-[8px] border-b-transparent
                          ${isLeft ? "border-l-[8px] border-l-border/50" : "border-r-[8px] border-r-border/50"}
                        `}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Final glow at bottom */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="hidden md:flex justify-center mt-12"
          >
            <div className="w-16 h-16 rounded-full gradient-accent flex items-center justify-center shadow-[0_0_40px_hsl(30_90%_55%/0.4)] ring-4 ring-accent/20">
              <CheckCircle2 className="w-8 h-8 text-accent-foreground" />
            </div>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default HowItWorks;
