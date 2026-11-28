import { renderSVG } from "uqr";

// The room relay (relay/server.mjs, at acapela.app/sala): the live console
// publishes the service's program and what is on air; the congregation's
// phones follow it. A room is a 6-letter code (in the link and the QR) and
// a token that only the console that made it knows.

export type Room = { code: string; token: string };

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
