import { useUiText } from "@/hooks/useUiText";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, MapPin, ShieldCheck, X, RefreshCw } from "lucide-react";

interface PermissionPromptProps {
  type: "camera" | "location";
  visible: boolean;
  onAllow: () => void;
  onDismiss: () => void;
}

const CONFIG = {
  camera: {
    icon: Camera,
    title: "Camera Access Needed",
    description: "We need your camera to take a live photo of the issue. This helps verify and resolve complaints faster.",
    steps: [
      "Tap \"Allow\" when the browser asks for camera permission",
      "If you accidentally denied, tap \"Try Again\" below",
      "Your camera is only used when you choose to take a photo",
    ],
    allowLabel: "Allow Camera Access",
  },
  location: {
    icon: MapPin,
    title: "Location Access Needed",
    description: "We need your location to auto-detect where the issue is. This makes your complaint more accurate.",
    steps: [
      "Tap \"Allow\" when the browser asks for location permission",
      "If you accidentally denied, tap \"Try Again\" below",
      "Choose \"Always Allow\" for the best experience",
    ],
    allowLabel: "Allow Location Access",
  },
};

const PermissionPrompt = ({ type, visible, onAllow, onDismiss }: PermissionPromptProps) => {
  const tx = useUiText();
  const config = CONFIG[type];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onDismiss}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25 }}
            className="bg-card rounded-2xl border border-border shadow-elevated max-w-sm w-full p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onDismiss}
              className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-16 h-16 rounded-full bg-secondary/15 flex items-center justify-center mb-4">
                <Icon className="w-8 h-8 text-secondary" />
              </div>
              <h3 className="font-display font-bold text-lg text-foreground">{tx(config.title)}</h3>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{tx(config.description)}</p>
            </div>

            <div className="bg-muted/50 rounded-xl p-4 mb-5 space-y-3">
              {config.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-secondary/20 text-secondary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-foreground leading-snug">{tx(step)}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={onAllow}
                className="w-full py-3 rounded-xl gradient-accent text-accent-foreground font-semibold text-sm flex items-center justify-center gap-2 shadow-elevated transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <ShieldCheck className="w-4 h-4" />
                {tx(config.allowLabel)}
              </button>
              <button
                onClick={onDismiss}
                className="w-full py-2.5 rounded-xl bg-muted text-muted-foreground font-medium text-sm hover:bg-muted/80 transition-colors"
              >
                {tx(" Not now ")}</button>
            </div>

            <p className="text-[11px] text-muted-foreground text-center mt-3 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              {tx(" Your privacy is protected. Data is only used for your complaint. ")}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PermissionPrompt;
