export type PushDeviceState = "checking" | "requires_install" | "insecure" | "unsupported" | "denied" | "prompt" | "subscribed" | "unsubscribed";

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const pushPrerequisiteState = (environment: { secure: boolean; ios: boolean; standalone: boolean; supported: boolean }): PushDeviceState | null => {
  if (!environment.secure) return "insecure";
  if (environment.ios && !environment.standalone) return "requires_install";
  if (!environment.supported) return "unsupported";
  return null;
};

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
  const prerequisite = pushPrerequisiteState({ secure: window.isSecureContext, ios: isIos(), standalone: isStandalone(), supported: "serviceWorker" in navigator && "PushManager" in window && "Notification" in window });
  if (prerequisite) return prerequisite;
  if (Notification.permission === "denied") return "denied";
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) return "subscribed";
  return Notification.permission === "default" ? "prompt" : "unsubscribed";
};

export const pushDeviceMessage = (state: PushDeviceState) => {
  if (state === "checking") return "Checking this device...";
  if (state === "requires_install") return "On iPhone or iPad, open Setra in Safari, choose Add to Home Screen, then open the installed Setra app to enable push.";
  if (state === "insecure") return "Push requires Setra to be opened over a secure HTTPS connection.";
  if (state === "unsupported") return "This browser does not support Web Push. Try an up-to-date version of Safari, Chrome, Edge or Firefox.";
  if (state === "denied") return isIos() ? "Push permission was previously denied. Re-enable Setra in iPhone Settings > Notifications, then return here." : "Push permission was previously denied. Re-enable Setra in your browser notification settings, then return here.";
  if (state === "subscribed") return "Push is enabled on this device.";
  return "Push is available but not enabled on this device.";
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
