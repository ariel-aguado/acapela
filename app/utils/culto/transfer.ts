import { nanoid } from "nanoid";

import type { Culto, CultoItem, ProjectionTheme } from "~~/lib/culto";

import { getMedia, putMediaWithId } from "./media";

// A service as a file, to take it to another device (prepared on the phone,
// projected from the church's computer) or to share it: the service, the
// church's theme and every image it uses, in one JSON file. No server.

const FORMAT = "acapela-culto";

type MediaEntry = { name: string; type: string; data: string };

export type CultoFile = {
  format: typeof FORMAT;
  version: 1;
  culto: Culto;
  theme?: ProjectionTheme;
  media: Record<string, MediaEntry>;
};

function mediaIdsOf(culto: Culto, theme?: ProjectionTheme): string[] {
  const ids = new Set<string>();
  const add = (id?: string) => id && ids.add(id);
  const bg = (b?: CultoItem["background"]) => b?.kind === "image" && add(b.mediaId);
  for (const item of culto.items) {
    bg(item.background);
    if (item.kind === "screen")
      add(item.mediaId);
    if (item.kind === "slides")
      item.pages.forEach(add);
  }
  if (theme) {
    add(theme.logoId);
    bg(theme.background);
  }
  return [...ids];
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function exportCulto(culto: Culto, theme: ProjectionTheme): Promise<File> {
  const media: Record<string, MediaEntry> = {};
  for (const id of mediaIdsOf(culto, theme)) {
    const record = await getMedia(id);
    if (record)
      media[id] = { name: record.name, type: record.blob.type, data: await toDataUrl(record.blob) };
  }
  const file: CultoFile = {
    format: FORMAT,
    version: 1,
    culto,
    theme,
    media,
  };
  const name = `${culto.title} ${culto.date}`.replace(/[^\p{L}\p{N} -]+/gu, "").trim().replace(/\s+/g, "-");
  return new File([
    JSON.stringify(file),
  ], `${name || "culto"}.acapela.json`, { type: "application/json" });
}

/** Reads a service file: its images go to this device, the service gets a new id. */
export async function importCulto(file: Blob): Promise<{ culto: Culto; theme?: ProjectionTheme }> {
  let data: CultoFile;
  try {
    data = JSON.parse(await file.text());
  }
  catch {
    throw new Error("El archivo no es un culto de Acapela.");
  }
  if (data?.format !== FORMAT || !data.culto?.items)
    throw new Error("El archivo no es un culto de Acapela.");
  for (const [id, entry] of Object.entries(data.media ?? {})) {
    const blob = await (await fetch(entry.data)).blob();
    await putMediaWithId(id, blob, entry.name);
  }
  const culto: Culto = {
    ...data.culto,
    id: nanoid(10),
    updatedAt: Date.now(),
  };
  return { culto, theme: data.theme };
}

/**
 * Whether this browser can hand a file to the system's share sheet (phones,
 * Chrome on Windows, Safari on a Mac; not Chrome on Linux).
 */
export function canShareFiles(): boolean {
  try {
    return !!navigator.canShare?.({
      files: [
        new File([""], "culto.acapela.json", { type: "application/json" }),
      ],
    });
  }
  catch {
    return false;
  }
}

/** Opens the share sheet with the file (WhatsApp, email…); false if not shared. */
export async function shareFile(file: File): Promise<boolean> {
  try {
    await navigator.share({
      files: [file],
      title: file.name,
    });
    return true;
  }
  catch {
    return false;
  }
}

/** Saves the file in the device's downloads. */
export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
