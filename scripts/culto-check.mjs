// Culto, phase 1, in a real Chrome: a service with a welcome screen, a hymn,
// a reading, long announcements and a quote becomes its screens (long text
// split across screens); the live console goes through all of them in
// order; something inserted "now" is shown and → comes back to where the
// service was; the projector window draws what is live.
//
// Prereqs: pnpm generate (with the Bible data in data/biblias/), Google
// Chrome at /usr/bin/google-chrome. SHOTS=<dir> also saves screenshots.
// Run: pnpm pwa:check:culto

import { spawn } from "node:child_process"
import { createReadStream, rmSync, writeFileSync } from "node:fs"
import { stat } from "node:fs/promises"
import { createServer } from "node:http"
import path from "node:path"
import process from "node:process"
import { setTimeout as sleep } from "node:timers/promises"

const PORT = 3230
// BIBLE_CHECK_ORIGIN=https://staging.acapela.app checks a deployed site instead.
const ORIGIN = process.env.BIBLE_CHECK_ORIGIN ?? `http://localhost:${PORT}`

function pass(msg) {
  console.log(`✓ ${msg}`)
}
function fail(msg) {
  console.log(`✗ ${msg}`)
  process.exitCode = 1
}

// The static site, as in production (Dockerfile: nuxt generate + nginx):
// files from .output/public, unknown paths fall back to the SPA shell.
const PUBLIC = path.resolve(".output/public")
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain; charset=utf-8" }
const server = createServer(async (req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, ORIGIN).pathname)
  let file = path.join(PUBLIC, urlPath)
  if (!file.startsWith(PUBLIC))
    return res.writeHead(403).end()
  if (urlPath.endsWith("/"))
    file = path.join(file, "index.html")
  const exists = await stat(file).then(s => s.isFile()).catch(() => false)
  if (!exists) {
    if (path.extname(urlPath))
      return res.writeHead(404).end()
    file = path.join(PUBLIC, "200.html")
    if (!await stat(file).catch(() => false))
      file = path.join(PUBLIC, "index.html")
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream", "Content-Length": (await stat(file)).size })
  createReadStream(file).pipe(res)
})
let serverReady = false
if (process.env.BIBLE_CHECK_ORIGIN)
  serverReady = true
else
  server.listen(PORT, () => {
    serverReady = true
  })

const PROFILE = "/tmp/pwa-chrome-validation-culto"
rmSync(PROFILE, { recursive: true, force: true })
const chrome = spawn("/usr/bin/google-chrome", [
  "--headless=new",
  "--disable-gpu",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  `--user-data-dir=${PROFILE}`,
  `--remote-debugging-port=${PORT + 1}`,
  "--remote-allow-origins=*",
  "about:blank",
], { stdio: ["ignore", "ignore", "ignore"] })

/** Minimal CDP session on one page target. */
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl)
  let id = 0
  const pending = new Map()
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data)
    if (process.env.DEBUG && (msg.method === "Runtime.exceptionThrown" || (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type))))
      console.log("  [page]", JSON.stringify(msg.params.exceptionDetails?.exception?.description ?? msg.params.args?.map(a => a.value ?? a.description)).slice(0, 400))
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error
        ? reject(new Error(msg.error.message))
        : resolve(msg.result)
    }
  })
  await new Promise(r => ws.addEventListener("open", r, { once: true }))
  // A page that stops answering fails the check instead of hanging it.
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const msgId = ++id
    const timer = setTimeout(() => {
      pending.delete(msgId)
      reject(new Error(`${method}: la página no respondió en 30 s`))
    }, 30000)
    pending.set(msgId, { resolve: (v) => { clearTimeout(timer); resolve(v) }, reject: (e) => { clearTimeout(timer); reject(e) } })
    ws.send(JSON.stringify({ id: msgId, method, params }))
  })
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails)
      throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result.value
  }
  const waitFor = async (expression, timeoutMs = 60000) => {
    const end = Date.now() + timeoutMs
    while (Date.now() < end) {
      const value = await evaluate(expression).catch(() => null)
      if (value)
        return value
      await sleep(250)
    }
    throw new Error(`timeout esperando: ${expression}`)
  }
  const goto = async (url) => {
    // In front, as for the person using it: a hidden tab gets no animation
    // frames (dragging, pdf.js, screenshots wait on them).
    await send("Page.bringToFront")
    await send("Page.navigate", { url })
    await sleep(500)
    await waitFor("document.readyState === 'complete'")
  }
  await send("Page.enable")
  await send("Runtime.enable")
  await send("Network.enable")
  await send("DOM.enable")
  return { send, evaluate, waitFor, goto, close: () => ws.close() }
}

