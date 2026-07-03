const CACHE_NAME = "coach-sportif-v1.1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./data.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./assets/dead-bug.webp",
  "./assets/developpe-epaules.mp4",
  "./assets/fentes-arrieres.png",
  "./assets/gainage-lateral.jpeg",
  "./assets/planche.jpg",
  "./assets/pompes.mp4",
  "./assets/rowing-haltere.mp4",
  "./assets/souleve-terre-roumain.png.webp",
  "./assets/squats.webp",
  "./assets/tractions.png",
  "./assets/velo-appartement.jpg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => {
          if (request.mode === "navigate") {
            return caches.match("./index.html");
          }
          return caches.match("./index.html");
        });
    })
  );
});
