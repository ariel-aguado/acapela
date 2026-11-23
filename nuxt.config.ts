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
        { name: "theme-color", media: "(prefers-color-scheme: dark)", content: "#1d232a" },
        { name: "apple-mobile-web-app-status-bar-style", content: "default" },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-title", content: "Acapela" },
        { name: "format-detection", content: "telephone=no" },
        // open graph social image
        { property: "og:url", content: "https://acapela.app" },
        { property: "og:title", content: "Acapela" },
        { name: "description", content: "Himnos y cánticos espirituales. El himnario de tu iglesia, siempre a mano y sin conexión." },
        { property: "og:description", content: "Himnos y cánticos espirituales. El himnario de tu iglesia, siempre a mano." },
        { property: "og:type", content: "website" },
        { property: "og:image", content: "https://acapela.app/og-image.png" },
        { property: "og:image:type", content: "image/png" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: "Acapela: himnos y cánticos espirituales" },
        { property: "og:site_name", content: "Acapela" },
        { property: "og:locale", content: "es_UY" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Acapela" },
        { name: "twitter:description", content: "Himnos y cánticos espirituales. El himnario de tu iglesia, siempre a mano." },
        { name: "twitter:image", content: "https://acapela.app/og-image.png" },
      ],
    },
    pageTransition: {
      name: "android",
      mode: "out-in",
    },
  },
  modules: [
    "@nuxt/eslint",
    "@nuxt/icon",
    "@nuxtjs/color-mode",
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
  colorMode: {
    dataValue: "theme",
  },
  fonts: {
    families: [
      {
        name: "Inter",
        provider: "google",
        weights: [300, 400, 500, 700, 900],
        styles: ["normal", "italic"],
        subsets: ["latin"],
      },
      {
        // Reading face for hymn lyrics (designed for long reading on screens).
        name: "Literata",
        provider: "google",
        weights: [400, 600],
        styles: ["normal", "italic"],
        subsets: ["latin"],
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
      description: "Himnos y cánticos espirituales. El himnario de tu iglesia, siempre a mano y sin conexión.",
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
          label: "Tamaño de letra y tema oscuro a tu medida",
        },
        {
          src: "screenshots/wide.png",
          sizes: "1920x1080",
          type: "image/png",
          form_factor: "wide",
          label: "Proyecta la letra para toda la congregación",
        },
      ],
      shortcuts: [
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
