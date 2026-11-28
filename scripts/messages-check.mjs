// Messages over the screen, in a real Chrome: the editor lists a service's
// messages and writes new ones; in the live console a message is shown over
// the slide, on the console and on the projector window, leaves after its
// time, comes by itself with the element it is hung on, is taken off with X,
// a countdown counts down, and the black screen hides it.
//
// Prereqs: pnpm generate, Google Chrome at /usr/bin/google-chrome.
// SHOTS=<dir> also saves screenshots. Run: pnpm pwa:check:messages

import { spawn } from "node:child_process"
import { createReadStream, rmSync, writeFileSync } from "node:fs"
import { stat } from "node:fs/promises"
import { createServer } from "node:http"
import path from "node:path"
import process from "node:process"
import { setTimeout as sleep } from "node:timers/promises"

const PORT = 3240
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

const PROFILE = "/tmp/pwa-chrome-validation-messages"
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

const cmsg = page => page.evaluate(`document.querySelector('.cmsg')?.innerText.replace(/\\s+/g, ' ').trim() ?? ''`)
const clickText = (page, text, scope = "") => page.evaluate(`(() => { const b = [...document.querySelectorAll('${scope} button')].find(b => b.innerText.replace(/\\s+/g, ' ').trim().startsWith(${JSON.stringify(text)})); b?.click(); return !!b })()`)

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
      { id: "b", kind: "hymn", songbookId: sb.id, songId: 12 },
    ],
    messages: [
      { id: "m1", kind: "notice", title: "Hoy", text: "Estudio bíblico a las 19:00", position: "bottom-start", size: "m", font: "theme", animation: "slide", duration: 3 },
      { id: "m2", kind: "congrats", title: "¡Feliz cumpleaños!", text: "Hermana Marta", position: "center", size: "l", font: "literata", animation: "bounce", duration: 0, trigger: { itemId: "b", delay: 0 } },
    ],
  }
  await page.evaluate(`localStorage.setItem('songbookId', ${JSON.stringify(sb.id)}); localStorage.setItem('cultos', ${JSON.stringify(JSON.stringify([culto]))}); localStorage.setItem('cultoId', 'check')`)

  // Editor: the list, the count on the element, a new message.
  await page.goto(`${ORIGIN}/culto`)
  await page.waitFor("document.querySelectorAll('ol li').length === 2", 20000)
  check(await page.evaluate(`[...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'Mensajes (2)')`), "el editor muestra «Mensajes (2)»")
  check(await page.evaluate(`document.querySelectorAll('ol li')[1].innerText.includes('1 mensaje')`), "el himno dice que tiene 1 mensaje")
  await clickText(page, "Mensajes (2)")
  await page.waitFor(`document.querySelector('[role=dialog]')?.innerText.includes('Al empezar')`, 5000)
  pass("la lista dice cuándo aparece el mensaje colgado del himno")
  await clickText(page, "Mensaje nuevo", "[role=dialog]")
  await page.waitFor(`document.querySelector('[role=dialog]')?.innerText.includes('Mensaje nuevo') && document.querySelector('[role=dialog] .cmsg')`, 5000)
  pass("el editor del mensaje muestra la vista previa sobre la pantalla")
  await clickText(page, "Alerta", "[role=dialog]")
  await page.evaluate(`(() => { const t = document.querySelector('[role=dialog] textarea'); t.value = 'Auto gris en la entrada'; t.dispatchEvent(new Event('input', { bubbles: true })) })()`)
  await page.waitFor(`document.querySelector('[role=dialog] .cmsg')?.innerText.includes('Auto gris')`, 5000)
  check(await page.evaluate(`!!document.querySelector('[role=dialog] .cmsg--band-top .cmsg--alert')`), "la alerta va en una banda arriba, en su color")
  await shot(page, "mensaje-editor")
  await clickText(page, "Guardar", "[role=dialog]")
  await page.waitFor(`JSON.parse(localStorage.getItem('cultos'))[0].messages.length === 3`, 5000)
  pass("guardado: el culto tiene 3 mensajes")
  await page.waitFor(`[...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'Mensajes (3)')`, 5000)
  await page.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
  await sleep(600)

  // Live console and projector.
  await page.goto(`${ORIGIN}/culto/vivo`)
  await page.waitFor(`document.querySelector('#v-live')?.innerText.toUpperCase().includes('NOS ALEGRA')`, 20000)
  const proj = await newPage(`${ORIGIN}/projector`)
  await proj.waitFor(`document.querySelector('.projection-frame')`, 10000)
  await page.send("Page.bringToFront")
  await page.waitFor(`document.body.innerText.includes('Proyector conectado')`, 10000)
  check(!(await cmsg(page)), "sin mensajes al empezar")
  await page.evaluate(`[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label')?.startsWith('Mostrar: Hoy'))?.click()`)
  await page.waitFor(`document.querySelector('.cmsg')`, 3000)
  check((await cmsg(page)).includes("Estudio bíblico"), `«Mostrar»: el aviso sale sobre la pantalla de la consola («${await cmsg(page)}»)`)
  await proj.waitFor(`document.querySelector('.cmsg')`, 3000)
  check((await cmsg(proj)).includes("Estudio bíblico"), "y en la ventana del proyector")
  await shot(page, "consola")
  check(await proj.evaluate(`!!document.querySelector('.projection-frame') && !!document.querySelector('.cmsg--bottom-start')`), "abajo a la izquierda, sin quitar la pantalla")
  await proj.send("Page.bringToFront")
  await sleep(800)
  await shot(proj, "mensaje-proyector")
  await page.send("Page.bringToFront")
  await page.waitFor(`!document.querySelector('.cmsg')`, 6000)
  // The projector window is in sight in a real room; a background tab gets
  // no animation frames, so its leave transition would never end.
  await proj.send("Page.bringToFront")
  await proj.waitFor(`!document.querySelector('.cmsg')`, 3000)
  await page.send("Page.bringToFront")
  pass("se quita sola a los 3 s, en la consola y en el proyector")

  await right(page)
  await proj.waitFor(`document.querySelector('.cmsg')?.innerText.includes('Hermana Marta')`, 5000)
  pass("al pasar al himno, aparece sola la felicitación colgada de él")
  await proj.send("Page.bringToFront")
  await sleep(900)
  await shot(proj, "felicitacion")
  await page.send("Page.bringToFront")
  await key(page, "x", "KeyX")
  await proj.send("Page.bringToFront")
  await proj.waitFor(`!document.querySelector('.cmsg')`, 3000)
  await page.send("Page.bringToFront")
  pass("X la quita")

  // M: write one now; a countdown counts down.
  await key(page, "m", "KeyM")
  await page.waitFor(`document.querySelector('[role=dialog]')?.innerText.includes('Mensaje nuevo')`, 5000)
  await clickText(page, "Cuenta regresiva", "[role=dialog]")
  await clickText(page, "Guardar y mostrar", "[role=dialog]")
  await proj.waitFor(`/[0-9]:[0-5][0-9]/.test(document.querySelector('.cmsg')?.innerText ?? '')`, 5000)
  const first = await cmsg(proj)
  await sleep(2200)
  const later = await cmsg(proj)
  check(first !== later && /4:5\d/.test(later), `M escribe uno y lo muestra: la cuenta regresiva baja («${first}» → «${later}»)`)
  await page.waitFor(`!document.querySelector('[role=dialog]')`, 5000)
  await key(page, "b", "KeyB")
  await proj.send("Page.bringToFront")
  await proj.waitFor(`!document.querySelector('.cmsg')`, 3000)
  await shot(proj, "negro")
  await page.send("Page.bringToFront")
  pass("pantalla en negro: el mensaje no se ve")
  await key(page, "b", "KeyB")
  await proj.waitFor(`document.querySelector('.cmsg')`, 3000)
  pass("al volver, sigue en pantalla")
  check((await page.evaluate(`JSON.parse(localStorage.getItem('cultos'))[0].messages.length`)) === 4, "el mensaje escrito en vivo queda guardado en el culto")
}
catch (err) {
  fail(err.stack)
}
finally {
  chrome.kill()
  server.close()
}
