import type { VerseRow } from "~~/lib/bible";
import type { Background, Culto, CultoItem, CultoSection, ProjectionTheme } from "~~/lib/culto";

// The service's program for the congregation: what the screen will show,
// read-only, to follow it on a phone. It travels inside a link, after the
// «#» (acapela.app/programa#v1.…), compressed: the server never receives
// it, nothing is stored anywhere, and it opens on any phone without
// installing Acapela. Hymns go as songbook and number (the phone has the
// hymnal); readings go with their text (phones do not download Bibles);
// presenter notes, messages and images stay on the computer.

const FORMAT = "acapela-programa";
const PREFIX = "v1.";

/** A reading's text as it was read on the computer. */
export type SharedPassage = {
  /** "Salmos 46:1-7" */
  label: string;
  /** "Reina-Valera 1960" */
  version: string;
  verses: VerseRow[];
};

export type Program = {
  format: typeof FORMAT;
  version: 1;
  /** The service's id: a newer program of the same service replaces the older one. */
  id: string;
  /** When it was shared (the service's last change). */
  rev: number;
  title: string;
  date: string;
  time?: string;
  theme: ProjectionTheme;
  items: CultoItem[];
  sections?: CultoSection[];
  /** By passageKey(reference, versionId). */
  passages: Record<string, SharedPassage>;
  /** The room it came with, on this phone (not part of the link's data). */
  sala?: string;
};

export function passageKey(reference: string, versionId: string | undefined): string {
  return `${versionId ?? ""}|${reference.trim()}`;
}

/** Every passage a service reads: its readings and its moments' passages. */
export function readingsOf(items: CultoItem[]): { reference: string; versionId?: string }[] {
  const out: { reference: string; versionId?: string }[] = [];
  for (const item of items) {
    if (item.kind === "reading" && item.reference.trim())
      out.push({ reference: item.reference, versionId: item.versionId || undefined });
    if (item.kind === "screen") {
      for (const part of item.parts ?? []) {
        if (part.kind === "reading" && part.reference.trim())
          out.push({ reference: part.reference, versionId: part.versionId || undefined });
      }
    }
  }
  return out;
}

/** An image stays on the computer: the theme's background takes its place. */
function noImage(background: Background | undefined): Background | undefined {
  return background?.kind === "image"
    ? undefined
    : background;
}

/** What the congregation sees: no notes, no images, nothing hidden by hand left behind. */
function forCongregation(item: CultoItem): CultoItem {
  // A plain deep copy: structuredClone fails on reactive data.
  const copy = JSON.parse(JSON.stringify(item)) as CultoItem;
  delete copy.notes;
  copy.background = noImage(copy.background);
  if (!copy.background)
    delete copy.background;
  if (copy.kind === "screen")
    delete copy.mediaId;
  return copy;
}

export function buildProgram(culto: Culto, theme: ProjectionTheme, passages: Record<string, SharedPassage>): Program {
  const look: ProjectionTheme = {
    ...JSON.parse(JSON.stringify(theme)) as ProjectionTheme,
    background: noImage(theme.background) ?? { kind: "acapela" },
  };
  delete look.logoId;
  return {
    format: FORMAT,
    version: 1,
    id: culto.id,
    rev: culto.updatedAt,
    title: culto.title,
    date: culto.date,
    ...(culto.time
      ? { time: culto.time }
      : {}),
    theme: look,
    items: culto.items.map(forCongregation),
    ...(culto.sections?.length
      ? {
          sections: JSON.parse(JSON.stringify(culto.sections)) as CultoSection[],
        }
      : {}),
    passages,
  };
}

// ------------------------------------------------------------ the link

function toBase64Url(bytes: Uint8Array): string {
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64 + "=".repeat((4 - b64.length % 4) % 4));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++)
    bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** The part of the link after «#». */
export async function encodeProgram(program: Program): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(program));
  return PREFIX + toBase64Url(await pipe(json, new CompressionStream("deflate-raw")));
}

export function programUrl(origin: string, encoded: string): string {
  return `${origin}/programa#${encoded}`;
}

/** Reads a link's «#…»; null when it is not a program. */
export async function decodeProgram(hash: string): Promise<Program | null> {
  const data = hash.replace(/^#/, "");
  if (!data.startsWith(PREFIX))
    return null;
  try {
    const bytes = await pipe(fromBase64Url(data.slice(PREFIX.length)), new DecompressionStream("deflate-raw"));
    const program = JSON.parse(new TextDecoder().decode(bytes)) as Program;
    return program?.format === FORMAT && Array.isArray(program.items) && program.id
      ? program
      : null;
  }
  catch {
    return null;
  }
}
