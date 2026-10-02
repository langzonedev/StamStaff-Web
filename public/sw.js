const CACHE_NAME = "stamstaff-shell-v8";
const SCOPE = self.registration.scope;
const SHELL = ["offline.html", "icon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png"].map((path) =>
  new URL(path, SCOPE).toString(),
);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME &&
              (key.startsWith("stamstaff-") || key.startsWith("stampstaff-prototype-")))
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(new URL("offline.html", SCOPE))),
  );
});
