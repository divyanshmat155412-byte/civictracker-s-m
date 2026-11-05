import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@/lib/router-compat";
import { Bell, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNotifications } from "@/hooks/useNotifications";

const NotificationBell = () => {
  const { notifications, unreadCount, markAllRead, requestPermission } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const handleNotificationClick = (n: any) => {
    setOpen(false);
    if (n.complaint_id) {
      navigate(`/complaints`);
    }
  };

  // Request permission on mount
  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const timeAgo = (dateStr: string) => {
    const hours = Math.floor((Date.now() - new Date(dateStr).getTime()) / 3600000);
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) markAllRead();
        }}
        className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed sm:absolute right-2 sm:right-0 top-14 sm:top-12 w-[calc(100vw-1rem)] sm:w-72 max-h-72 overflow-y-auto bg-card rounded-xl border border-border shadow-elevated z-50"
          >
            <div className="p-2.5 border-b border-border flex items-center justify-between">
              <h3 className="font-display font-semibold text-foreground text-xs">Notifications</h3>
              {notifications.length > 0 && (
                <span className="text-[10px] text-muted-foreground">{notifications.length}</span>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-xs">
                No notifications yet
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.slice(0, 10).map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`px-2.5 py-2 hover:bg-muted/50 transition-colors ${n.complaint_id ? "cursor-pointer" : ""}`}
                  >
                    <div className="flex items-start gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                        n.type === "new_complaint" ? "bg-destructive" : "bg-success"
                      }`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground leading-tight line-clamp-1">{n.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{n.body}</p>
                        <span className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />{timeAgo(n.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
