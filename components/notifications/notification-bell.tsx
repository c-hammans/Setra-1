"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { NotificationService } from "@/lib/notifications/notification-service";
import { createClient } from "@/lib/supabase/client";
import styles from "./notification-bell.module.css";

export function NotificationBell() {
  const { user } = useAuth();
  const service = useMemo(() => (user ? new NotificationService() : null), [user]);
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!service) return;
    let cancelled = false;
    const refresh = async () => {
      try { const value = await service.unreadCount(); if (!cancelled) setCount(value); } catch { if (!cancelled) setCount(0); }
    };
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    void refresh();
    const client = createClient();
    const channel = client.channel(`notifications:${user?.id}`).on("postgres_changes", { event: "*", schema: "public", table: "app_notifications", filter: `user_id=eq.${user?.id}` }, refresh).subscribe();
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("setra:notifications-changed", refresh);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", visible); window.removeEventListener("setra:notifications-changed", refresh); void client.removeChannel(channel); };
  }, [service, user?.id]);
  return <Link className={styles.bell} href="/notifications" aria-label={count ? `${count} unread notifications` : "Open notifications"}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>{count > 0 && <b>{count > 99 ? "99+" : count}</b>}</Link>;
}
