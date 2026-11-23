// Generates every brand / install image from Acapela's mark (the A drawn as
// two beamed eighth notes, same paths as app/components/app/brand-mark.vue):
//
//   public/logo.svg, favicon.ico, apple-touch-icon.png
//   public/pwa-64x64.png, pwa-192x192.png, pwa-512x512.png,
//          maskable-icon-512x512.png, shortcut-search.png, shortcut-favorites.png
//   public/screenshots/*.png  (install dialog screenshots, from the real app)
//   public/og-image.png       (link preview, 1200×630)
//
// Run after `pnpm build` (the screenshots come from .output):
//   node scripts/brand-assets.mjs            → everything
//   node scripts/brand-assets.mjs --icons    → icons only (no build needed)

import { spawn } from "node:child_process"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import process from "node:process"
import { setTimeout as sleep } from "node:timers/promises"

const BRAND = "#4f34b4"
const ICONS_ONLY = process.argv.includes("--icons")
const PORT = 4000
const APP = `http://localhost:${PORT}`
const PROFILE = "/tmp/acapela-brand-assets"

const MARK = `<g transform="translate(5 -0.4)">
  <path d="M21 48 32 12 43 48" fill="none" stroke="currentColor" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M23.6 34.5h16.8" fill="none" stroke="currentColor" stroke-width="7"/>
  <ellipse cx="15.2" cy="50.5" rx="7.6" ry="5.6" transform="rotate(-24 15.2 50.5)" fill="currentColor"/>
  <ellipse cx="37.4" cy="50.5" rx="7.6" ry="5.6" transform="rotate(-24 37.4 50.5)" fill="currentColor"/>
</g>`
const mark = (size, color = "#fff") => `<svg viewBox="0 0 64 64" width="${size}" height="${size}" style="color:${color};display:block">${MARK}</svg>`
const TABLER = {
  search: `<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0-14 0m18 11l-6-6"/>`,
  heart: `<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.5 12.572L12 20l-7.5-7.428A5 5 0 1 1 12 6.006a5 5 0 1 1 7.5 6.572"/>`,
}
const FONTS = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Literata:opsz,wght@7..72,600;7..72,700&display=block">`

// ------------------------------------------------------------------ chrome
rmSync(PROFILE, { recursive: true, force: true })
const server = ICONS_ONLY
  ? null
  : spawn("node", [".output/server/index.mjs"], { env: { ...process.env, PORT: String(PORT), NODE_ENV: "production" }, stdio: "ignore" })
const chrome = spawn("/usr/bin/google-chrome", ["--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT + 1}`, "--remote-allow-origins=*", "about:blank"], { stdio: "ignore" })

async function connect() {
  let targets
  for (let i = 0; i < 60 && !targets; i++) {
    try { targets = (await (await fetch(`http://localhost:${PORT + 1}/json`)).json()).filter(t => t.type === "page") }
    catch { await sleep(250) }
  }
  const ws = new WebSocket(targets[0].webSocketDebuggerUrl)
  await new Promise(r => ws.addEventListener("open", r, { once: true }))
  let id = 0
  const pending = new Map()
  ws.addEventListener("message", (m) => {
    const d = JSON.parse(m.data)
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) }
  })
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
  const ev = async e => (await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value
  await send("Page.enable")
  return { ws, send, ev }
}

async function waitUntil(cdp, condition, label, timeoutMs = 30000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    try { if (await cdp.ev(`(() => { try { return !!(${condition}) } catch { return false } })()`) === true) return }
    catch { /* navigating */ }
    await sleep(200)
  }
  throw new Error(`timed out waiting for ${label}`)
}

/** Renders an HTML snippet at width×height CSS px and returns PNG bytes. */
async function render(cdp, html, width, height, { scale = 1, transparent = false } = {}) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: false })
  await cdp.send("Emulation.setDefaultBackgroundColorOverride", transparent ? { color: { r: 0, g: 0, b: 0, a: 0 } } : {})
  await cdp.send("Page.navigate", { url: "about:blank" })
  await waitUntil(cdp, `location.href === "about:blank" && document.readyState === "complete"`, "blank page")
  const { result } = await cdp.send("Page.getFrameTree")
  await cdp.send("Page.setDocumentContent", {
    frameId: result.frameTree.frame.id,
    html: `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;${transparent ? "background:transparent" : ""}}</style></head><body>${html}</body></html>`,
  })
  await waitUntil(cdp, `document.fonts.status === "loaded" && [...document.images].every(i => i.complete)`, "fonts and images")
  await sleep(100)
  const shot = await cdp.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width, height, scale: 1 } })
  return Buffer.from(shot.result.data, "base64")
}

