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
    /** One of Acapela's gallery (app/utils/culto/backgrounds.ts). */
    | { kind: "gallery"; id: string }
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
/**
 * How one screen gives way to the next on the projector: few and calm, for
 * a congregation (cut, fade, slide like a page, rise, a slight zoom).
 */
export type TransitionKind = "cut" | "fade" | "slide" | "rise" | "zoom";
export type TransitionSpeed = "fast" | "normal" | "slow";
export type ScreenTransition = { kind: TransitionKind; speed: TransitionSpeed };

export const TRANSITION_LABELS: Record<TransitionKind, string> = {
  cut: "Corte",
  fade: "Fundido",
  slide: "Deslizar",
  rise: "Subir",
  zoom: "Acercar",
};
export const TRANSITION_SPEED_LABELS: Record<TransitionSpeed, string> = {
  fast: "Rápida",
  normal: "Normal",
  slow: "Lenta",
};
export const TRANSITION_MS: Record<TransitionSpeed, number> = {
  fast: 300,
  normal: 600,
  slow: 1000,
};

/** Almost unseen between stanzas, a little more marked between moments. */
export const DEFAULT_TRANSITIONS = {
  screen: { kind: "fade", speed: "fast" } as ScreenTransition,
  element: { kind: "fade", speed: "normal" } as ScreenTransition,
};

/** Where a hymn's number and title go on its screens. */
export type TitleCorner = "bottom-start" | "bottom-end" | "top-start" | "top-end";
export const TITLE_CORNER_LABELS: Record<TitleCorner, string> = {
  "top-start": "Arriba a la izquierda",
  "top-end": "Arriba a la derecha",
  "bottom-start": "Abajo a la izquierda",
  "bottom-end": "Abajo a la derecha",
};

export type ProjectionTheme = {
  churchName: string;
  logoId?: string;
  background: Background;
  /** Small labels on top ("SANTA CENA"). */
  accent: string;
  font: ProjectionFont;
  /** Between the screens of an element, and when the next element begins. */
  transitions?: { screen: ScreenTransition; element: ScreenTransition };
  /** A hymn's number and title; none: bottom left. */
  titleCorner?: TitleCorner;
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
  /** A hymn's number and title; none: bottom left. */
  titleCorner?: TitleCorner;
};

type ItemBase = {
  id: string;
  /** Its own background instead of the theme's. */
  background?: Background;
  /** For whoever leads the service; never projected. */
  notes?: string;
  /** Added from the live console during the service. */
  inserted?: boolean;
  /** The section it belongs to (Culto.sections); none: on its own in the order. */
  sectionId?: string;
  /** Its own transition (entering it and between its screens); none: the theme's. */
  transition?: ScreenTransition;
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
  /** Its number and title in another corner than the theme's. */
  titleCorner?: TitleCorner;
};

/** A designed screen: welcome, Lord's supper, offering, prayer… */
export type ScreenLayout = "title" | "quote" | "text" | "image" | "logo";
export type TextAlign = "start" | "center" | "end";

/** The texts of a screen that can have a style of their own. */
export type TextField = "eyebrow" | "title" | "reference" | "body";
/** A text's own style, over the screen's: its alignment and size (1 = as the layout makes it). */
export type FieldStyle = { align?: TextAlign; scale?: number };

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
 * Earlier model of a moment's extra screens, kept inside its title screen.
 * Services saved that way become a section on load (see the culto store):
 * the moment's screens are now elements of their own in the section.
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
  /** How its text lines up; none: centred for a title, to the left otherwise. */
  align?: TextAlign;
  /** A style of its own for some of its texts, over the screen's. */
  styles?: Partial<Record<TextField, FieldStyle>>;
  /** @deprecated Moved into a section on load. */
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

/**
 * A part of the service made of several elements: the Lord's supper with
 * its title screen, the passages read and a hymn; the offering with its
 * verse; the sermon with its references. Its elements are together in the
 * order (consecutive) and move with it.
 */
export type CultoSection = {
  id: string;
  moment: ScreenMoment;
  /** "Santa Cena": its name in the order; not projected. */
  title: string;
};

/**
 * A message laid over whatever is projected, without touching the slide:
 * an alert, a notice, a congratulation… Launched live from the console, or
 * hung on an element of the order so it shows when that element goes on air.
 */
export type MessageKind = "alert" | "notice" | "notification" | "congrats" | "welcome" | "prayer" | "countdown" | "ticker";
/** Nine places on the screen, or a band across its top or bottom. */
export type MessagePosition = "top-start" | "top" | "top-end" | "start" | "center" | "end" | "bottom-start" | "bottom" | "bottom-end" | "band-top" | "band-bottom";
export type MessageAnimation = "fade" | "slide" | "bounce" | "pulse" | "marquee" | "none";
export type MessageSize = "s" | "m" | "l" | "xl";

