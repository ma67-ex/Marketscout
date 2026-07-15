// Market Scout service worker.
//
// Goal: the app shell and its heavy static map data must load with no network.
// The analysis API needs live data, so it is never cached — offline requests
// to it fail fast and the UI falls back to the last saved report instead.
//
// Strategy:
//   - Navigations (the HTML document): network-first, fall back to the cached
//     shell so a reload works offline.
//   - Static GET assets (the /ne_110m_*.json globe data, icons, Next static
//     chunks): stale-while-revalidate — instant from cache, refreshed in the
//     background when online.
//   - /api/*: always network, never cached.
//
// Bump CACHE_VERSION to invalidate old caches on the next activation.

const CACHE_VERSION = "v1";
const CACHE_NAME = `marketscout-${CACHE_VERSION}`;

// Precached at install so the first offline visit still has a shell + globe.
const PRECACHE_URLS = [
  "/",
  "/ne_110m_land.json",
  "/ne_110m_us_states.json",
  "/ne_110m_countries.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // Individual failures (e.g. a 404) must not abort the whole install.
      .then((cache) =>
        Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GET is cacheable; let the network handle everything else.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Same-origin only. Cross-origin (Reddit, Wikipedia, etc.) goes to network.
  if (url.origin !== self.location.origin) return;

  // The analysis and geocode APIs are live-data only — never serve them stale.
  if (url.pathname.startsWith("/api/")) return;

  // Document navigations: network-first with a cached-shell fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(request)) || (await cache.match("/"));
        }),
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