/** ICO container holding PNG images (supported by every current browser). */
function ico(pngs) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(pngs.length, 4)
  const dir = Buffer.alloc(16 * pngs.length)
  let offset = 6 + dir.length
  pngs.forEach(({ size, data }, i) => {
    const o = i * 16
    dir.writeUInt8(size >= 256 ? 0 : size, o)
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1)
    dir.writeUInt16LE(1, o + 4)
    dir.writeUInt16LE(32, o + 6)
    dir.writeUInt32LE(data.length, o + 8)
    dir.writeUInt32LE(offset, o + 12)
    offset += data.length
  })
  return Buffer.concat([header, dir, ...pngs.map(p => p.data)])
}

// ------------------------------------------------------------------ icons
const tile = (size, { radius = "23%", markScale = 0.7, bleed = false } = {}) =>
  `<div style="width:${size}px;height:${size}px;display:grid;place-items:center;background:${BRAND};border-radius:${bleed ? 0 : radius}">${mark(Math.round(size * markScale))}</div>`

async function icons(cdp) {
  // Browser tab icon: the tile (legible on light and dark tab strips).
  writeFileSync("public/logo.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="${BRAND}"/><g transform="translate(9.6 9.6) scale(.7)" color="#fff">${MARK}</g></svg>\n`)

  const out = {
    "pwa-64x64.png": [64, tile(64)],
    "pwa-192x192.png": [192, tile(192)],
    "pwa-512x512.png": [512, tile(512)],
    // Android masks it (circle, squircle…): full bleed, mark inside the
    // safe zone (the centred circle of 80% diameter).
    "maskable-icon-512x512.png": [512, tile(512, { bleed: true, markScale: 0.56 })],
    // iOS rounds the corners itself and does not allow transparency.
    "apple-touch-icon.png": [180, tile(180, { bleed: true, markScale: 0.64 })],
  }
  for (const [file, [size, html]] of Object.entries(out)) {
    writeFileSync(`public/${file}`, await render(cdp, html, size, size, { transparent: true }))
    console.log("✓", file)
  }
  for (const [name, body] of Object.entries(TABLER)) {
    const html = `<div style="width:96px;height:96px;display:grid;place-items:center;background:${BRAND};color:#fff"><svg viewBox="0 0 24 24" width="48" height="48">${body}</svg></div>`
    const file = `shortcut-${name === "heart" ? "favorites" : name}.png`
    writeFileSync(`public/${file}`, await render(cdp, html, 96, 96))
    console.log("✓", file)
  }
  const sizes = [16, 32, 48]
  const pngs = []
  for (const size of sizes)
    pngs.push({ size, data: await render(cdp, tile(size, { radius: size <= 16 ? "3px" : "22%", markScale: size <= 16 ? 0.86 : 0.76 }), size, size, { transparent: true }) })
  writeFileSync("public/favicon.ico", ico(pngs))
  console.log("✓ favicon.ico (16, 32, 48)")
}

// ------------------------------------------------------------------ app captures
const appReady = path => `location.pathname === ${JSON.stringify(path)} && document.readyState === "complete"
  && !document.querySelector(".boot-loader")
  && document.querySelector("header")?.getBoundingClientRect().height > 0
  && getComputedStyle(document.querySelector("#__nuxt main, #__nuxt > div") ?? document.body).opacity === "1"
  && (document.querySelector("#__nuxt")?.__vue_app__?.config.globalProperties.$pinia?._s.get("useSongStore")?.songs.length ?? 0) > 0`

async function capture(cdp, path, { width, height, scale = 3, mobile = true, setup = "", after = "", ready = appReady(path.split("?")[0]) }) {
  await cdp.send("Emulation.setDefaultBackgroundColorOverride", {})
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile })
  await cdp.send("Page.navigate", { url: `${APP}/` })
  await waitUntil(cdp, `location.origin === ${JSON.stringify(APP)} && document.readyState === "complete"`, "app origin")
  await cdp.ev(`(() => { localStorage.clear(); localStorage.setItem("songbookId", "songbook-lavilla"); localStorage.setItem("songIdBySongbook", JSON.stringify({ "songbook-lavilla": 4 })); localStorage.setItem("recentBySongbook", JSON.stringify({ "songbook-lavilla": [4] })); ${setup}; return true })()`)
  await cdp.send("Page.navigate", { url: `${APP}${path}` })
  await sleep(300)
  await waitUntil(cdp, ready, path)
  if (after) {
    await cdp.ev(`(async () => { ${after}; return true })()`)
    await sleep(700)
  }
  // Let the page transition and fonts settle.
  await cdp.ev(`document.fonts.ready.then(() => true)`)
  await sleep(1200)
  const shot = await cdp.send("Page.captureScreenshot", { format: "png" })
  return `data:image/png;base64,${shot.result.data}`
}

