import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";

import { BIBLE_MANIFEST_CACHE_NAME } from "../lib/bible";

declare const self: ServiceWorkerGlobalScope;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Precache all injected assets
precacheAndRoute(self.__WB_MANIFEST);

// Songbook files - SWR (one cache entry per songbook)
registerRoute(
  ({ url }) => /^\/songs\/songbook(?:-.+)?\.txt$/i.test(url.pathname),
  new StaleWhileRevalidate({
    cacheName: "songbook-cache-v1",
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 32,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  }),
  "GET",
);

// Songbook manifest - SWR
registerRoute(
  ({ url }) => url.pathname === "/songs/manifest.json",
  new StaleWhileRevalidate({
    cacheName: "songbook-manifest-cache-v1",
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 1,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  }),
  "GET",
);

// Bibles. The .sqlite files do NOT go through the service worker: the Bible
// worker downloads, caches and imports them itself (app/workers/bible.worker.ts),
// because Workbox caches with response.clone() while the download is still
// arriving, and reading two copies at once crashes the tab in Firefox.
//
// The version list and each book index: network first, so a new build of a
// version is seen at once; the cached copy when offline.
registerRoute(
  ({ url }) => url.pathname === "/bibles/manifest.json" || /^\/bibles\/.+\.books\.json$/i.test(url.pathname),
  new NetworkFirst({
    cacheName: BIBLE_MANIFEST_CACHE_NAME,
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
  "GET",
);

// SQLite's wasm (hashed name): not precached, since the hymnal never needs
// it, but kept the first time a Bible is used so it opens offline later.
registerRoute(
  ({ url }) => url.origin === self.location.origin && /\/_nuxt\/.+\.wasm$/i.test(url.pathname),
  new CacheFirst({
    cacheName: "wasm-cache-v1",
    plugins: [
      new CacheableResponsePlugin({
        statuses: [200],
      }),
      new ExpirationPlugin({ maxEntries: 4 }),
    ],
  }),
  "GET",
);

// Google Fonts
registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com",
  new StaleWhileRevalidate({
    cacheName: "google-fonts-stylesheets-v1",
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  }),
  "GET",
);

registerRoute(
  ({ url }) => url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: "google-fonts-webfonts-v1",
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
  "GET",
);

// Images
registerRoute(
  ({ request }) => request.destination === "image",
  new CacheFirst({
    cacheName: "images-cache-v1",
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  }),
);