async function newPage(url) {
  const res = await fetch(`http://localhost:${PORT + 1}/json/new?about:blank`, { method: "PUT" })
  const target = await res.json()
  const page = await connect(target.webSocketDebuggerUrl)
  await page.goto(url)
  return page
}


const SHOTS = process.env.SHOTS
async function shot(page, name) {
  if (!SHOTS)
    return
  const s = await page.send("Page.captureScreenshot", { format: "png" })
  writeFileSync(`${SHOTS}/${name}.png`, Buffer.from(s.data, "base64"))
}
async function key(page, k, code = k, vk = k.toUpperCase().charCodeAt(0)) {
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk, text: k.length === 1 ? k : undefined })
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk })
  await sleep(400)
}
const right = page => key(page, "ArrowRight", "ArrowRight", 39)
const liveLabel = page => page.evaluate(`document.querySelector('#v-live')?.innerText ?? ''`)
function check(ok, msg) {
  ok ? pass(msg) : fail(msg)
}

try {
  for (let i = 0; i < 40 && !serverReady; i++) await sleep(250)
  for (let i = 0; i < 40; i++) {
    if (await fetch(`http://localhost:${PORT + 1}/json/version`).then(r => r.ok).catch(() => false))
      break
    await sleep(250)
  }
  const songs = await fetch(`${ORIGIN}/songs/manifest.json`).then(r => r.json())
  const books = songs.songbooks ?? songs
  const sb = books.find(s => s.id.includes("nogales")) ?? books[0]
  const page = await newPage(`${ORIGIN}/`)
  await page.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  const culto = {
    id: "check",
    title: "Culto de prueba",
    date: "2026-11-29",
    updatedAt: Date.now(),
    items: [
      { id: "a", kind: "screen", layout: "title", eyebrow: "Bienvenidos", title: "Nos alegra verte hoy", body: "", reference: "" },
      { id: "b", kind: "hymn", songbookId: sb.id, songId: 12, notes: "Cantarlo dos veces." },
      { id: "c", kind: "reading", reference: "Sal 46:1-7", versionId: "rvr1960", mode: "fit" },
      { id: "d", kind: "screen", layout: "text", eyebrow: "Anuncios", title: "Esta semana", reference: "", body: `Miércoles 19:30 · Estudio bíblico.\nSábado 10:00 · Limpieza del templo.\n\n${"La ofrenda especial de diciembre será para la obra en el interior del país. ".repeat(8)}` },
      { id: "e", kind: "screen", layout: "quote", eyebrow: "Santa Cena", title: "«Haced esto en memoria de mí».", body: "", reference: "1 Corintios 11:24" },
    ],
  }
  await page.evaluate(`localStorage.setItem('songbookId', ${JSON.stringify(sb.id)}); localStorage.setItem('cultos', ${JSON.stringify(JSON.stringify([culto]))}); localStorage.setItem('cultoId', 'check')`)

  // Editor
  await page.goto(`${ORIGIN}/culto`)
  await page.waitFor("document.querySelectorAll('ol li').length === 5", 20000)
  await page.waitFor("!document.querySelector('[aria-label=Preparando]')", 30000)
  const counts = await page.evaluate(`[...document.querySelectorAll('ol li')].map(l => Number((l.innerText.match(/(\\d+) pantallas?/) ?? [])[1] ?? 0))`)
  check(counts[0] === 1, `bienvenida: 1 pantalla (${counts[0]})`)
  check(counts[1] >= 2, `himno 12: ${counts[1]} pantallas, una por estrofa`)
  check(counts[2] >= 2, `Salmo 46:1-7 repartido en ${counts[2]} pantallas`)
  check(counts[3] >= 2, `anuncios largos repartidos en ${counts[3]} pantallas`)
  check(counts[4] === 1, `Santa Cena: 1 pantalla (${counts[4]})`)
  const total = counts.reduce((a, b) => a + b, 0)
  await shot(page, "editor")

  // Live console
  await page.goto(`${ORIGIN}/culto/vivo`)
  await page.waitFor("document.querySelector('#v-live')", 20000)
  await page.waitFor(`document.querySelector('#v-live').innerText.includes('NOS ALEGRA')`, 20000)
  pass("la consola empieza por la bienvenida")
  await right(page)
  check((await liveLabel(page)).includes("12"), `→ pasa al himno: ${await liveLabel(page)}`)
  await right(page)
  const before = await liveLabel(page)
  const notes = await page.evaluate(`document.body.innerText.includes('Cantarlo dos veces.')`)
  check(notes, "se ven las notas del himno")

  // Insert "now" and come back
  await key(page, "i", "KeyI")
  await page.waitFor("document.querySelector('[role=dialog] textarea')", 5000)
  await page.evaluate(`(() => { const t = document.querySelector('[role=dialog] textarea'); t.value = 'jn 3:16'; t.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  await page.waitFor(`[...document.querySelectorAll('[role=option]')].some(o => o.innerText.includes('Juan 3:16'))`, 10000)
  pass("«jn 3:16» se reconoce como Juan 3:16")
  await shot(page, "insertar")
  await page.evaluate(`[...document.querySelectorAll('[role=dialog] button')].find(b => b.innerText.trim() === 'Insertar').click()`)
  await page.waitFor(`document.querySelector('#v-live').innerText.includes('JUAN 3:16')`, 20000)
  pass("insertado ahora: en pantalla Juan 3:16")
  await right(page)
  const after = await liveLabel(page)
  check(after.includes("12") && after !== before, `→ vuelve al himno donde estaba: ${after}`)

  // Projector window
  const proj = await newPage(`${ORIGIN}/projector`)
  await sleep(1500)
  const drawn = await proj.evaluate(`document.querySelector('.projection-lyric')?.innerText ?? document.querySelector('.page-host')?.innerText ?? ''`)
  check(drawn.length > 10, `el proyector dibuja la pantalla en vivo: «${drawn.slice(0, 40)}…»`)
  await shot(proj, "proyector")
  const status = await page.evaluate(`document.body.innerText.includes('Proyector conectado')`)
  check(status, "la consola ve el proyector conectado")

  const totalNow = await page.evaluate(`[...document.querySelectorAll('nav[aria-label="Orden del culto"] button')].length`)
  check(totalNow === 6, `el orden tiene 6 elementos con el insertado (${totalNow}); ${total} pantallas antes de insertar`)

  // ---------------------------------------------------------- editor: drag and the screen manager
  await page.goto(`${ORIGIN}/culto`)
  await page.waitFor("document.querySelectorAll('ol li').length === 6", 20000)
  await page.waitFor("!document.querySelector('[aria-label=Preparando]')", 30000)
  const labels = () => page.evaluate(`[...document.querySelectorAll('ol li')].map(l => l.innerText.split('\\n').find(t => t.trim() && !/^\\d+$/.test(t.trim()))?.trim())`)
  const center = sel => page.evaluate(`(() => { const r = ${sel}.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  // Just inside the top-left corner: dropping there puts it before.
  const corner = sel => page.evaluate(`(() => { const r = ${sel}.getBoundingClientRect(); return { x: r.x + 12, y: r.y + 6 } })()`)
  async function drag(from, to) {
    const move = (x, y, buttons = 1) => page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: buttons ? "left" : "none", buttons })
    await move(from.x, from.y, 0)
    await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: from.x, y: from.y, button: "left", buttons: 1, clickCount: 1 })
    await sleep(120)
    // A few pixels first (Sortable starts dragging after a small move), then the way there.
    await move(from.x + 3, from.y + 3)
    await sleep(60)
    for (let i = 1; i <= 20; i++) {
      await move(from.x + (to.x - from.x) * i / 20, from.y + (to.y - from.y) * i / 20)
      await sleep(30)
    }
    await sleep(250)
    await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: to.x, y: to.y, button: "left", buttons: 0, clickCount: 1 })
    await sleep(900)
  }
  // Readings and texts are measured after the page opens; drag once the
  // list has settled, as a person would.
  await sleep(2000)
  // The last element (Santa Cena) dragged by its handle above the first.
  await drag(await center("document.querySelectorAll('ol li .drag-handle')[5]"), await corner("document.querySelectorAll('ol li')[0]"))
  const order = await labels()
  check(order[0]?.includes("Haced"), `arrastrar: Santa Cena pasa al primer lugar (${order.slice(0, 2).join(" · ")})`)

  // Hymn: hide its first screen; then drag the second one to the front.
  await page.evaluate(`[...document.querySelectorAll('ol li button')].find(b => b.innerText.includes('EL NOMBRE'))?.click()`)
  await page.waitFor("document.querySelectorAll('figure').length === 4", 10000)
  await page.evaluate(`[...document.querySelectorAll('figure')][0].querySelector('button').click()`)
  await page.waitFor(`[...document.querySelectorAll('ol li')].some(l => l.innerText.includes('EL NOMBRE') && l.innerText.includes('3 pantallas'))`, 10000)
  pass("ocultar una estrofa: el himno queda con 3 pantallas")
  const lastFirst = await page.evaluate(`document.querySelectorAll('figure')[1].querySelector('.projection-lyric')?.innerText.slice(0, 20)`)
  await drag(await center("document.querySelectorAll('figure')[1].querySelector('.projection-frame')"), await corner("document.querySelectorAll('figure')[0].querySelector('.projection-frame')"))
  const nowFirst = await page.evaluate(`document.querySelectorAll('figure')[0].querySelector('.projection-lyric')?.innerText.slice(0, 20)`)
  check(nowFirst === lastFirst, `arrastrar una pantalla: la segunda pasa adelante («${nowFirst}»)`)
  await page.evaluate(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('Restablecer orden'))?.click()`)
  await page.waitFor(`[...document.querySelectorAll('ol li')].some(l => l.innerText.includes('EL NOMBRE') && l.innerText.includes('4 pantallas'))`, 10000)
  pass("restablecer: el himno vuelve a sus 4 pantallas en orden")

  // Reading: start a new screen inside the first one.
  await page.evaluate(`[...document.querySelectorAll('ol li button')].find(b => b.innerText.includes('Salmos'))?.click()`)
  await page.waitFor("[...document.querySelectorAll('button')].some(b => b.innerText.includes('Partir'))", 15000)
  const readingBefore = await page.evaluate(`document.querySelectorAll('figure').length`)
  await page.evaluate(`[...document.querySelectorAll('button')].find(b => b.innerText.includes('Partir')).click()`)
  await page.waitFor("document.querySelector('[role=menuitem]')", 5000)
  await page.evaluate(`document.querySelector('[role=menuitem]').click()`)
  await page.waitFor(`document.querySelectorAll('figure').length === ${readingBefore + 1}`, 15000)
  pass(`partir: la lectura pasa de ${readingBefore} a ${readingBefore + 1} pantallas`)
  const canJoin = await page.evaluate(`[...document.querySelectorAll('button')].some(b => b.innerText.includes('Unir con la anterior'))`)
  check(canJoin, "la pantalla nueva ofrece «Unir con la anterior»")
  await shot(page, "gestor")

  // ---------------------------------------------------------- theme, slides from a PDF, logo
  await page.evaluate(`localStorage.setItem('cultoTheme', JSON.stringify({ churchName: 'Iglesia de Prueba', background: { kind: 'color', color: '#f0eadc' }, accent: '#a9a6fa', font: 'literata' }))`)
  await page.goto(`${ORIGIN}/culto`)
  await page.waitFor("document.querySelectorAll('ol li').length === 6", 20000)
  await page.evaluate(`[...document.querySelectorAll('ol li button')].find(b => b.innerText.includes('Esta semana'))?.click()`)
  await page.waitFor("document.querySelector('figure .page')", 15000)
  const themed = await page.evaluate(`(() => { const p = document.querySelector('figure .page'); const cs = getComputedStyle(p); return { color: cs.color, font: cs.fontFamily, footer: p.querySelector('.page-footer')?.innerText ?? '' } })()`)
  check(themed.color === "rgb(27, 26, 34)", `tema claro: texto oscuro (${themed.color})`)
  check(themed.font.includes("Literata"), `tema: letra Literata (${themed.font.slice(0, 30)})`)
  check(themed.footer.includes("Iglesia de Prueba"), `tema: el nombre de la iglesia abajo («${themed.footer.trim()}»)`)

  // A two-page PDF becomes a "Diapositivas" element with two screens.
  const { root } = await page.send("DOM.getDocument", { depth: -1, pierce: true })
  const { nodeId } = await page.send("DOM.querySelector", { nodeId: root.nodeId, selector: "input[type=file][multiple]" })
  await page.send("DOM.setFileInputFiles", { nodeId, files: [path.resolve("scripts/fixtures/dos-diapositivas.pdf")] })
  await page.waitFor(`[...document.querySelectorAll('ol li')].some(l => l.innerText.includes('Diapositivas') && l.innerText.includes('2 pantallas'))`, 30000)
    .catch(async (err) => {
      console.log("  pantalla:", JSON.stringify(await page.evaluate("document.body.innerText.slice(0, 1500)")))
      throw err
    })
  pass("un PDF de 2 páginas se convierte en «Diapositivas» con 2 pantallas")
  await page.waitFor("[...document.querySelectorAll('figure img')].filter(i => i.complete && i.naturalWidth > 0).length === 2", 15000)
  const size = await page.evaluate(`(() => { const i = document.querySelector('figure img'); return [i.naturalWidth, i.naturalHeight] })()`)
  check(size[0] === 1920, `cada página queda como imagen de ${size[0]}×${size[1]}`)
  await shot(page, "diapositivas")

  // Live: L shows the church's logo screen.
  await page.goto(`${ORIGIN}/culto/vivo`)
  await page.waitFor("document.querySelector('#v-live')", 20000)
  await key(page, "l", "KeyL")
  const logo = await page.evaluate(`document.querySelector('.live-wrap .page--logo')?.innerText ?? ''`)
  check(logo.includes("Iglesia de Prueba"), `L muestra la pantalla del logo con el nombre («${logo.trim()}»)`)
  await shot(page, "logo")

  // ---------------------------------------------------------- a hymn from another songbook
  const other = books.find(b => b.id !== sb.id)
  if (other) {
    await page.evaluate(`(() => { const all = JSON.parse(localStorage.getItem('cultos')); all[0].items.push({ id: 'z', kind: 'hymn', songbookId: ${JSON.stringify(other.id)}, songId: 3 }); localStorage.setItem('cultos', JSON.stringify(all)) })()`)
    await page.goto(`${ORIGIN}/culto`)
    await page.waitFor(`[...document.querySelectorAll('ol li')].some(l => l.innerText.includes(${JSON.stringify(`(${other.name})`)}) && /\\d+ pantallas?/.test(l.innerText))`, 30000)
    pass(`un himno de otro himnario (${other.name}) se proyecta sin cambiar el de Ajustes`)
  }

  // ---------------------------------------------------------- to another device and back
  const DOWNLOADS = "/tmp/pwa-chrome-validation-culto-downloads"
  rmSync(DOWNLOADS, { recursive: true, force: true })
  await page.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: DOWNLOADS }).catch(() => page.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: DOWNLOADS }))
  const itemsBefore = await page.evaluate(`document.querySelectorAll('ol li').length`)
  await page.evaluate(`document.querySelector('[aria-label="Más opciones del culto"]').click()`)
  await page.waitFor(`[...document.querySelectorAll('[role=menuitem]')].some(m => m.innerText.includes('Enviar a otro dispositivo'))`, 5000)
  await page.evaluate(`[...document.querySelectorAll('[role=menuitem]')].find(m => m.innerText.includes('Enviar a otro dispositivo')).click()`)
  let exported = null
  for (let i = 0; i < 40 && !exported; i++) {
    await sleep(250)
    exported = (await import("node:fs")).readdirSync(DOWNLOADS, { withFileTypes: true }).find(f => f.name.endsWith(".acapela.json"))?.name ?? null
  }
  check(!!exported, `exportar: se descarga «${exported}»`)
  if (exported) {
    const data = JSON.parse((await import("node:fs")).readFileSync(path.join(DOWNLOADS, exported), "utf8"))
    check(Object.keys(data.media).length >= 2, `el archivo lleva sus imágenes (${Object.keys(data.media).length})`)
    // A fresh device: nothing saved, then open the file.
    await page.evaluate(`localStorage.removeItem('cultos'); localStorage.removeItem('cultoId'); localStorage.removeItem('cultoTheme'); indexedDB.deleteDatabase('acapela-media')`)
    await page.goto(`${ORIGIN}/culto`)
    await page.waitFor("document.querySelectorAll('ol li').length === 1", 15000)
    const { root: r2 } = await page.send("DOM.getDocument", { depth: -1, pierce: true })
    const { nodeId: n2 } = await page.send("DOM.querySelector", { nodeId: r2.nodeId, selector: "input[type=file][accept^='.json']" })
    await page.send("DOM.setFileInputFiles", { nodeId: n2, files: [path.join(DOWNLOADS, exported)] })
    await page.waitFor(`document.querySelectorAll('ol li').length === ${itemsBefore}`, 20000)
    pass(`importar en otro dispositivo: el culto llega con sus ${itemsBefore} elementos`)
    await page.evaluate(`[...document.querySelectorAll('ol li button')].find(b => b.innerText.includes('diapositivas'))?.click()`)
    await page.waitFor("[...document.querySelectorAll('figure img')].filter(i => i.complete && i.naturalWidth > 0).length === 2", 15000)
    pass("las diapositivas llegan con sus imágenes")
    const themeName = await page.evaluate(`JSON.parse(localStorage.getItem('cultoTheme') || '{}').churchName`)
    check(themeName === "Iglesia de Prueba", `y el tema de la iglesia, porque este dispositivo no tenía uno («${themeName}»)`)
  }
}
catch (err) {
  fail(err.stack)
}
finally {
  chrome.kill()
  server.close()
}
