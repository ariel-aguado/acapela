// Acapela's room relay ("salas"): the live console tells the phones of the
// congregation which screen is on air, and hands them the service's program
// through a short code (acapela.app/programa?sala=K7M2QX, the QR on the
// screen). Nothing is written to disk: a room lives in memory, and goes 12
// hours after its last use. Only what the console publishes travels: the
// program (already public to whoever has the link) and the position.
//
// API, under /sala:
//   PUT  /sala/:code          Bearer token  {program, rev}   publish the program
//   POST /sala/:code/ahora    Bearer token  {itemId, key, index, black}
//   GET  /sala/:code                         → {program, rev}
//   GET  /sala/:code/eventos                 Server-Sent Events: program {rev}, now {...}
//   PUT  /sala/:code/mando          Bearer token  {key}        pairs a remote (a new key unpairs the old)
//   POST /sala/:code/mando          Bearer key    {cmd, itemId} a command from the presenter's phone
//   PUT  /sala/:code/mando/estado   Bearer token  {sealed}     the remote's private state, encrypted with its key
//   GET  /sala/:code/mando/eventos                 Server-Sent Events: cmd {...}, privado {sealed}, reset
//   GET  /sala/healthz
// The first PUT to a code claims it with its token; only that token
// publishes there afterwards. Codes and tokens are made by the console.
// The remote's key travels to the phone after the «#» of its pairing link:
// the relay only keeps its hash, and the notes it relays are encrypted.
//
// Run: node relay/server.mjs   (PORT, default 8090)