const phone = (src, w) => `<div style="width:${w}px;border-radius:${w * 0.11}px;background:#0f0c22;padding:${w * 0.03}px;box-shadow:0 30px 60px -30px rgb(0 0 0/.6)"><img src="${src}" style="display:block;width:100%;border-radius:${w * 0.085}px"></div>`

async function screenshots(cdp) {
  mkdirSync("public/screenshots", { recursive: true })
  const shots = {
    reading: await capture(cdp, "/", { width: 390, height: 780 }),
    search: await capture(cdp, "/search?q=gracia", { width: 390, height: 780 }),
    dark: await capture(cdp, "/", {
      width: 390,
      height: 780,
      setup: `localStorage.setItem("nuxt-color-mode", "dark"); localStorage.setItem("acappellaFontSize", "20")`,
      after: `document.querySelector("[aria-label^='Apariencia']").click()`,
    }),
  }
  const captions = {
    reading: "Lee y canta cada himno con letra grande y clara",
    search: "Encuentra un himno por número, título o una frase",
    dark: "Tamaño de letra y tema oscuro a tu medida",
  }
  // Narrow: 360×640 CSS px at 3× = 1080×1920.
  for (const [name, src] of Object.entries(shots)) {
    const html = `<div style="width:360px;height:640px;background:${BRAND};color:#fff;display:flex;flex-direction:column;align-items:center;overflow:hidden">
      <div style="padding:30px 26px 22px;font:700 25px/1.2 Literata,Georgia,serif;text-align:center;text-wrap:balance">${captions[name]}</div>
      ${phone(src, 270)}
    </div>`
    writeFileSync(`public/screenshots/${name}.png`, await render(cdp, html, 360, 640, { scale: 3 }))
    console.log(`✓ screenshots/${name}.png`)
  }
  // Wide: the projection console, 1280×720 at 1.5× = 1920×1080.
  const consoleShot = await capture(cdp, "/fullscreen", { width: 1280, height: 720, scale: 1.5, mobile: false })
  const wide = `<div style="width:1280px;height:720px;background:${BRAND};color:#fff;display:flex;flex-direction:column;align-items:center;overflow:hidden">
    <div style="padding:34px 0 26px;font:700 36px/1.2 Literata,Georgia,serif">Proyecta la letra para toda la congregación</div>
    <img src="${consoleShot}" style="width:1040px;border-radius:18px;box-shadow:0 30px 60px -30px rgb(0 0 0/.6)">
  </div>`
  writeFileSync("public/screenshots/wide.png", await render(cdp, wide, 1280, 720, { scale: 1.5 }))
  console.log("✓ screenshots/wide.png")

  // Link preview (WhatsApp, social networks): 1200×630.
  const og = `<div style="width:1200px;height:630px;display:flex;align-items:center;gap:60px;padding:0 90px;box-sizing:border-box;color:#fff;overflow:hidden;
      background:radial-gradient(120% 140% at 85% 15%,#6b52d6 0%,#4f34b4 45%,#241462 100%)">
    <div style="flex:1;display:flex;flex-direction:column;gap:18px">
      <div style="width:104px;height:104px;border-radius:24px;background:#fff;display:grid;place-items:center">${mark(74, BRAND)}</div>
      <div style="font:700 92px/1 Literata,Georgia,serif;letter-spacing:-.01em">Acapela</div>
      <div style="font:600 30px/1.3 Inter,sans-serif;opacity:.92">Himnos y cánticos espirituales</div>
      <div style="font:400 24px/1.4 Inter,sans-serif;opacity:.78">El himnario de tu iglesia, siempre a mano.<br>acapela.app</div>
    </div>
    <div style="align-self:flex-start;margin-top:70px">${phone(shots.reading, 300)}</div>
  </div>`
  writeFileSync("public/og-image.png", await render(cdp, og, 1200, 630))
  console.log("✓ og-image.png")
}

try {
  const cdp = await connect()
  await icons(cdp)
  if (!ICONS_ONLY)
    await screenshots(cdp)
  cdp.ws.close()
}
catch (err) {
  console.error("ERROR:", err)
  process.exitCode = 1
}
finally {
  chrome.kill()
  server?.kill()
}
