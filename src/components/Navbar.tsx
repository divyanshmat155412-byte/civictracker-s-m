import { useState } from "react";
import { Link, useLocation } from "@/lib/router-compat";
import { Menu, X, MapPin, LogIn, LogOut, User, Shield, Globe, Bot } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
import NotificationBell from "@/components/NotificationBell";
import type { TranslationKey } from "@/lib/translations";

const NAV_LINKS: { to: string; labelKey: TranslationKey }[] = [
  { to: "/", labelKey: "nav.home" },
  { to: "/complaints", labelKey: "nav.complaints" },
  { to: "/map", labelKey: "nav.map" },
  { to: "/dashboard", labelKey: "nav.dashboard" },
  { to: "/leaderboard", labelKey: "nav.leaderboard" },
  { to: "/how-it-works", labelKey: "nav.howItWorks" },
  { to: "/faq", labelKey: "nav.faq" },
  { to: "/contact", labelKey: "nav.contact" },
  { to: "/ai-chat", labelKey: "nav.aiChat" },
  { to: "/install", labelKey: "nav.install" },
  { to: "/rewards", labelKey: "nav.rewards" },
  { to: "/predictions", labelKey: "nav.predictions" },
  { to: "/polls", labelKey: "nav.polls" },
  { to: "/heatmap", labelKey: "nav.heatmap" as TranslationKey },
  { to: "/departments", labelKey: "nav.departments" as TranslationKey },
  { to: "/worker", labelKey: "nav.worker" as TranslationKey },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { isAdmin } = useUserRole();

  const toggleLanguage = () => setLanguage(language === "en" ? "hi" : "en");

  return (
    <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
      <div className="container flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg gradient-hero flex items-center justify-center">
            <MapPin className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display font-bold text-foreground text-base tracking-tight">
              CT — <span className="text-secondary">City</span>
            </span>
            <span className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">
              {t("nav.civicTracker")}
            </span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                location.pathname === link.to
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {t(link.labelKey)}{link.to === "/departments" && <span className="ml-1 text-[10px] opacity-70">· {t("dept.inProgress")}</span>}
            </Link>
          ))}
          {!isAdmin && (
            <Link
              to="/request-admin"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                location.pathname === "/request-admin"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Shield className="w-4 h-4" /> {t("nav.requestAdmin")}
            </Link>
          )}
          {isAdmin && (
            <>
              <Link
                to="/admin"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                  location.pathname === "/admin"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Shield className="w-4 h-4" /> {t("nav.admin")}
              </Link>
              <Link
                to="/reports"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                  location.pathname === "/reports"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                📊 Reports
              </Link>
            </>
          )}

          {/* Language Toggle */}
          <button
            onClick={toggleLanguage}
            className="group relative ml-1 px-3 py-1.5 rounded-full text-xs font-bold border-2 border-primary/30 bg-gradient-to-r from-primary/10 to-accent/10 hover:from-primary/20 hover:to-accent/20 hover:border-primary/60 transition-all duration-300 flex items-center gap-1.5 shadow-sm hover:shadow-md overflow-hidden"
            title="Switch language"
          >
            <Globe className="w-3.5 h-3.5 text-primary group-hover:rotate-180 transition-transform duration-500" />
            <span className="relative z-10 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-extrabold tracking-wide">
              {language === "en" ? "हिन्दी" : "EN"}
            </span>
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/5 to-accent/5 group-hover:from-primary/10 group-hover:to-accent/10 transition-all duration-300" />
          </button>

          <NotificationBell />
          {user ? (
            <div className="flex items-center gap-2 ml-1">
              <Link to="/profile" className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted" title="My Profile">
                <User className="w-4 h-4" />
              </Link>
              <button onClick={signOut} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted" title={t("nav.signOut")}>
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              className="ml-1 px-4 py-2 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold"
            >
              {t("nav.signIn")}
            </Link>
          )}
        </nav>

        <div className="md:hidden flex items-center gap-1">
          {/* Mobile language toggle */}
          <button
            onClick={toggleLanguage}
            className="group relative px-3 py-1.5 rounded-full text-xs font-bold border-2 border-primary/30 bg-gradient-to-r from-primary/10 to-accent/10 hover:from-primary/20 hover:to-accent/20 hover:border-primary/60 transition-all duration-300 flex items-center gap-1.5 shadow-sm hover:shadow-md overflow-hidden"
          >
            <Globe className="w-3.5 h-3.5 text-primary group-hover:rotate-180 transition-transform duration-500" />
            <span className="relative z-10 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-extrabold tracking-wide">
              {language === "en" ? "हिन्दी" : "EN"}
            </span>
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/5 to-accent/5 group-hover:from-primary/10 group-hover:to-accent/10 transition-all duration-300" />
          </button>
          <NotificationBell />
          <button
            className="p-2 rounded-md text-foreground hover:bg-muted"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden border-t border-border bg-card"
          >
            <div className="container py-3 flex flex-col gap-1 max-h-[calc(100vh-4rem)] overflow-y-auto overscroll-contain">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={`px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === link.to
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {t(link.labelKey)}{link.to === "/departments" && <span className="ml-1 text-[10px] opacity-70">· {t("dept.inProgress")}</span>}
                </Link>
              ))}
              {!isAdmin && (
                <Link
                  to="/request-admin"
                  onClick={() => setMobileOpen(false)}
                  className={`px-3 py-2.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                    location.pathname === "/request-admin"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Shield className="w-4 h-4" /> {t("nav.requestAdmin")}
                </Link>
              )}
              {isAdmin && (
                <>
                  <Link
                    to="/admin"
                    onClick={() => setMobileOpen(false)}
                    className={`px-3 py-2.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                      location.pathname === "/admin"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Shield className="w-4 h-4" /> {t("nav.admin")}
                  </Link>
                  <Link
                    to="/reports"
                    onClick={() => setMobileOpen(false)}
                    className={`px-3 py-2.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                      location.pathname === "/reports"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    📊 Reports
                  </Link>
                </>
              )}
              {user ? (
                <>
                  <Link
                    to="/profile"
                    onClick={() => setMobileOpen(false)}
                    className={`px-3 py-2.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                      location.pathname === "/profile"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <User className="w-4 h-4" /> My Profile
                  </Link>
                  <button
                    onClick={() => { signOut(); setMobileOpen(false); }}
                    className="px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted text-left flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" /> {t("nav.signOut")}
                  </button>
                </>
              ) : (
                <Link
                  to="/auth"
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2.5 rounded-md text-sm font-semibold gradient-accent text-accent-foreground text-center"
                >
                  {t("nav.signIn")}
                </Link>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
