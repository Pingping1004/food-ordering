self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  let payload = {};

  try {
    payload = event.data.json();
  } catch (error) {
    payload = { title: "New Order", body: event.data.text() };
  }

  const data = payload.data || {};
  const title = payload.title || data.title || "New Order";
  const body = payload.body || data.body || "A new order is waiting";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.svg",
      badge: "/icons/badge.svg",
      tag: `${data.type || "push"}-${data.orderId || "event"}`,
      renotify: true,
      data,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const restaurantId = data.restaurantId || "";
  const orderId = data.orderId || "";
  const targetPath = restaurantId ? `/cooker/${restaurantId}?orderId=${orderId}&event=${data.type || ""}` : "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.postMessage({
            type: "notification-click",
            data,
          });

          if (client.url.includes(`/cooker/${restaurantId}`)) {
            return client.focus();
          }
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetPath);
      }

      return undefined;
    }),
  );
});
