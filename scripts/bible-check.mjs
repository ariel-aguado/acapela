// Bibles end to end, in a real Chrome: the version list loads, a version
// downloads into OPFS from Ajustes, a reference reads its verses, the same
// works again offline after a reload, and a second tab (a follower of the
// tab that runs the worker) reads too.
//
// Prereqs: pnpm generate (with the Bible data in data/biblias/), Google
// Chrome at /usr/bin/google-chrome
// Run: pnpm pwa:check:bible

import { spawn } from "node:child_process"
import { createReadStream, rmSync, writeFileSync } from "node:fs"
import { stat } from "node:fs/promises"
import { createServer } from "node:http"
import path from "node:path"
import process from "node:process"
import { setTimeout as sleep } from "node:timers/promises"

const PORT = 3210
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

const PROFILE = "/tmp/pwa-chrome-validation-bible"
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
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const msgId = ++id
    pending.set(msgId, { resolve, reject })
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
    await send("Page.navigate", { url })
    await sleep(500)
    await waitFor("document.readyState === 'complete'")
  }
  await send("Page.enable")
  await send("Runtime.enable")
  await send("Network.enable")
  return { send, evaluate, waitFor, goto, close: () => ws.close() }
}

async function newPage(url) {
  const res = await fetch(`http://localhost:${PORT + 1}/json/new?about:blank`, { method: "PUT" })
  const target = await res.json()
  const page = await connect(target.webSocketDebuggerUrl)
  await page.goto(url)
  return page
}

// Types into the "Probar una cita" field and returns the passage shown.
const tryReference = ref => `(async () => {
  const input = document.querySelector('#bible-try')
  input.value = ${JSON.stringify(ref)}
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.form.requestSubmit()
  for (let i = 0; i < 240; i++) {
    await new Promise(r => setTimeout(r, 250))
    const q = input.form.querySelector('blockquote')
    if (q) return q.innerText
    const msg = input.form.querySelector('p.text-sm.opacity-80')
    if (msg && msg.innerText) return 'MSG: ' + msg.innerText
  }
  return null
})()`

try {
  for (let i = 0; i < 40 && !serverReady; i++) await sleep(250)
  if (!serverReady)
    throw new Error("el servidor no arrancó")
  for (let i = 0; i < 40; i++) {
    if (await fetch(`http://localhost:${PORT + 1}/json/version`).then(r => r.ok).catch(() => false))
      break
    await sleep(250)
  }

  const manifest = await fetch(`${ORIGIN}/bibles/manifest.json`).then(r => r.json())
  if (manifest.versions.length)
    pass(`manifest con ${manifest.versions.length} versiones (${manifest.versions.map(v => v.id).join(", ")})`)
  else
    throw new Error("el manifest no tiene versiones: ¿faltan los .sqlite en data/biblias?")

  // First visit: pick a songbook so the app does not stop at the picker,
  // and let the service worker install.
  const songs = await fetch(`${ORIGIN}/songs/manifest.json`).then(r => r.json())
  const songbookId = (songs.songbooks ?? songs)[0].id
  const page = await newPage(`${ORIGIN}/`)
  await page.evaluate(`localStorage.setItem('songbookId', ${JSON.stringify(songbookId)})`)
  await page.goto(`${ORIGIN}/settings`)
  await page.waitFor("navigator.serviceWorker.controller !== null", 20000)
  pass("el service worker controla la página")

  const radios = await page.waitFor("document.querySelectorAll('input[name=bible-version]').length")
  radios === manifest.versions.length
    ? pass(`Ajustes muestra ${radios} versiones`)
    : fail(`Ajustes muestra ${radios} versiones, se esperaban ${manifest.versions.length}`)

  const rvr = manifest.versions.find(v => v.id === "rvr1960") ?? manifest.versions[0]
  await page.evaluate(`document.querySelector('[aria-label="Descargar ${rvr.label}"]').click()`)
  const sawProgress = await page.waitFor(`document.querySelector('[role=progressbar]') !== null || document.body.innerText.includes('funciona sin conexión')`, 20000)
  const started = Date.now()
  await page.waitFor(`[...document.querySelectorAll('label')].some(l => l.innerText.includes(${JSON.stringify(rvr.label)}) && l.innerText.includes('funciona sin conexión'))`, 120000)
  sawProgress
    ? pass(`${rvr.label} descargada a OPFS (${Math.round(rvr.sizeBytes / 1048576)} MB, ${((Date.now() - started) / 1000).toFixed(1)} s)`)
    : fail("no se vio el progreso de la descarga")

  const text1 = await page.evaluate(tryReference("sal 46:1-3"))
  text1?.includes("amparo") && text1.includes("braveza")
    ? pass(`«sal 46:1-3» → ${text1.split("\n")[0]}`)
    : fail(`«sal 46:1-3» devolvió: ${text1}`)

  const text2 = await page.evaluate(tryReference("1co13:4-7"))
  text2?.includes("sufrido")
    ? pass(`«1co13:4-7» → ${text2.split("\n")[0]}`)
    : fail(`«1co13:4-7» devolvió: ${text2}`)

  // Second tab: a follower talking to the worker of the first one.
  const second = await newPage(`${ORIGIN}/settings`)
  await second.waitFor("document.querySelector('#bible-try')")
  const text3 = await second.evaluate(tryReference("jn 3:16"))
  text3?.includes("unigénito")
    ? pass(`segunda pestaña: «jn 3:16» → ${text3.split("\n")[0]}`)
    : fail(`segunda pestaña: «jn 3:16» devolvió: ${text3}`)
  second.close()

  // Offline: reload with no network; manifest, wasm and the database come
  // from this device.
  await page.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  // Reload Ajustes from the service worker precache.
  await page.goto(`${ORIGIN}/settings`)
  await page.waitFor("document.querySelector('#bible-try') && document.querySelectorAll('input[name=bible-version]').length", 20000)
    .catch(async (err) => {
      if (process.env.DEBUG) {
        const shot = await page.send("Page.captureScreenshot", { format: "png" })
        writeFileSync(process.env.DEBUG, Buffer.from(shot.data, "base64"))
        console.log("  html:", await page.evaluate("location.href + ' ' + document.querySelector('#__nuxt')?.innerHTML.slice(0, 600)"))
      }
      throw err
    })
  const ready = await page.evaluate(`[...document.querySelectorAll('label')].some(l => l.innerText.includes(${JSON.stringify(rvr.label)}) && l.innerText.includes('funciona sin conexión'))`)
  ready
    ? pass(`sin conexión: ${rvr.label} sigue marcada como descargada`)
    : fail(`sin conexión: ${rvr.label} no figura como descargada`)
  const text4 = await page.evaluate(tryReference("Romanos 8:28"))
  text4?.includes("bien")
    ? pass(`sin conexión: «Romanos 8:28» → ${text4.split("\n")[0]}`)
    : fail(`sin conexión: «Romanos 8:28» devolvió: ${text4}`)
  page.close()
}
catch (err) {
  fail(err.message)
}
finally {
  chrome.kill()
  server.close()
}
