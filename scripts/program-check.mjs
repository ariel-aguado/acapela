// The service's program for the congregation (pnpm pwa:check:program,
// after pnpm generate): «Compartir con la congregación» on the computer
// makes a link with the order and the readings' text, and no notes,
// messages or images; the link opens on a phone, without the computer's
// data, as text and as screens; it is kept, the home page shows it, and a
// newer link of the same service replaces it.

import { spawn } from "node:child_process"
import { createReadStream, rmSync, writeFileSync } from "node:fs"
import { stat } from "node:fs/promises"
import { createServer } from "node:http"
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
  check(link.includes("/programa#v1."), `el enlace lleva el programa en el «#» (${Math.round(link.length / 1024)} KB)`)
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
}
catch (e) {
  fail(e.stack ?? String(e))
}
finally {
  chrome.kill()
  server.close()
}
