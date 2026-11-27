self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const title = typeof payload.title === "string" ? payload.title : "Setra";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "You have a new notification.",
    icon: "/app-icon-v4-192.png",
    badge: "/app-icon-v4-192.png",
    tag: typeof payload.notificationId === "string" ? `setra-${payload.notificationId}` : undefined,
    renotify: false,
    data: { url: typeof payload.url === "string" && payload.url.startsWith("/") ? payload.url : "/notifications" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  let target = new URL("/notifications", self.location.origin);
  try {
    const candidate = new URL(event.notification.data?.url || "/notifications", self.location.origin);
    if (candidate.origin === self.location.origin) target = candidate;
  } catch { /* Keep the in-app fallback. */ }
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(windows => {
    const existing = windows.find(windowClient => new URL(windowClient.url).origin === self.location.origin);
    if (existing) return existing.navigate(target.href).then(client => client ? client.focus() : clients.openWindow(target.href));
    return clients.openWindow(target.href);
  }));
});
