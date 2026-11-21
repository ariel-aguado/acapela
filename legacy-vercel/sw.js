// Service worker de reemplazo para las direcciones viejas (acappella-*.vercel.app).
// La PWA instalada busca actualizaciones de /sw.js: este se instala, borra la
// caché de la app vieja, se desinstala y recarga las ventanas abiertas, que
// entonces cargan la página de mudanza (index.html) desde la red.
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (event) {
  event.waitUntil((async function () {
    const keys = await caches.keys();
    await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: "window" });
    clients.forEach(function (c) { c.navigate(c.url); });
  })());
});
