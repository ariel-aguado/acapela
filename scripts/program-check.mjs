// The service's program for the congregation (pnpm pwa:check:program,
// after pnpm generate): «Compartir con la congregación» on the computer
// makes a link with the order and the readings' text, and no notes,
// messages or images; the link opens on a phone, without the computer's
// data, as text and as screens; it is kept, the home page shows it, and a
// newer link of the same service replaces it. Then live, with the room
// relay (relay/server.mjs, started here behind /sala): the console publishes
// the program and what is on air, a phone in a separate browser context
// opens the room's short link (the QR's), marks what is projected, gets a
// change of the order by itself, and the QR goes on the screen with Q.

import { spawn } from "node:child_process"
import { createReadStream, rmSync, writeFileSync } from "node:fs"
import { stat } from "node:fs/promises"
import { createServer, request } from "node:http"
import path from "node:path"
import process from "node:process"
import { setTimeout as sleep } from "node:timers/promises"

const PORT = 3260
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
// The room relay, as in production behind acapela.app/sala.
const RELAY_PORT = PORT + 5
const relay = spawn(process.execPath, ["relay/server.mjs"], { env: { ...process.env, PORT: String(RELAY_PORT) }, stdio: "ignore" })
function proxy(req, res) {
  const up = request({ host: "127.0.0.1", port: RELAY_PORT, path: req.url, method: req.method, headers: req.headers }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers)
    r.pipe(res)
  })
  up.on("error", () => res.writeHead(502).end())
  req.pipe(up)
  res.on("close", () => up.destroy())
}

