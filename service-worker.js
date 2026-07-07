const CACHE_NAME = "alfred-v2.5.1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./data.js",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./assets/brand/alfred-logo.svg",
  "./assets/brand/alfred-icon.svg",
  "./assets/pompes.mp4",
  "./assets/rowing-haltere.mp4",
  "./assets/developpe-epaules.mp4",
  "./assets/tractions.png",
  "./assets/planche.jpg",
  "./assets/dead-bug.webp",
  "./assets/squats.webp",
  "./assets/fentes-arrieres.png",
  "./assets/souleve-terre-roumain.png.webp",
  "./assets/gainage-lateral.jpeg",
  "./assets/velo-appartement.jpg"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
