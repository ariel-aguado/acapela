import tailwindcss from "@tailwindcss/vite";
import { isDevelopment } from "std-env";

import "./lib/env";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  ssr: false,
  devtools: { enabled: true },
  app: {
    head: {
      viewport: "width=device-width,initial-scale=1,viewport-fit=cover",
      link: [
        { rel: "icon", href: "/favicon.ico", sizes: "any" },
        { rel: "icon", type: "image/svg+xml", href: "/logo.svg" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      ],
      meta: [
        // Browser / status bar = page background of each theme (see
        // app/plugins/theme-color.client.ts for an explicit Claro / Oscuro).
        { name: "theme-color", media: "(prefers-color-scheme: light)", content: "#ffffff" },
        { name: "theme-color", media: "(prefers-color-scheme: dark)", content: "#0f172a" },
        { name: "apple-mobile-web-app-status-bar-style", content: "default" },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-title", content: "Acapela" },
        { name: "format-detection", content: "telephone=no" },
        // open graph social image
        { property: "og:url", content: "https://acapela.app" },
        { property: "og:title", content: "Acapela" },
        { name: "description", content: "Cantemos juntos, a capela: himnos y cánticos espirituales sin instrumentos y a una voz. Letra grande y clara, sin conexión y gratis." },
        { property: "og:description", content: "Cantemos juntos, a capela. Himnos y cánticos espirituales, sin instrumentos y a una voz." },
        { property: "og:type", content: "website" },
        { property: "og:image", content: "https://acapela.app/og-image.png?v=2" },
        { property: "og:image:type", content: "image/png" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: "Acapela: Cantemos juntos, a capela. Un teléfono muestra un himno abierto." },
        { property: "og:site_name", content: "Acapela" },
        { property: "og:locale", content: "es_UY" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Acapela" },
        { name: "twitter:description", content: "Cantemos juntos, a capela. Himnos y cánticos espirituales, sin instrumentos y a una voz." },
        { name: "twitter:image", content: "https://acapela.app/og-image.png?v=2" },
      ],
    },
    pageTransition: {
      name: "android",
      mode: "out-in",
    },
  },
  modules: [
    "@nuxt/eslint",
    // Nuxt UI brings @nuxt/icon and @nuxtjs/color-mode with it.
    "@nuxt/ui",
    "@pinia/nuxt",
    "@vueuse/nuxt",
    "@nuxt/fonts",
    "@vite-pwa/nuxt",
  ],
  css: [
    "~/assets/css/main.css",
  ],
  eslint: {
    config: {
      standalone: false,
    },
  },
  vite: {
    plugins: [
      tailwindcss(),
    ],
  },
  routeRules: {
    // The service list was removed; links shared before open the app.
    "/list": { redirect: "/" },
  },
  icon: {
    // Ship every icon the code uses inside the app bundle, so they show
    // offline from the very first launch (instead of being fetched).
    clientBundle: {
      scan: true,
      sizeLimitKb: 256,
    },
  },
  // Downloaded at build time and served from our own origin (offline-first).
  // `global: true`: the active face comes from a CSS variable set by the
  // reading settings (see main.css), so the module's scan would not find
  // the others. Latin only (Spanish lyrics); the lyric faces with italic,
  // used by the choruses.
  fonts: {
    defaults: {
      subsets: ["latin"],
    },
    families: [
      // Interface (default) and lyrics (default).
      {
        name: "Inter",
        provider: "google",
        global: true,
        weights: [300, 400, 500, 700, 900],
        styles: ["normal", "italic"],
      },
      {
        name: "Literata",
        provider: "google",
        global: true,
        weights: [400, 600],
        styles: ["normal", "italic"],
      },
      // Lyrics (Ajustes › Letra › Himnos).
      {
        name: "Roboto Serif",
        provider: "google",
        global: true,
        weights: [400, 600],
        styles: ["normal", "italic"],
      },
      {
        name: "Merriweather",
        provider: "google",
        global: true,
        weights: [400, 600],
        styles: ["normal", "italic"],
      },
      // Lyrics and interface.
      {
        name: "Roboto",
        provider: "google",
        global: true,
        weights: [400, 500, 600, 700],
        styles: ["normal", "italic"],
      },
      {
        name: "Open Sans",
        provider: "google",
        global: true,
        weights: [400, 500, 600, 700],
        styles: ["normal", "italic"],
      },
      {
        name: "Figtree",
        provider: "google",
        global: true,
        weights: [400, 500, 600, 700],
        styles: ["normal", "italic"],
      },
      // Interface only (made for low vision).
      {
        name: "Atkinson Hyperlegible",
        provider: "google",
        global: true,
        weights: [400, 700],
        styles: ["normal"],
      },
    ],
  },
  sourcemap: isDevelopment,

  pwa: {
    registerType: "autoUpdate",
    injectRegister: "auto",
    // @vite-pwa/nuxt 2: our own TypeScript worker is built with "buildSW"
    // (injectManifest is only for an existing, already-built worker).
    strategies: "buildSW",
    filename: "sw.js",
    manifest: {
      id: "/",
      name: "Acapela",
      short_name: "Acapela",
      description: "Cantemos juntos, a capela: himnos y cánticos espirituales sin instrumentos y a una voz. Letra grande y clara, sin conexión y gratis.",
      start_url: "/?source=pwa",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      lang: "es",
      dir: "ltr",
      // Launch screen: the brand colour with the white mark (also avoids a
      // white flash for people using the phone in dark mode).
      theme_color: "#4f34b4",
      background_color: "#4f34b4",
      categories: ["music", "lifestyle"],
      // Generated from the mark by scripts/brand-assets.mjs.
      icons: [
        { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
        { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
        {
          src: "pwa-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "maskable-icon-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
      screenshots: [
        {
          src: "screenshots/reading.png",
          sizes: "1080x1920",
          type: "image/png",
          form_factor: "narrow",
          label: "Lee y canta cada himno con letra grande y clara",
        },
        {
          src: "screenshots/search.png",
          sizes: "1080x1920",
          type: "image/png",
          form_factor: "narrow",
          label: "Encuentra un himno por número, título o una frase",
        },
        {
          src: "screenshots/dark.png",
          sizes: "1080x1920",
          type: "image/png",
          form_factor: "narrow",
          label: "Tamaño, interlineado y letra a tu medida",
        },
        {
          src: "screenshots/wide.png",
          sizes: "1920x1080",
          type: "image/png",
          form_factor: "wide",
          label: "Proyecta la letra en la pantalla",
        },
      ],
      // The installed app opens the home page; "Cantar" goes straight back
      // to the last hymn (long-press the app icon).
      shortcuts: [
        {
          name: "Seguir cantando",
          short_name: "Cantar",
          description: "Abrir el último himno",
          url: "/cantar?source=shortcut",
          icons: [
            { src: "shortcut-sing.png", sizes: "96x96", type: "image/png" },
          ],
        },
        {
          name: "Buscar himno",
          short_name: "Buscar",
          description: "Buscar por número, título o una frase de la letra",
          url: "/search?source=shortcut",
          icons: [
            { src: "shortcut-search.png", sizes: "96x96", type: "image/png" },
          ],
        },
        {
          name: "Favoritos",
          short_name: "Favoritos",
          description: "Tus himnos guardados",
          url: "/favorites?source=shortcut",
          icons: [
            { src: "shortcut-favorites.png", sizes: "96x96", type: "image/png" },
          ],
        },
      ],
    },
    buildSW: {
      swSrc: "app/sw.ts",
      globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2}"],
      // Install-time images (store screenshots, link preview) are not
      // needed offline.
      globIgnores: ["**/screenshots/**", "**/og-image.png"],
    },
    devOptions: {
      enabled: false,
    },
    client: {
      // We capture `beforeinstallprompt` ourselves in `use-pwa-install.ts`,
      // so disable the plugin's duplicate listener.
      installPrompt: false,
    },
  },
});
