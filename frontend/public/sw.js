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

console.log("sw.js: Starting Firebase initialization in Service Worker...");

const firebaseApp = initializeApp(firebaseConfig);
console.log("sw.js: firebaseApp object after initializeApp:", firebaseApp);

let messaging;
try {
  messaging = getMessaging(firebaseApp);
  console.log("sw.js: messaging object after getMessaging:", messaging);
  console.log("sw.js: Type of messaging object:", typeof messaging);
  console.log("sw.js: Does messaging have onBackgroundMessage method? ", typeof messaging.onBackgroundMessage);
  console.log("sw.js: Does onBackgroundMessage function exist? ", typeof onBackgroundMessage);
} catch (error) {
  console.error("sw.js: Error getting messaging instance:", error);
  throw error;
}


self.addEventListener("install", () => {
  console.log("sw.js: install event fired.");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("sw.js: activate event fired.");
  event.waitUntil(self.clients.claim());
});

// Bypass Firebase's wrapper and handle the push event natively
self.addEventListener('push', (event) => {
  console.log('[sw.js] Raw push event received');

  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    console.error("Failed to parse push data", e);
  }

  const notificationData = payload.data || {};
  const notificationTitle = notificationData.title || "New Order";
  const notificationBody = notificationData.body || "A new order is waiting";

  const notificationOptions = {
    body: notificationBody,
    icon: "/icons/icon-192.svg",
    tag: `${notificationData.type || "push"}-${notificationData.orderId || "event"}`,
    renotify: true,
    data: notificationData,
    silent: false,           // Demand sound
    requireInteraction: true // Demand it stays on screen
  };

  // event.waitUntil is CRITICAL. This is what stops the "site has been updated" warning.
  event.waitUntil(
    self.registration.showNotification(notificationTitle, notificationOptions)
  );
});


self.addEventListener("notificationclick", (event) => {
  console.log("sw.js: Notification clicked.", event.notification);
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
