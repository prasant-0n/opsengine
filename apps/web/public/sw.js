// OpsEngine Progressive Web App — Production Service Worker
// Version: opsengine-v1.42.0

const CACHE_NAME = "opsengine-v1.42.0";
const OFFLINE_FALLBACK_URL = "/offline";

const PRECACHE_ASSETS = [
  "/",
  "/manifest.json",
  OFFLINE_FALLBACK_URL,
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
  "/logo.svg",
];

// 1. Install Event: Pre-cache core shell & assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Clean up stale caches and claim clients immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Intelligent offline caching strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin or non-GET requests
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Handle HTML document navigation requests (Network-First with Offline Fallback)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        const offlineFallback = await caches.match(OFFLINE_FALLBACK_URL);
        if (offlineFallback) {
          return offlineFallback;
        }
        return new Response("You are offline and no cached content is available.", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        });
      })
    );
    return;
  }

  // Handle static assets (images, icons, styles, scripts) — Stale-While-Revalidate
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|css|js|woff2)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});

// 4. Web Push Notification Event
self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (_err) {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || "OpsEngine Notification";
  const options = {
    body: data.body || "New operational update waiting in OpsEngine.",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    tag: data.tag || "opsengine-notification",
    data: data.data || { url: data.url || "/dashboard" },
    vibrate: [100, 50, 100],
    actions: data.actions || [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 5. Notification Click Handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Focus existing tab if open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          if (client.url !== targetUrl && "navigate" in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Otherwise open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
