"use client";
/* eslint-disable jsx-a11y/label-has-associated-control -- each compact toggle uses matching htmlFor and id values */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { DiaryService } from "@/lib/data/diary-service";
import { notificationCategoryIcon, notificationCategoryLabel, notificationTarget, notificationTime } from "@/lib/notifications/notification-centre";
import { NotificationService } from "@/lib/notifications/notification-service";
import { defaultNotificationPreferences, type NotificationCategory, type NotificationPreferences, type PushNotificationCategory, type SetraNotification } from "@/lib/notifications/types";
import { disablePushOnThisDevice, enablePushOnThisDevice, pushDeviceMessage, pushDeviceState, type PushDeviceState } from "@/lib/notifications/push-client";
import { createSetraTheme, useResolvedAppearance } from "@/lib/setra/appearance";
import "./notifications.css";

const categories = Object.keys(defaultNotificationPreferences.inApp) as NotificationCategory[];

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const service = useMemo(() => (user ? new NotificationService() : null), [user]);
  const [items, setItems] = useState<SetraNotification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultNotificationPreferences);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deviceState, setDeviceState] = useState<PushDeviceState>("checking");
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [accent, setAccent] = useState("#409ECE");
  const [appearance, setAppearance] = useState<"light" | "dark" | "system">("system");
  const [textScale, setTextScale] = useState<1 | 1.1 | 1.2 | 1.3>(1);
  const resolved = useResolvedAppearance(appearance);
  const refresh = useCallback(async () => {
    if (!service || !user) return;
    setLoading(true); setMessage("");
    try {
      const [notifications, preferenceValue, profile] = await Promise.all([service.list(), service.preferences(), new DiaryService(user.id).loadProfile()]);
      setItems(notifications); setHasMore(notifications.length === 30); setPreferences(preferenceValue);
      setAccent(profile.appColour); setAppearance(profile.appearanceMode); setTextScale(profile.textScale);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Notifications could not be loaded."); }
    finally { setLoading(false); }
  }, [service, user]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { if (typeof window !== "undefined") void pushDeviceState().then(setDeviceState).catch(() => setDeviceState("unsupported")); }, []);
  const changed = () => window.dispatchEvent(new Event("setra:notifications-changed"));
  const open = async (item: SetraNotification) => {
    if (!service) return;
    try { if (!item.readAt) await service.markRead(item.id); setItems(current => current.map(value => value.id === item.id ? { ...value, readAt: new Date().toISOString() } : value)); changed(); } catch { /* Navigation remains available if acknowledgement is delayed. */ }
    const target = notificationTarget(item);
    if (target) router.push(target); else setMessage("That item is no longer available, but the notification has been kept for your records.");
  };
  const dismiss = async (item: SetraNotification) => {
    if (!service) return;
    try { await service.dismiss(item.id); setItems(current => current.filter(value => value.id !== item.id)); changed(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "That notification could not be dismissed."); }
  };
  const markAll = async () => {
    if (!service) return;
    try { await service.markAllRead(); const now = new Date().toISOString(); setItems(current => current.map(item => ({ ...item, readAt: item.readAt || now }))); changed(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Notifications could not be updated."); }
  };
  const loadMore = async () => {
    if (!service || loadingMore || !items.length) return;
    setLoadingMore(true);
    try { const older = await service.list(items.at(-1)?.createdAt, 30); setItems(current => [...current, ...older.filter(item => !current.some(existing => existing.id === item.id))]); setHasMore(older.length === 30); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Older notifications could not be loaded."); }
    finally { setLoadingMore(false); }
  };
  const savePreferences = async () => {
    if (!service || saving) return;
    setSaving(true); setMessage("");
    try { await service.savePreferences(preferences); setMessage("Notification settings saved."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Notification settings could not be saved."); }
    finally { setSaving(false); }
  };
  const enableDevice = async () => {
    if (deviceBusy) return; setDeviceBusy(true); setMessage("");
    try { await enablePushOnThisDevice(); setDeviceState("subscribed"); setMessage("Push notifications are enabled on this device."); }
    catch (error) { setDeviceState(await pushDeviceState().catch((): PushDeviceState => "unsupported")); setMessage(error instanceof Error ? error.message : "Push notifications could not be enabled."); }
    finally { setDeviceBusy(false); }
  };
  const disableDevice = async () => {
    if (deviceBusy) return; setDeviceBusy(true); setMessage("");
    try { await disablePushOnThisDevice(); setDeviceState("unsubscribed"); setMessage("Push notifications are off on this device."); }
    catch { setMessage("This device could not be removed from push notifications."); }
    finally { setDeviceBusy(false); }
  };
  const visible = filter === "unread" ? items.filter(item => !item.readAt) : items;
  const unread = items.filter(item => !item.readAt).length;
  return <main className="notification-screen" style={createSetraTheme(accent, resolved, textScale)} data-theme={resolved}>
    <header className="notification-header"><Link href="/" aria-label="Back to Setra">‹</Link><div><small>ACTIVITY</small><b>Notifications</b></div><Link href="/profile" aria-label="Open profile">◎</Link></header>
    <div className="notification-content">
      <section className="notification-intro"><div><span>NOTIFICATION CENTRE</span><h1>What needs your attention.</h1><p>Training, coaching, friends and milestones in one reliable place.</p></div>{unread > 0 && <button onClick={() => void markAll()}>Mark all read</button>}</section>
      <nav className="notification-tabs" aria-label="Notification filters"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button><button className={filter === "unread" ? "active" : ""} onClick={() => setFilter("unread")}>Unread {unread > 0 && <b>{unread}</b>}</button></nav>
      {message && <p className="notification-message" role="status">{message}</p>}
      {loading ? <p className="notification-empty">Loading notifications...</p> : <section className="notification-list">
        {visible.map(item => <article key={item.id} className={item.readAt ? "is-read" : "is-unread"}>
          <button className="notification-main" onClick={() => void open(item)}>
            <i aria-hidden="true">{notificationCategoryIcon[item.category]}</i><span><small>{notificationCategoryLabel[item.category]}</small><b>{item.title}</b>{item.body && <p>{item.body}</p>}<time>{notificationTime(item.updatedAt || item.createdAt)}</time></span>{!item.readAt && <em aria-label="Unread" />}
          </button>
          <button className="notification-dismiss" onClick={() => void dismiss(item)} aria-label={`Dismiss ${item.title}`}>×</button>
        </article>)}
        {!visible.length && <p className="notification-empty">{filter === "unread" ? "You are all caught up." : "Notifications will appear here when there is something useful to see."}</p>}
        {hasMore && filter === "all" && <button className="notification-more" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Loading..." : "Load older"}</button>}
      </section>}
      <section className="notification-settings"><header><span>NOTIFICATION SETTINGS</span><h2>Choose how Setra notifies you</h2><p>Push is optional and separate for each device.</p></header>
        <div className="notification-setting-head"><span>Category</span><b>In-app</b><b>Push</b></div>
        {categories.map(category => <div className="notification-setting-row" key={category}><span><b>{notificationCategoryLabel[category]}</b><small>{category === "training" ? "Assignments, program changes and weekly reviews" : category === "coaching" ? "Feedback, comments, check-ins and relationships" : category === "social" ? "Friend requests and shared training" : "Awards and meaningful milestones"}</small></span>
          <label htmlFor={`notification-inapp-${category}`} aria-label={`${notificationCategoryLabel[category]} in-app notifications`}><input id={`notification-inapp-${category}`} type="checkbox" checked={preferences.inApp[category]} onChange={event => setPreferences(current => ({ ...current, inApp: { ...current.inApp, [category]: event.target.checked } }))}/><i /></label>
          {category === "awards" ? <em>Not used</em> : <label htmlFor={`notification-push-${category}`} aria-label={`${notificationCategoryLabel[category]} push notifications`}><input id={`notification-push-${category}`} type="checkbox" checked={preferences.push[category as PushNotificationCategory]} onChange={event => setPreferences(current => ({ ...current, push: { ...current.push, [category]: event.target.checked } }))}/><i /></label>}
        </div>)}
        <div className="notification-reminder"><label htmlFor="session-reminder"><span><b>Planned session reminder</b><small>Only sessions with a planned start time can send a reminder.</small></span><select id="session-reminder" value={preferences.sessionReminderOffset ?? "off"} onChange={event => setPreferences(current => ({ ...current, push: { ...current.push, training: event.target.value === "off" ? current.push.training : true }, sessionReminderOffset: event.target.value === "off" ? null : Number(event.target.value) as 0 | 30 | 60 }))}><option value="off">Off</option><option value="0">At session time</option><option value="30">30 min before</option><option value="60">1 hour before</option></select></label></div>
        <div className="push-device"><span><b>Push on this device</b><small>{pushDeviceMessage(deviceState)}</small></span>{deviceState === "subscribed" ? <button disabled={deviceBusy} onClick={() => void disableDevice()}>Turn off</button> : <button disabled={deviceBusy || !["prompt","unsubscribed"].includes(deviceState)} onClick={() => void enableDevice()}>{deviceBusy ? "Enabling..." : ["prompt","unsubscribed"].includes(deviceState) ? "Enable push" : "Unavailable"}</button>}</div>
        <button disabled={saving} onClick={() => void savePreferences()}>{saving ? "Saving..." : "Save notification settings"}</button>
      </section>
    </div>
  </main>;
}
