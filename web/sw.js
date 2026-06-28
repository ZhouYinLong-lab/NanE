/* NanE Service Worker — offline support via cache-first strategy */

const CACHE_VERSION = "nane-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const APP_SHELL = [
  "/",
  "/web/index.html",
  "/web/manifest.json",
  "/web/app.js",
  "/web/js/utils/escape.js",
  "/web/js/utils/date.js",
  "/web/js/utils/validate.js",
  "/web/js/api/client.js",
  "/web/js/ui/motion.js",
  "/web/js/ui/toast.js",
  "/web/js/ui/dialog.js",
  "/web/js/ui/skeleton.js",
  "/web/js/views/home.js",
  "/web/js/views/publish.js",
  "/web/js/views/mine.js",
  "/web/js/views/settings.js",
  "/web/css/tokens.css",
  "/web/css/base.css",
  "/web/css/layout.css",
  "/web/css/components.css",
  "/web/css/fa-subset.css",
  "/web/NanE-logo.svg",
  "/assets/brand/web-logo.png",
  "/assets/brand/nane-logo.png",
  "/assets/fontawesome/fa-solid-900.woff2"
];

const API_PREFIX = "/api/";

// ── Install: cache app shell ──────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(APP_SHELL);
    }).catch((err) => {
      console.error("[SW] Failed to cache app shell:", err);
    })
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  return self.clients.claim();
});

// ── Fetch: serve from cache, fall back to network ────────────────

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API requests — network-first, cache fallback for offline
  if (url.pathname.startsWith(API_PREFIX)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Static assets — cache-first
  if (
    url.origin === self.location.origin &&
    isStaticAsset(url.pathname)
  ) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Everything else — network-only
  event.respondWith(fetch(event.request).catch(() => {
    return caches.match("/");
  }));
});

// ── Strategies ────────────────────────────────────────────────────

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("离线中", { status: 503, statusText: "Offline" });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: "OFFLINE", message: "当前处于离线状态，请连接网络后重试" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

function isStaticAsset(pathname) {
  // Cache CSS, JS, fonts, images, and the manifest
  return (
    pathname === "/" ||
    pathname.startsWith("/web/") ||
    pathname.startsWith("/assets/")
  );
}