export type ScreenMessage = {
  id: string;
  kind: MessageKind;
  /** Small, on top ("ATENCIÓN"); may be empty. */
  title: string;
  text: string;
  position: MessagePosition;
  size: MessageSize;
  /** One of the projection fonts; "theme": the church's. */
  font: ProjectionFont | "theme";
  animation: MessageAnimation;
  /** Seconds on screen; 0: until it is taken off. A countdown counts these down. */
  duration: number;
  /** Shown by itself when this element goes on air, `delay` seconds later. */
  trigger?: { itemId: string; delay: number };
};

export const MESSAGE_KIND_LABELS: Record<MessageKind, string> = {
  alert: "Alerta",
  notice: "Aviso",
  notification: "Notificación",
  congrats: "Felicitación",
  welcome: "Bienvenida",
  prayer: "Pedido de oración",
  countdown: "Cuenta regresiva",
  ticker: "Cinta de anuncios",
};

/** What each kind starts with: its place, look and motion. */
export const MESSAGE_TEMPLATES: Record<MessageKind, Omit<ScreenMessage, "id" | "kind" | "trigger"> & { hint: string }> = {
  alert: {
    hint: "Urgente: arriba, a lo ancho, en rojo.",
    title: "Atención",
    text: "Se solicita al dueño del auto gris acercarse a la entrada.",
    position: "band-top",
    size: "m",
    font: "roboto",
    animation: "slide",
    duration: 30,
  },
  notice: {
    hint: "Abajo a la izquierda, discreto.",
    title: "Hoy",
    text: "Estudio bíblico a las 19:00.",
    position: "bottom-start",
    size: "m",
    font: "theme",
    animation: "slide",
    duration: 10,
  },
  notification: {
    hint: "Una tarjeta pequeña en la esquina.",
    title: "Guardería",
    text: "Los padres de Sofía, por favor acérquense.",
    position: "top-end",
    size: "s",
    font: "theme",
    animation: "fade",
    duration: 10,
  },
  congrats: {
    hint: "Al centro, con rebote: para celebrar.",
    title: "¡Feliz cumpleaños!",
    text: "Que el Señor te bendiga.",
    position: "center",
    size: "l",
    font: "literata",
    animation: "bounce",
    duration: 10,
  },
  welcome: {
    hint: "Una banda abajo, para las visitas.",
    title: "¡Bienvenidos!",
    text: "Nos alegra que nos visites hoy.",
    position: "band-bottom",
    size: "m",
    font: "literata",
    animation: "slide",
    duration: 10,
  },
  prayer: {
    hint: "Sereno, abajo al centro.",
    title: "Oremos",
    text: "Por los hermanos enfermos.",
    position: "bottom",
    size: "m",
    font: "literata",
    animation: "fade",
    duration: 30,
  },
  countdown: {
    hint: "Cuenta los minutos que faltan; late suave.",
    title: "El culto comienza en",
    text: "",
    position: "center",
    size: "xl",
    font: "theme",
    animation: "pulse",
    duration: 300,
  },
  ticker: {
    hint: "Texto que corre abajo, sin tapar la letra.",
    title: "Avisos",
    text: "Cena fraternal el sábado a las 20:00 · Ensayo de canto el jueves",
    position: "band-bottom",
    size: "s",
    font: "theme",
    animation: "marquee",
    duration: 0,
  },
};

export const MESSAGE_POSITION_LABELS: Record<MessagePosition, string> = {
  "top-start": "Arriba a la izquierda",
  "top": "Arriba al centro",
  "top-end": "Arriba a la derecha",
  "start": "Al centro a la izquierda",
  "center": "En el centro",
  "end": "Al centro a la derecha",
  "bottom-start": "Abajo a la izquierda",
  "bottom": "Abajo al centro",
  "bottom-end": "Abajo a la derecha",
  "band-top": "Banda arriba",
  "band-bottom": "Banda abajo",
};
export const MESSAGE_ANIMATION_LABELS: Record<MessageAnimation, string> = {
  fade: "Aparecer",
  slide: "Deslizar",
  bounce: "Rebote",
  pulse: "Latido",
  marquee: "Marquesina",
  none: "Sin animación",
};
export const MESSAGE_SIZE_LABELS: Record<MessageSize, string> = {
  s: "Pequeño",
  m: "Mediano",
  l: "Grande",
  xl: "Enorme",
};

export type Culto = {
  id: string;
  title: string;
  /** yyyy-mm-dd */
  date: string;
  /** "HH:MM", when there is more than one on a day; optional. */
  time?: string;
  items: CultoItem[];
  sections?: CultoSection[];
  /** Messages over the screen, ready to be launched or hung on an element. */
  messages?: ScreenMessage[];
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
