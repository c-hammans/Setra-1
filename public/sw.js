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
  const target = new URL(event.notification.data?.url || "/notifications", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(windows => {
    const existing = windows.find(windowClient => new URL(windowClient.url).origin === self.location.origin);
    if (existing) return existing.navigate(target).then(client => client.focus());
    return clients.openWindow(target);
  }));
});
