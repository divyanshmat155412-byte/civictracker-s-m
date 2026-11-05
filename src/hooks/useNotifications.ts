import { useEffect, useState, useCallback } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { notificationDisplay } from "@/lib/notification-display";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  complaint_id: string | null;
  type: string;
  created_at: string;
}

type NotificationSnapshot = {
  notifications: AppNotification[];
  unreadCount: number;
  lastReadAt: string;
};

const DEFAULT_LAST_READ_AT = "2000-01-01T00:00:00Z";

const getStoredLastReadAt = () => {
  if (typeof window === "undefined") return DEFAULT_LAST_READ_AT;
  return localStorage.getItem("notifications_last_read") || DEFAULT_LAST_READ_AT;
};

let snapshot: NotificationSnapshot = {
  notifications: [],
  unreadCount: 0,
  lastReadAt: DEFAULT_LAST_READ_AT,
};

let notificationsChannel: RealtimeChannel | null = null;
let hasFetchedInitialNotifications = false;
let initialFetchPromise: Promise<void> | null = null;
const listeners = new Set<(next: NotificationSnapshot) => void>();

const emitSnapshot = () => {
  listeners.forEach((listener) => listener(snapshot));
};

const setSnapshot = (next: NotificationSnapshot) => {
  snapshot = next;
  emitSnapshot();
};

const updateSnapshot = (partial: Partial<NotificationSnapshot>) => {
  setSnapshot({ ...snapshot, ...partial });
};

const syncUnreadCount = (notifications: AppNotification[], lastReadAt: string) => {
  setSnapshot({
    notifications,
    lastReadAt,
    unreadCount: notifications.filter((notification) => notification.created_at > lastReadAt).length,
  });
};

const ensureSnapshotHydrated = () => {
  const storedLastReadAt = getStoredLastReadAt();
  if (storedLastReadAt !== snapshot.lastReadAt) {
    syncUnreadCount(snapshot.notifications, storedLastReadAt);
  }
};

const ensureInitialNotifications = async () => {
  if (hasFetchedInitialNotifications) return;
  if (!initialFetchPromise) {
    initialFetchPromise = (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (data) {
        hasFetchedInitialNotifications = true;
        syncUnreadCount(data as AppNotification[], snapshot.lastReadAt);
      }
    })().finally(() => {
      initialFetchPromise = null;
    });
  }

  await initialFetchPromise;
};

const showBrowserNotification = (notification: AppNotification) => {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const display = notificationDisplay(notification, document.documentElement.lang === "hi" ? "hi" : "en");
  new Notification(display.title, {
    body: display.body,
    icon: "/favicon.ico",
  });
};

const handleIncomingNotification = (notification: AppNotification) => {
  const notifications = [notification, ...snapshot.notifications].slice(0, 50);
  const unreadCount =
    snapshot.unreadCount + (notification.created_at > snapshot.lastReadAt ? 1 : 0);

  updateSnapshot({ notifications, unreadCount });
  showBrowserNotification(notification);
};

const ensureRealtimeSubscription = () => {
  if (notificationsChannel) return;

  const channelName =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? `notifications-realtime-${crypto.randomUUID()}`
      : `notifications-realtime-${Math.random().toString(36).slice(2)}`;

  notificationsChannel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications" },
      (payload) => handleIncomingNotification(payload.new as AppNotification),
    )
    .subscribe();
};

const cleanupRealtimeSubscription = () => {
  if (!notificationsChannel || listeners.size > 0) return;

  supabase.removeChannel(notificationsChannel);
  notificationsChannel = null;
};

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>(snapshot.notifications);
  const [unreadCount, setUnreadCount] = useState(snapshot.unreadCount);

  useEffect(() => {
    const syncLocalState = (next: NotificationSnapshot) => {
      setNotifications(next.notifications);
      setUnreadCount(next.unreadCount);
    };

    ensureSnapshotHydrated();
    listeners.add(syncLocalState);
    syncLocalState(snapshot);
    void ensureInitialNotifications();
    ensureRealtimeSubscription();

    return () => {
      listeners.delete(syncLocalState);
      cleanupRealtimeSubscription();
    };
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;

    await Notification.requestPermission();
  }, []);

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();

    if (typeof window !== "undefined") {
      localStorage.setItem("notifications_last_read", now);
    }

    syncUnreadCount(snapshot.notifications, now);
  }, []);

  return { notifications, unreadCount, markAllRead, requestPermission };
};
