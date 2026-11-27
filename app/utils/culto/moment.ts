import type { CultoItem, ScreenItem, ScreenMoment } from "~~/lib/culto";

import { normalizeLyric } from "~/utils/lyric-match";
import { SCREEN_MOMENT_LABELS } from "~~/lib/culto";

/**
 * How an element of a service is told apart in its order, in three layers
 * read from far to near:
 *
 * - the tone's colour is its family: hymns violet, the Word (reading,
 *   sermon) light blue, the Lord's supper orange, the offering lime, the
 *   moments in between grey;
 * - a solid tile marks the central moments (sermon, supper, offering); the
 *   recurring ones (hymns, readings) are light, the rest grey;
 * - the tile holds the hymn's number or the moment's icon.
 *
 * The colours of each tone are in main.css (.moment--<tone>).
 */
export type MomentTone = "hymn" | "word" | "word-solid" | "supper" | "offering" | "plain";

export type ItemLook = {
  /** "Himno", "Santa Cena", "Lectura"… */
  label: string;
  tone: MomentTone;
  /** Icon of the tile; none for a hymn, whose tile shows its number. */
  icon: string;
};

const SCREEN_LOOK: Record<ScreenMoment, { tone: MomentTone; icon: string }> = {
  welcome: { tone: "plain", icon: "i-tabler-mood-smile" },
  prayer: { tone: "plain", icon: "i-tabler-pray" },
  sermon: { tone: "word-solid", icon: "i-tabler-microphone" },
  supper: { tone: "supper", icon: "i-tabler-glass-full" },
  offering: { tone: "offering", icon: "i-tabler-gift" },
  notices: { tone: "plain", icon: "i-tabler-speakerphone" },
  farewell: { tone: "plain", icon: "i-tabler-door-exit" },
  other: { tone: "plain", icon: "i-tabler-presentation" },
};

/** Words that give a screen's moment away, for screens without one. */
const CLUES: [ScreenMoment, RegExp][] = [
  ["supper", /santa cena|cena del senor|memoria de mi/],
  ["offering", /ofrenda|diezmo|dador alegre/],
  ["sermon", /predicacion|sermon/],
  ["welcome", /bienvenid|nos alegra verte/],
  ["prayer", /oremos|oracion/],
  ["notices", /anuncio/],
  ["farewell", /despedida|hasta el domingo|hasta pronto/],
];

/** The moment a screen stands for: its own, or deduced from its text. */
export function screenMoment(item: ScreenItem): ScreenMoment {
  // One this version does not know (a file from a newer one): guessed.
  if (item.moment && item.moment in SCREEN_MOMENT_LABELS)
    return item.moment;
  const text = normalizeLyric(`${item.eyebrow} ${item.title}`);
  return CLUES.find(([, clue]) => clue.test(text))?.[0] ?? "other";
}

export function itemLook(item: CultoItem): ItemLook {
  switch (item.kind) {
    case "hymn":
      return { label: "Himno", tone: "hymn", icon: "" };
    case "reading":
      return { label: "Lectura", tone: "word", icon: "i-tabler-book" };
    case "slides":
      return { label: "Diapositivas", tone: "plain", icon: "i-tabler-slideshow" };
    default: {
      const moment = screenMoment(item);
      const look = SCREEN_LOOK[moment];
      const label = moment === "other"
        ? item.layout === "logo"
          ? "Logo"
          : item.layout === "image"
            ? "Imagen"
            : "Pantalla"
        : SCREEN_MOMENT_LABELS[moment];
      const icon = moment === "other" && item.layout === "logo"
        ? "i-tabler-building-church"
        : moment === "other" && item.layout === "image"
          ? "i-tabler-photo"
          : look.icon;
      return { label, tone: look.tone, icon };
    }
  }
}

/** A row's title in the order: a hymn's number is already on its tile. */
export function rowTitle(entry: { item: CultoItem; label: string }): string {
  const label = entry.label || itemLook(entry.item).label;
  return entry.item.kind === "hymn"
    ? label.replace(new RegExp(`^${entry.item.songId} · `), "")
    : label;
}

/** An element as it is read aloud: «Himno 217, Maravillosa gracia», «Santa Cena: …». */
export function spokenLabel(entry: { item: CultoItem; label: string }): string {
  const title = rowTitle(entry);
  const kind = itemLook(entry.item).label;
  if (entry.item.kind === "hymn")
    return `Himno ${entry.item.songId}, ${title}`;
  return kind && kind !== title
    ? `${kind}: ${title}`
    : title;
}

/** The family colour of a moment, for a section of it. */
export function momentTone(moment: ScreenMoment): MomentTone {
  return SCREEN_LOOK[moment].tone;
}