const server = createServer(async (req, res) => {
  if (req.url?.startsWith("/sala"))
    return proxy(req, res)
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

const PROFILE = "/tmp/pwa-chrome-validation-program"
rmSync(PROFILE, { recursive: true, force: true })
const chrome = spawn("/usr/bin/google-chrome", [
  "--headless=new",
  // Desktop width: Bibles and Culto are only shown on large screens.
  "--window-size=1280,900",
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
function check(ok, msg) {
  ok ? pass(msg) : fail(msg)
}


const clickText = (page, text, scope = "") => page.evaluate(`(() => { const b = [...document.querySelectorAll('${scope} button, ${scope} a')].find(b => b.innerText.replace(/\\s+/g, ' ').trim().startsWith(${JSON.stringify(text)})); b?.click(); return !!b })()`)

try {
  for (let i = 0; i < 40 && !serverReady; i++) await sleep(250)
  for (let i = 0; i < 40; i++) {
    if (await fetch(`http://localhost:${PORT + 1}/json/version`).then(r => r.ok).catch(() => false))
      break
    await sleep(250)
  }
  const songs = await fetch(`${ORIGIN}/songs/manifest.json`).then(r => r.json())
  const books = songs.songbooks ?? songs
  const sb = books[0]
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  const culto = {
    id: "prog",
    title: "Culto de prueba",
    date: today,
    time: "10:00",
    updatedAt: 1000,
    items: [
      { id: "a", kind: "screen", layout: "title", eyebrow: "Bienvenidos", title: "Nos alegra verte hoy", body: "", reference: "", notes: "NOTA-PRIVADA del presentador" },
      { id: "b", kind: "hymn", songbookId: sb.id, songId: 12 },
      { id: "c", kind: "reading", reference: "Heb 13:15-16", versionId: "rvr1960", mode: "fit" },
    ],
    messages: [
      { id: "m1", kind: "notice", title: "Hoy", text: "MENSAJE-PRIVADO", position: "bottom-start", size: "m", font: "theme", animation: "slide", duration: 3 },
    ],
  }
  const pc = await newPage(`${ORIGIN}/`)
  await pc.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await pc.evaluate(`localStorage.setItem('songbookId', ${JSON.stringify(sb.id)}); localStorage.setItem('cultos', ${JSON.stringify(JSON.stringify([culto]))}); localStorage.setItem('cultoId', 'prog'); localStorage.setItem('cultoTheme', JSON.stringify({ churchName: 'Iglesia de Prueba', background: { kind: 'acapela' }, accent: '#ffffff', font: 'inter' }))`)
  await pc.goto(`${ORIGIN}/culto`)
  await pc.waitFor("document.querySelectorAll('ol li').length === 3", 20000)
  check(await clickText(pc, "Compartir"), "el editor tiene «Compartir»")
  const link = await pc.waitFor(`document.querySelector('[data-program-link] input')?.value || document.querySelector('input[data-program-link]')?.value`, 30000)
  check(/\/programa\?sala=[A-Z2-9]{6}#v1\./.test(link), `el enlace lleva el programa en el «#» (${Math.round(link.length / 1024)} KB)`)
  check(await pc.evaluate(`document.querySelector('[role=dialog]').innerText.includes('1 lectura con su texto')`), "dice qué va: la lectura con su texto")
  await shot(pc, "programa-compartir")

  // The phone: another browser profile would be truer; a fresh origin
  // storage is the same here (nothing of the computer's culto is read).
  await pc.evaluate("localStorage.clear(); indexedDB.databases?.().then(dbs => dbs.forEach(db => indexedDB.deleteDatabase(db.name)))")
  await sleep(500)
  const phone = pc
  await phone.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  await phone.evaluate(`localStorage.setItem('songbookId', ${JSON.stringify(sb.id)})`)
  await phone.goto(link)
  await phone.waitFor("document.querySelectorAll('[data-program-item]').length === 3", 30000)
  pass("el teléfono abre el programa con sus 3 elementos")
  check(await phone.evaluate("!location.hash && location.search.includes('id=prog')"), "el enlace sale de la barra de direcciones y el programa queda guardado")
  const text = () => phone.evaluate("document.querySelector('main, body').innerText")
  await phone.waitFor("document.body.innerText.includes('sacrificio de alabanza')", 20000)
  pass("la lectura se lee con su texto, sin descargar la Biblia")
  check((await text()).includes("Iglesia de Prueba"), "con el nombre de la iglesia")
  check(!(await text()).includes("NOTA-PRIVADA") && !(await phone.evaluate("localStorage.getItem('programs')")).includes("NOTA-PRIVADA"), "las notas del presentador no viajan")
  check(!(await phone.evaluate("localStorage.getItem('programs')")).includes("MENSAJE-PRIVADO"), "los mensajes no viajan")
  await phone.waitFor("document.querySelector('[data-program-item=hymn] .program-label')", 20000)
  pass("el himno se lee por estrofas, del himnario del teléfono")
  await shot(phone, "programa-texto")
  await clickText(phone, "Pantallas")
  await phone.waitFor("document.querySelectorAll('[data-program-item] .culto-screen').length >= 3", 20000)
  pass("«Pantallas»: lo mismo que se proyecta")
  await shot(phone, "programa-pantallas")

  await phone.goto(`${ORIGIN}/`)
  await phone.waitFor("document.querySelector('[data-home-program]')", 15000)
  check((await phone.evaluate("document.querySelector('[data-home-program]').innerText")).includes("Hoy en el culto"), "el inicio muestra «Hoy en el culto»")
  await shot(phone, "programa-inicio")

  // A newer link of the same service replaces it; an older one does not.
  const newer = await phone.evaluate(`(async () => {
    const data = ${JSON.stringify(link.split('#')[1].slice(3))}.replace(/-/g, '+').replace(/_/g, '/')
    const raw = atob(data + '='.repeat((4 - data.length % 4) % 4))
    const bytes = Uint8Array.from(raw, c => c.charCodeAt(0))
    const json = JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text())
    json.rev = 2000
    json.title = 'Culto cambiado'
    const out = new Uint8Array(await new Response(new Blob([new TextEncoder().encode(JSON.stringify(json))]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer())
    let s = ''; out.forEach(b => s += String.fromCharCode(b))
    return location.origin + '/programa#v1.' + btoa(s).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '')
  })()`)
  await phone.goto(newer)
  await phone.waitFor("document.body.innerText.includes('Culto cambiado')", 15000)
  check(await phone.evaluate("JSON.parse(localStorage.getItem('programs')).length === 1"), "un enlace más nuevo reemplaza al anterior, sin duplicar")
  await phone.goto(link)
  await sleep(1500)
  check(await phone.evaluate("document.body.innerText.includes('Culto cambiado')"), "el enlace viejo no deshace el nuevo")
  await phone.goto(`${ORIGIN}/programa#v1.roto`)
  await sleep(1200)
  check(await phone.evaluate("document.body.innerText.includes('Culto cambiado')"), "un enlace roto no borra lo guardado")

  // ------------------------------------------------------------ live
  // The phone in its own browser context: its own storage, as another device.
  async function isolatedPage(url) {
    const { webSocketDebuggerUrl } = await fetch(`http://localhost:${PORT + 1}/json/version`).then(r => r.json())
    const ws = new WebSocket(webSocketDebuggerUrl)
    await new Promise(r => ws.addEventListener("open", r, { once: true }))
    let id = 0
    const call = (method, params = {}) => new Promise((resolve) => {
      const msgId = ++id
      const onMsg = (e) => {
        const msg = JSON.parse(e.data)
        if (msg.id === msgId) {
          ws.removeEventListener("message", onMsg)
          resolve(msg.result)
        }
      }
      ws.addEventListener("message", onMsg)
      ws.send(JSON.stringify({ id: msgId, method, params }))
    })
    const { browserContextId } = await call("Target.createBrowserContext")
    const { targetId } = await call("Target.createTarget", { url: "about:blank", browserContextId })
    const list = await fetch(`http://localhost:${PORT + 1}/json/list`).then(r => r.json())
    const page = await connect(list.find(t => t.id === targetId).webSocketDebuggerUrl)
    await page.goto(url)
    return page
  }

  // The first phone shares this storage: closed, so it does not write it back.
  await phone.send("Page.close").catch(() => {})
  await sleep(500)
  const pc2 = await newPage(`${ORIGIN}/`)
  await pc2.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await pc2.evaluate(`localStorage.clear(); localStorage.setItem('songbookId', ${JSON.stringify(sb.id)}); localStorage.setItem('cultos', ${JSON.stringify(JSON.stringify([culto]))}); localStorage.setItem('cultoId', 'prog'); localStorage.setItem('cultoTheme', JSON.stringify({ churchName: 'Iglesia de Prueba', background: { kind: 'acapela' }, accent: '#ffffff', font: 'inter' }))`)
  await pc2.goto(`${ORIGIN}/culto`)
  await pc2.waitFor("document.querySelectorAll('ol li').length === 3", 20000)
  await clickText(pc2, "Compartir")
  const full = await pc2.waitFor(`document.querySelector('[data-program-link] input')?.value || document.querySelector('input[data-program-link]')?.value`, 30000)
  const code = /sala=([A-Z2-9]{6})/.exec(full)?.[1]
  check(!!code && full.includes("#v1."), `el enlace nombra la sala (${code}) y sigue llevando el programa`)
  check(await pc2.evaluate("!!document.querySelector('[data-program-qr] svg')"), "la ventana muestra el código QR de la sala")
  await pc2.waitFor("document.querySelector('[data-relay=ok]')", 15000)
  check(!(await pc2.evaluate("document.querySelector('[role=dialog]').innerText.includes('Sin conexión con el servidor')")), "el servidor de salas confirmó: sin aviso de falta de conexión")
  const relayBase = ORIGIN.includes("staging.acapela.app") ? "https://acapela.app/sala" : `${ORIGIN}/sala`
  check(await fetch(`${relayBase}/${code}`).then(r => r.ok), "el programa quedó en la sala: el QR funciona")
  await shot(pc2, "programa-compartir-qr")

  const phone2 = await isolatedPage(`${ORIGIN}/`)
  await phone2.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  await phone2.evaluate(`localStorage.setItem('songbookId', ${JSON.stringify(sb.id)})`)
  await phone2.goto(`${ORIGIN}/programa?sala=${code}`)
  await phone2.waitFor("document.querySelectorAll('[data-program-item]').length === 3", 30000)
  pass("el enlace corto del QR abre el programa desde la sala, en otro dispositivo")
  await phone2.waitFor("document.querySelector('[data-program-live]')?.innerText.includes('esperando')", 10000)
  pass("conectado a la sala, esperando que empiece")

  await pc2.goto(`${ORIGIN}/culto/vivo`)
  await pc2.waitFor(`document.querySelector('#v-live')?.innerText.toUpperCase().includes('NOS ALEGRA')`, 20000)
  await pc2.waitFor("/1 teléfono siguiendo/.test(document.querySelector('[data-phones]')?.textContent ?? '')", 15000)
  pass("la consola cuenta «1 teléfono»")
  await phone2.waitFor("document.querySelector('[data-on-air]')?.getAttribute('data-program-item') === 'screen'", 10000)
  check((await phone2.evaluate("document.querySelector('[data-program-live]').innerText")).includes("En vivo"), "el teléfono marca «Ahora» la bienvenida, en vivo")
  await shot(phone2, "programa-en-vivo")

  await pc2.send("Page.bringToFront")
  await right(pc2)
  await phone2.waitFor("document.querySelector('[data-on-air]')?.getAttribute('data-program-item') === 'hymn'", 10000)
  pass("→ en la consola: el teléfono pasa al himno")
  await phone2.waitFor("document.querySelector('[data-on-air-piece]')", 5000)
  pass("y resalta la estrofa que se canta")
  await clickText(phone2, "Pantallas")
  await phone2.waitFor("document.querySelector('[data-on-air-screen]')", 5000)
  pass("en «Pantallas», la pantalla al aire")
  await shot(phone2, "programa-en-vivo-pantallas")

  await key(pc2, "q")
  await pc2.waitFor("document.querySelector('[data-live-qr] svg')", 5000)
  pass("Q: el QR sale sobre la pantalla")
  await shot(pc2, "consola-qr")
  await key(pc2, "q")

  await pc2.evaluate("document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$pinia._s.get('culto').patch({ title: 'Culto cambiado en vivo' })")
  await phone2.waitFor("document.body.innerText.includes('Culto cambiado en vivo')", 15000)
  pass("un cambio en la consola llega solo al teléfono")

  await pc2.send("Page.bringToFront")
  await key(pc2, "b")
  await phone2.waitFor("document.querySelector('[data-program-live]')?.innerText.includes('negro') && !document.querySelector('[data-on-air]')", 10000)
  pass("B: el teléfono dice «pantalla en negro» y no marca nada")
}
catch (e) {
  fail(e.stack ?? String(e))
}
finally {
  chrome.kill()
  relay.kill()
  server.close()
}
