/**
 * A worship service ("culto"): an ordered list of elements, each turned
 * into one or more projected screens. Only the source is stored (which
 * hymn, which passage, what text); the screens are computed from it at
 * projection size (app/composables/use-culto-screens.ts), so changing the
 * text, the letter size or inserting something re-flows everything after.
 */

/** What is behind the text of a screen. */
export type Background
  = | { kind: "acapela" }
    | { kind: "color"; color: string }
    | { kind: "image"; mediaId: string };

export type ProjectionFont = "inter" | "literata" | "roboto-serif" | "merriweather" | "roboto" | "open-sans" | "figtree" | "atkinson";

export const PROJECTION_FONTS: { id: ProjectionFont; label: string; css: string }[] = [
  { id: "inter", label: "Inter", css: "\"Inter\", sans-serif" },
  { id: "figtree", label: "Figtree", css: "\"Figtree\", sans-serif" },
  { id: "open-sans", label: "Open Sans", css: "\"Open Sans\", sans-serif" },
  { id: "roboto", label: "Roboto", css: "\"Roboto\", sans-serif" },
  { id: "atkinson", label: "Atkinson Hyperlegible", css: "\"Atkinson Hyperlegible\", sans-serif" },
  { id: "literata", label: "Literata", css: "\"Literata\", Georgia, serif" },
  { id: "roboto-serif", label: "Roboto Serif", css: "\"Roboto Serif\", Georgia, serif" },
  { id: "merriweather", label: "Merriweather", css: "\"Merriweather\", Georgia, serif" },
];

/**
 * The church's look on the projector, for every service on this device:
 * its name (bottom of the screens), logo, background, accent and letter.
 * Only fonts the app ships, so the projector shows them offline.
 */
export type ProjectionTheme = {
  churchName: string;
  logoId?: string;
  background: Background;
  /** Small labels on top ("SANTA CENA"). */
  accent: string;
  font: ProjectionFont;
};

export const DEFAULT_THEME: ProjectionTheme = {
  churchName: "",
  background: { kind: "acapela" },
  accent: "#ffffff",
  font: "inter",
};

/** A theme resolved for one screen; travels with it to the projector. */
export type Look = {
  background: Background;
  accent: string;
  /** CSS font-family. */
  font: string;
  /** Dark text, for a light background. */
  darkText: boolean;
};

type ItemBase = {
  id: string;
  /** Its own background instead of the theme's. */
  background?: Background;
  /** For whoever leads the service; never projected. */
  notes?: string;
  /** Added from the live console during the service. */
  inserted?: boolean;
  /** Text size for this element, 1 = automatic (0.6–1.5). */
  scale?: number;
  /**
   * Hand-made changes to its screens, as in SúperBiblia's screen manager.
   * Keys stay valid when the text re-flows: a hymn screen is its verse's
   * position; a text screen, the first piece of text on it.
   */
  screenOrder?: string[];
  hidden?: string[];
  /** Piece id → start a new screen there (true) or not (false). */
  breaks?: Record<string, boolean>;
};

export type HymnItem = ItemBase & {
  kind: "hymn";
  /** Songbook the number belongs to (the same number is a different hymn in each one). */
  songbookId: string;
  songId: number;
};

/** A designed screen: welcome, Lord's supper, offering, prayer… */
export type ScreenLayout = "title" | "quote" | "text" | "image" | "logo";

/**
 * Which moment of the service a screen is: it decides how the screen is told
 * apart in the order (icon and colour). Set by the template it came from or
 * chosen in its editor; deduced from its text for services made before it
 * existed (app/utils/culto/moment.ts).
 */
export type ScreenMoment = "welcome" | "prayer" | "sermon" | "supper" | "offering" | "notices" | "farewell" | "other";

export const SCREEN_MOMENT_LABELS: Record<ScreenMoment, string> = {
  welcome: "Bienvenida",
  prayer: "Oración",
  sermon: "Predicación",
  supper: "Santa Cena",
  offering: "Ofrenda",
  notices: "Anuncios",
  farewell: "Despedida",
  other: "Otra pantalla",
};

/**
 * More screens of a moment, after its own: the Lord's supper with the
 * passages read during it, the offering with its verse, the sermon with
 * its references. A passage is split into as many screens as it needs, as
 * a reading is; a text page is a screen like the moment's own.
 */
export type MomentPart
  = | {
    id: string;
    kind: "reading";
    /** As typed or picked: "1 Co 11:23-26". */
    reference: string;
    versionId: string;
    mode: ReadingMode;
  }
  | {
    id: string;
    kind: "text";
    layout: "title" | "quote" | "text";
    eyebrow: string;
    title: string;
    body: string;
    reference: string;
  };

export type ScreenItem = ItemBase & {
  kind: "screen";
  layout: ScreenLayout;
  moment?: ScreenMoment;
  /** Its other screens, in order, after its own. */
  parts?: MomentPart[];
  /** Small label on top ("SANTA CENA"). */
  eyebrow: string;
  title: string;
  /** More text: split across screens when it does not fit. */
  body: string;
  /** Under the title ("1 Corintios 11:24"). */
  reference: string;
  /** The picture of the "image" layout (a flyer, a photo). */
  mediaId?: string;
};

export type ReadingMode = "fit" | "verse";
export type ReadingItem = ItemBase & {
  kind: "reading";
  /** As typed: "Sal 46:1-7", "jn 3:16". */
  reference: string;
  versionId: string;
  /** fit: as many verses as fit per screen; verse: one verse per screen. */
  mode: ReadingMode;
};

/** Slides brought from a PDF or images (the sermon's): one screen each, as they are. */
export type SlidesItem = ItemBase & {
  kind: "slides";
  title: string;
  /** Images in IndexedDB (app/utils/culto/media.ts), in order. */
  pages: string[];
};

export type CultoItem = HymnItem | ScreenItem | ReadingItem | SlidesItem;
export type CultoItemKind = CultoItem["kind"];

export type Culto = {
  id: string;
  title: string;
  /** yyyy-mm-dd */
  date: string;
  items: CultoItem[];
  updatedAt: number;
  /**
   * The free projection ("Proyectar himno"): hymns projected one after the
   * other without preparing a service. One per device, for the day; it is
   * not listed among the services until it is saved as one.
   */
  quick?: boolean;
};

export const SCREEN_LAYOUT_LABELS: Record<ScreenLayout, string> = {
  title: "Título",
  quote: "Cita",
  text: "Texto",
  image: "Imagen",
  logo: "Logo",
};

export const ITEM_KIND_LABELS: Record<CultoItemKind, string> = {
  hymn: "Himno",
  screen: "Pantalla",
  reading: "Lectura",
  slides: "Diapositivas",
};
