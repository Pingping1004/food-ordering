import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getMessaging, onBackgroundMessage } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-sw.js';

const firebaseConfig = {
  apiKey: "AIzaSyA-la1axSFINRf60fgbv82VZIgAJo0AnpE",
  authDomain: "cooker-cms.firebaseapp.com",
  projectId: "cooker-cms",
  storageBucket: "cooker-cms.appspot.com",
  messagingSenderId: "156046680002",
  appId: "1:156046680002:web:f09ba2e0bd2a850db6005b",
  measurementId: "G-EQ0T23BPDQ",
};

const firebaseApp = initializeApp(firebaseConfig);

try {
  const messaging = getMessaging(firebaseApp);
  // Suppress Firebase's auto-notification so our native push handler
  // is the single source of truth for showing notifications.
  onBackgroundMessage(messaging, () => {});
} catch (error) {
  throw error;
}


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
  const notificationTitle = notificationData.title || "New Order";
  const notificationBody  = notificationData.body  || "A new order is waiting";

  const notificationOptions = {
    body: notificationBody,
    icon: "/icons/icon-192.svg",
    tag: `${notificationData.type || "push"}-${notificationData.orderId || "event"}`,
    renotify: true,
    data: notificationData,
    silent: false,            // let the OS play its default notification sound
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 400],
  };

  // Signal every open tab to play the in-app sound.
  // Done inside event.waitUntil so the SW stays alive long enough to deliver it.
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
          // Only message and focus the tab that matches this restaurant
          if ("focus" in client && client.url.includes(`/cooker/${restaurantId}`)) {
            client.postMessage({ type: "notification-click", data });
            return client.focus();
          }
        }

        // No matching tab open — open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetPath);
        }
      })
  );
});