import { renderSVG } from "uqr";

// The room relay (relay/server.mjs, at acapela.app/sala): the live console
// publishes the service's program and what is on air; the congregation's
// phones follow it. A room is a 6-letter code (in the link and the QR) and
// a token that only the console that made it knows.

export type Room = {
  code: string;
  token: string;
  /** The paired remote's key, if a phone was paired. */
  control?: string;
};

/** What is on air, as the phones receive it. */
export type RelayNow = {
  itemId: string;
  /** The flat screen key ("itemId:screenKey"), as in the console. */
  key: string;
  index: number;
  black: boolean;
  at?: number;
};

// No 0/O, 1/I: codes are read aloud and typed.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function random(length: number, alphabet = ALPHABET): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map(b => alphabet[b % alphabet.length]).join("");
}

export function newRoom(): Room {
  return {
    code: random(6),
    token: random(32, `${ALPHABET}abcdefghijkmnpqrstuvwxyz`),
  };
}

/** The relay of this site; staging (only on the private network) uses production's. */
export function relayBase(): string {
  return window.location.hostname === "staging.acapela.app"
    ? "https://acapela.app/sala"
    : `${window.location.origin}/sala`;
}

/** The short link of a room's program (the QR's). */
export function roomUrl(code: string): string {
  return `${window.location.origin}/programa?sala=${code}`;
}

export class RoomTakenError extends Error {}

async function call(path: string, room: Room, method: "PUT" | "POST", body: unknown): Promise<number> {
  const res = await fetch(`${relayBase()}/${room.code}${path}`, {
    method,
    headers: {
      "authorization": `Bearer ${room.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (res.status === 403)
    throw new RoomTakenError("taken");
  if (!res.ok)
    throw new Error(`relay ${res.status}`);
  const data = await res.json() as { listeners?: number };
  return data.listeners ?? 0;
}

/** Publishes the program; how many phones are listening. */
export function publishProgram(room: Room, program: string, rev: number): Promise<number> {
  return call("", room, "PUT", { program, rev });
}

/** Publishes what is on air; how many phones are listening. */
export function publishNow(room: Room, now: RelayNow): Promise<number> {
  return call("/ahora", room, "POST", now);
}

/** A room's program («v1.…»), or null if the room has none. */
export async function fetchRoomProgram(code: string): Promise<{ program: string; rev: number } | null> {
  const res = await fetch(`${relayBase()}/${code}`);
  return res.ok
    ? await res.json() as { program: string; rev: number }
    : null;
}

/**
 * Listens to a room: a newer program, what is on air, and whether it is
 * connected. EventSource reconnects by itself. Returns a stop function.
 */
export function followRoom(code: string, on: {
  program?: (rev: number) => void;
  now?: (now: RelayNow) => void;
  status?: (connected: boolean) => void;
}): () => void {
  const source = new EventSource(`${relayBase()}/${code}/eventos`);
  source.addEventListener("open", () => on.status?.(true));
  source.addEventListener("error", () => on.status?.(false));
  source.addEventListener("program", (e) => {
    try {
      on.program?.(JSON.parse((e as MessageEvent).data).rev);
    }
    catch {}
  });
  source.addEventListener("now", (e) => {
    try {
      on.now?.(JSON.parse((e as MessageEvent).data));
    }
    catch {}
  });
  return () => source.close();
}

/** A QR code as SVG markup, dark on white. */
export function qrSvg(text: string): string {
  return renderSVG(text, { border: 2, ecc: "M" });
}

// ------------------------------------------------------------ the remote
// The presenter's phone as a remote control. The console pairs it with a
// key that travels only in the pairing link's «#» (shown as a QR in the
// console, never on the screen); the relay keeps its hash. The presenter's
// notes go to the phone encrypted with that key.

export type RemoteCommand = "next" | "prev" | "black" | "logo" | "content" | "goto" | "qr" | "hello";

/** What only the paired phone reads (encrypted). */
export type RemotePrivate = {
  itemId: string;
  notes: string;
  logo: boolean;
  qr: boolean;
};

export function newKey(): string {
  return random(32, `${ALPHABET}abcdefghijkmnpqrstuvwxyz`);
}

/** The pairing link: the phone opens /mando with the room and, after «#», the key. */
export function remoteUrl(code: string, key: string): string {
  return `${window.location.origin}/mando?sala=${code}#k=${key}`;
}

/** Pairs a remote with the room (a new key unpairs the previous phone). */
export async function pairRemote(room: Room, key: string): Promise<void> {
  await call("/mando", room, "PUT", { key });
}

export async function publishPrivate(room: Room, key: string, state: RemotePrivate): Promise<void> {
  await call("/mando/estado", room, "PUT", { sealed: await seal(key, state) });
}

export class NotPairedError extends Error {}

/** A command from the remote. */
export async function sendCommand(code: string, key: string, cmd: RemoteCommand, itemId = ""): Promise<void> {
  const res = await fetch(`${relayBase()}/${code}/mando`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ cmd, itemId }),
  });
  if (res.status === 403)
    throw new NotPairedError("not paired");
  if (!res.ok)
    throw new Error(`relay ${res.status}`);
}

/** The remote channel: commands (the console), the private state and a reset (the phone). */
export function followRemote(code: string, on: {
  cmd?: (cmd: RemoteCommand, itemId: string) => void;
  sealed?: (sealed: string) => void;
  reset?: () => void;
  status?: (connected: boolean) => void;
}): () => void {
  const source = new EventSource(`${relayBase()}/${code}/mando/eventos`);
  source.addEventListener("open", () => on.status?.(true));
  source.addEventListener("error", () => on.status?.(false));
  source.addEventListener("cmd", (e) => {
    try {
      const data = JSON.parse((e as MessageEvent).data) as { cmd: RemoteCommand; itemId: string };
      on.cmd?.(data.cmd, data.itemId);
    }
    catch {}
  });
  source.addEventListener("privado", (e) => {
    try {
      on.sealed?.(JSON.parse((e as MessageEvent).data).sealed);
    }
    catch {}
  });
  source.addEventListener("reset", () => on.reset?.());
  return () => source.close();
}

// AES-GCM with a key derived from the remote's key (SHA-256).
async function aesKey(key: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`acapela-mando:${key}`));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function b64(bytes: Uint8Array): string {
  let text = "";
  bytes.forEach(b => (text += String.fromCharCode(b)));
  return btoa(text);
}

export async function seal(key: string, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(key), new TextEncoder().encode(JSON.stringify(value))));
  const out = new Uint8Array(iv.length + data.length);
  out.set(iv);
  out.set(data, iv.length);
  return b64(out);
}

export async function unseal<T>(key: string, sealed: string): Promise<T | null> {
  try {
    const bytes = Uint8Array.from(atob(sealed), c => c.charCodeAt(0));
    const plain = await crypto.subtle.decrypt({
      name: "AES-GCM",
      iv: bytes.slice(0, 12),
    }, await aesKey(key), bytes.slice(12));
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  }
  catch {
    return null;
  }
}
