self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});


self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    throw error
  }

  const notificationData = payload.data || {};
  const notificationTitle = notificationData.title || "ออเดอร์เข้าใหม่";
  const notificationBody  = notificationData.body  || "คลิกเพื่อดูรายละเอียดออเดอร์";

  const notificationOptions = {
    body: notificationBody,
    icon: "/favicon.svg",
    tag: `${notificationData.type || "push"}-${notificationData.orderId || "event"}`,
    data: notificationData,
    silent: false,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 400],
  };

  const notifyClients = self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: "PLAY_NOTIFICATION_SOUND" });
      });
    });

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(notificationTitle, notificationOptions),
      notifyClients,
    ])
  );
});


self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data         = event.notification.data || {};
  const restaurantId = data.restaurantId || "";
  const orderId      = data.orderId      || "";
  const targetPath   = restaurantId
    ? `/cooker/${restaurantId}?orderId=${orderId}&event=${data.type || ""}`
    : "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client && client.url.includes(`/cooker/${restaurantId}`)) {
            client.postMessage({ type: "notification-click", data });
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(targetPath);
        }
      })
  );
});