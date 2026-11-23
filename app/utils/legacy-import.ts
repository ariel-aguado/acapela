import { z } from "zod";

/**
 * Data handed over by the old Vercel deployments (acappella-*.vercel.app)
 * when they redirect here: `https://acapela.app/#import=<base64url JSON>`.
 * Each origin has its own localStorage, so this is the only way to keep a
 * user's songbook choice and favorites after the move.
 */
const LegacyPayload = z.object({
  v: z.literal(1),
  sb: z.string().regex(/^songbook(?:-[\w-]+)?$/).max(80).optional(),
  fav: z.array(z.number().int().min(1).max(10000)).max(2000).default([]),
  song: z.number().int().min(1).max(10000).optional(),
  font: z.number().int().min(10).max(60).optional(),
  hist: z.array(z.string().max(200)).max(50).default([]),
});

export type LegacyImportResult = {
  songbookId: string;
  favorites: number;
};

function decodeBase64Url(value: string): string {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null
      ? fallback
      : (JSON.parse(raw) as T);
  }
  catch {
    return fallback;
  }
}

/**
 * Applies a `#import=` payload (the URL hash read at startup), if present, to localStorage (before the
 * stores read it) and removes it from the URL. Never overwrites a choice
 * already made on this origin: favorites are merged, the rest is only
 * filled in when empty. Returns null when there was nothing (valid) to import.
 */
export function applyLegacyImport(hash: string, knownSongbookIds: string[]): LegacyImportResult | null {
  const match = /^#import=([\w-]+)$/.exec(hash);
  if (!match?.[1])
    return null;

  // Drop the payload from the URL right away (also on error), so a reload
  // or a shared link does not import again.
  history.replaceState(history.state, "", window.location.pathname + window.location.search);

  let data: z.infer<typeof LegacyPayload>;
  try {
    data = LegacyPayload.parse(JSON.parse(decodeBase64Url(match[1])));
  }
  catch (err) {
    console.warn("[legacy-import] invalid payload:", err);
    return null;
  }

  // useLocalStorage keeps strings raw (not JSON-encoded).
  const currentId = localStorage.getItem("songbookId") ?? "";
  const songbookId = data.sb && knownSongbookIds.includes(data.sb)
    ? data.sb
    : "";
  if (!songbookId)
    return null;

  if (!currentId)
    localStorage.setItem("songbookId", songbookId);

  const favs = readJson<Record<string, number[]>>("favoritesBySongbook", {});
  const merged = Array.from(new Set([
    ...(favs[songbookId] ?? []),
    ...data.fav,
  ]));
  localStorage.setItem("favoritesBySongbook", JSON.stringify({ ...favs, [songbookId]: merged }));

  const songIds = readJson<Record<string, number>>("songIdBySongbook", {});
  if (data.song && songIds[songbookId] === undefined)
    localStorage.setItem("songIdBySongbook", JSON.stringify({ ...songIds, [songbookId]: data.song }));

  if (data.font && localStorage.getItem("acappellaFontSize") === null)
    localStorage.setItem("acappellaFontSize", String(data.font));

  if (data.hist.length && readJson<string[]>("searchHistory", []).length === 0)
    localStorage.setItem("searchHistory", JSON.stringify(data.hist));

  return { songbookId, favorites: data.fav.length };
}
