// D.A.N. service worker — caches the app shell so the dashboard UI still
// loads offline (from a-Shell Mini / Home Screen) even with no network.
// Live data (status, terminal, SSH) always requires a real connection to the
// container — this only keeps the interface itself from going blank.
const CACHE_NAME = "dan-shell-v1";
const APP_SHELL = ["./", "./index.html", "./manifest.json", "./favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Never cache API calls — status/terminal data must always be live.
  if (request.url.includes("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")))
  );
});
