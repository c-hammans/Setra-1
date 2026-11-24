export type PushDeviceState = "unsupported" | "denied" | "prompt" | "subscribed" | "unsubscribed";

const applicationServerKey = () => {
  const value = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!value) throw new Error("Push notifications are not configured yet.");
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map(character => character.charCodeAt(0)));
};

export const registerSetraServiceWorker = async () => {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
};

export const pushDeviceState = async (): Promise<PushDeviceState> => {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) return "subscribed";
  return Notification.permission === "default" ? "prompt" : "unsubscribed";
};

export const enablePushOnThisDevice = async () => {
  if (!("Notification" in window)) throw new Error("Push notifications are not supported on this device.");
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") throw new Error(permission === "denied" ? "Push permission is blocked in your device settings." : "Push permission was not enabled.");
  const registration = await registerSetraServiceWorker();
  if (!registration) throw new Error("Push notifications are not supported on this device.");
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey() });
  const response = await fetch("/api/push/subscription", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "This device could not be registered for push notifications.");
  return subscription;
};

export const disablePushOnThisDevice = async () => {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await fetch("/api/push/subscription", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) }).catch(() => null);
  await subscription.unsubscribe().catch(() => false);
};