/* eslint-disable node/no-process-env, no-console -- a standalone server: its port comes from the environment and it logs its start. */
import { Buffer } from "node:buffer";
import { createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import process from "node:process";

const PORT = Number(process.env.PORT) || 8090;
const ROOM_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_ROOMS = 2000;
const MAX_CLIENTS = 10000;
const MAX_ROOM_CLIENTS = 1500;
const MAX_BODY = 512 * 1024;
const CODE = /^[A-HJ-NP-Z2-9]{6}$/;
const ORIGINS = [/^https:\/\/(?:www\.|staging\.)?acapela\.app$/, /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/];

/** @type {Map<string, {hash: Buffer | null, control: Buffer | null, program: string | null, rev: number, now: object | null, sealed: string | null, clients: Set<import("node:http").ServerResponse>, mando: Set<import("node:http").ServerResponse>, touched: number}>} */
const rooms = new Map();
let clients = 0;

const sha = text => createHash("sha256").update(text).digest();

function room(code, create = false) {
  let r = rooms.get(code);
  if (!r && create) {
    if (rooms.size >= MAX_ROOMS)
      sweep(true);
    if (rooms.size >= MAX_ROOMS)
      return null;
    r = {
      hash: null,
      control: null,
      program: null,
      rev: 0,
      now: null,
      sealed: null,
      clients: new Set(),
      mando: new Set(),
      touched: Date.now(),
    };
    rooms.set(code, r);
  }
  if (r)
    r.touched = Date.now();
  return r ?? null;
}

/** Rooms nobody uses go; under pressure, the oldest empty ones too. */
function sweep(pressed = false) {
  const now = Date.now();
  const limit = pressed
    ? 60 * 60 * 1000
    : ROOM_TTL_MS;
  for (const [code, r] of rooms) {
    if (!r.clients.size && !r.mando.size && now - r.touched > limit)
      rooms.delete(code);
  }
}
setInterval(sweep, 10 * 60 * 1000).unref();

function bearer(req) {
  return /^Bearer (\S{16,128})$/.exec(req.headers.authorization ?? "")?.[1] ?? null;
}

/** The paired remote's key. */
function remoteAuthorized(r, req) {
  const key = bearer(req);
  return !!key && !!r.control && timingSafeEqual(r.control, sha(key));
}

const COMMANDS = new Set([
  "next",
  "prev",
  "black",
  "logo",
  "content",
  "goto",
  "qr",
  "hello",
]);

/** The console's token: the first one claims the room. */
function authorized(r, req) {
  const token = bearer(req);
  if (!token)
    return false;
  const hash = sha(token);
  if (!r.hash) {
    r.hash = hash;
    return true;
  }
  return timingSafeEqual(r.hash, hash);
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ORIGINS.some(o => o.test(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
    res.setHeader("Access-Control-Max-Age", "86400");
  }
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      }
      catch {
        reject(Object.assign(new Error("bad json"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function send(r, event, data, to = r.clients) {
  const line = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of to)
    res.write(line);
}

function listen(req, res, code, channel = "clients") {
  const r = room(code, true);
  if (!r || clients >= MAX_CLIENTS || r[channel].size >= MAX_ROOM_CLIENTS)
    return json(res, 503, { error: "full" });
  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-store",
    "connection": "keep-alive",
    "x-accel-buffering": "no",
  });
  res.write("retry: 3000\n\n");
  if (channel === "mando") {
    if (r.sealed)
      res.write(`event: privado\ndata: ${JSON.stringify({ sealed: r.sealed })}\n\n`);
  }
  else {
    if (r.program)
      res.write(`event: program\ndata: ${JSON.stringify({ rev: r.rev })}\n\n`);
    if (r.now)
      res.write(`event: now\ndata: ${JSON.stringify(r.now)}\n\n`);
  }
  r[channel].add(res);
  clients++;
  const ping = setInterval(() => res.write(": ping\n\n"), 25000);
  req.on("close", () => {
    clearInterval(ping);
    if (r[channel].delete(res))
      clients--;
    r.touched = Date.now();
  });
}

/** The position: only these fields, short. */
function nowOf(body) {
  const str = (v, max) => typeof v === "string"
    ? v.slice(0, max)
    : "";
  return {
    itemId: str(body.itemId, 64),
    key: str(body.key, 128),
    index: Number.isInteger(body.index)
      ? body.index
      : 0,
    black: body.black === true,
    at: Date.now(),
  };
}

const server = createServer(async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS")
    return res.writeHead(204).end();
  const url = new URL(req.url ?? "/", "http://relay");
  const parts = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (parts[0] !== "sala")
    return json(res, 404, { error: "not found" });
  if (parts[1] === "healthz" && parts.length === 2)
    return json(res, 200, { ok: true, rooms: rooms.size, clients });
  const code = parts[1] ?? "";
  if (!CODE.test(code))
    return json(res, 404, { error: "not found" });
  const action = parts.slice(2).join("/");
  try {
    if (req.method === "GET" && action === "eventos")
      return listen(req, res, code);
    if (req.method === "GET" && action === "mando/eventos")
      return listen(req, res, code, "mando");
    if (req.method === "PUT" && action === "mando") {
      const body = await readBody(req);
      if (typeof body.key !== "string" || !/^\S{16,128}$/.test(body.key))
        return json(res, 400, { error: "bad key" });
      const r = room(code, true);
      if (!r)
        return json(res, 503, { error: "full" });
      if (!authorized(r, req))
        return json(res, 403, { error: "taken" });
      const fresh = sha(body.key);
      if (!r.control || !timingSafeEqual(r.control, fresh)) {
        r.control = fresh;
        r.sealed = null;
        send(r, "reset", {}, r.mando);
      }
      return json(res, 200, { ok: true });
    }
    if (req.method === "POST" && action === "mando") {
      const r = room(code);
      if (!r || !remoteAuthorized(r, req))
        return json(res, 403, { error: "not paired" });
      const body = await readBody(req);
      if (!COMMANDS.has(body.cmd))
        return json(res, 400, { error: "bad command" });
      send(r, "cmd", {
        cmd: body.cmd,
        itemId: typeof body.itemId === "string"
          ? body.itemId.slice(0, 64)
          : "",
        at: Date.now(),
      }, r.mando);
      return json(res, 200, { ok: true });
    }
    if (req.method === "PUT" && action === "mando/estado") {
      const body = await readBody(req);
      const r = room(code);
      if (!r || !authorized(r, req))
        return json(res, 403, { error: "taken" });
      if (typeof body.sealed !== "string" || body.sealed.length > 64 * 1024)
        return json(res, 400, { error: "bad state" });
      r.sealed = body.sealed;
      send(r, "privado", { sealed: r.sealed }, r.mando);
      return json(res, 200, { ok: true });
    }
    if (req.method === "GET" && !action) {
      const r = room(code);
      return r?.program
        ? json(res, 200, { program: r.program, rev: r.rev })
        : json(res, 404, { error: "no program" });
    }
    if (req.method === "PUT" && !action) {
      const body = await readBody(req);
      if (typeof body.program !== "string" || !body.program.startsWith("v1.") || !Number.isFinite(body.rev))
        return json(res, 400, { error: "bad program" });
      const r = room(code, true);
      if (!r)
        return json(res, 503, { error: "full" });
      if (!authorized(r, req))
        return json(res, 403, { error: "taken" });
      const changed = body.program !== r.program;
      r.program = body.program;
      r.rev = body.rev;
      if (changed)
        send(r, "program", { rev: r.rev });
      return json(res, 200, { listeners: r.clients.size });
    }
    if (req.method === "POST" && action === "ahora") {
      const body = await readBody(req);
      const r = room(code, true);
      if (!r)
        return json(res, 503, { error: "full" });
      if (!authorized(r, req))
        return json(res, 403, { error: "taken" });
      r.now = nowOf(body);
      send(r, "now", r.now);
      return json(res, 200, { listeners: r.clients.size });
    }
    return json(res, 404, { error: "not found" });
  }
  catch (err) {
    return json(res, err.status ?? 500, { error: err.message });
  }
});

server.listen(PORT, () => console.log(`acapela relay on :${PORT}`));
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    for (const r of rooms.values()) {
      for (const res of [
        ...r.clients,
        ...r.mando,
      ])
        res.end();
    }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
