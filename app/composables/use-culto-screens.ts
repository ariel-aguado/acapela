import type { PageItem } from "~/utils/culto/paginate";
import type { Screen } from "~/utils/culto/screens";
import type { CultoItem, MomentPart, ProjectionTheme, ReadingItem, ScreenItem } from "~~/lib/culto";
import type { Song } from "~~/lib/types";

import { resolveLook } from "~/utils/culto/look";
import { paginate } from "~/utils/culto/paginate";
import { PAGE_BODY_PX, renderPage, textPieces, versePieces } from "~/utils/culto/screens";
import { SCREEN_LAYOUT_LABELS } from "~~/lib/culto";

/** A screen of an element as the screen manager sees it. */
export type ManagedScreen = {
  /** Stable while the text re-flows: see ItemBase.screenOrder. */
  key: string;
  screen: Screen;
  hidden: boolean;
  /** Position before any reordering. */
  natural: number;
  /** It starts at a break (one verse per screen, or one made by hand): it can be joined to the previous one. */
  joinId?: string;
  /** Where a new screen could start inside this one. */
  cuts?: { id: string; label: string }[];
};

export type ItemScreens = {
  item: CultoItem;
  /** Name of the element in lists ("12 · El nombre de Dios", "Salmos 46:1-7"). */
  label: string;
  status: "ready" | "loading" | "error";
  error?: string;
  /** Every screen, in the chosen order, hidden ones too. */
  all: ManagedScreen[];
  /** What is projected: the visible ones, in order. */
  screens: Screen[];
  /** Their keys, in the same order. */
  keys: string[];
  /** A moment's passages that could not be read, by part id: the rest is still projected. */
  partErrors?: Record<string, string>;
};

/** One screen in the order of the whole service. */
export type FlatScreen = {
  key: string;
  itemId: string;
  itemIndex: number;
  /** Position among its element's projected screens. */
  index: number;
  /** The screen's stable key inside its element (ManagedScreen.key). */
  screenKey: string;
  screen: Screen;
};

type PageScreen = Extract<Screen, { type: "page" }>;
type Natural = { label: string; screens: Omit<ManagedScreen, "hidden">[]; partErrors?: Record<string, string> };

// ------------------------------------------------------------ measuring
// One invisible stage, the size of the projected one, for every page.

let stage: HTMLElement | null = null;

function measuringStage(): HTMLElement {
  if (stage?.isConnected)
    return stage;
  const wrap = document.createElement("div");
  wrap.setAttribute("aria-hidden", "true");
  wrap.style.cssText = "position:fixed;left:-30000px;top:0;width:1920px;height:1080px;visibility:hidden;pointer-events:none;overflow:hidden";
  stage = document.createElement("div");
  stage.className = "projection-stage";
  stage.style.cssText = "width:1920px;height:1080px";
  wrap.appendChild(stage);
  document.body.appendChild(wrap);
  return stage;
}

// Measuring is synchronous DOM work on a single stage: one at a time.
let queue: Promise<unknown> = Promise.resolve();
function measured<T>(run: () => Promise<T>): Promise<T> {
  const next = queue.then(run, run);
  queue = next.catch(() => {});
  return next;
}

/**
 * Splits a text page into as many screens as it needs: the title and
 * reference only on the first one, the eyebrow on all of them.
 */
async function paginatePage(base: PageScreen, pieces: PageItem[], font: string): Promise<PageItem[][]> {
  return measured(async () => {
    const el = measuringStage();
    el.style.setProperty("--proj-font", font);
    el.innerHTML = renderPage(base, "");
    await document.fonts?.load(`600 ${Math.round(PAGE_BODY_PX * base.scale)}px ${font}`).catch(() => {});
    await document.fonts?.ready;
    const body = el.querySelector<HTMLElement>(".page-body")!;
    const title = el.querySelector<HTMLElement>(".page-title");
    const reference = el.querySelector<HTMLElement>(".page-reference");
    const pages = paginate(body, pieces, (n) => {
      for (const node of [title, reference]) {
        if (node) {
          node.style.display = n === 0
            ? ""
            : "none";
        }
      }
    });
    el.innerHTML = "";
    return pages;
  });
}

/** Hand-made breaks over the natural ones. */
function withBreaks(pieces: PageItem[], breaks: Record<string, boolean> | undefined): PageItem[] {
  if (!breaks)
    return pieces;
  return pieces.map(p => p.id in breaks
    ? { ...p, breakBefore: breaks[p.id]! }
    : p);
}

function plainStart(html: string): string {
  const text = html.replace(/<sup>[^<]*<\/sup>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = text.split(" ").slice(0, 6).join(" ");
  return words.length < text.length
    ? `${words}…`
    : words;
}

/** Manager data of a paginated screen: its key, and where it can be joined or cut. */
function pageMeta(page: PageItem[], i: number) {
  const first = page[0];
  return {
    key: first
      ? `p:${first.key}`
      : `p${i}`,
    joinId: i > 0 && first && first.part === 0 && first.breakBefore
      ? first.id
      : undefined,
    cuts: page.slice(1).filter(p => p.part === 0).map(p => ({
      id: p.id,
      label: plainStart(p.html),
    })),
  };
}

// ------------------------------------------------------------ per kind

/** `prefix` keeps a moment's extra pages apart from its own (keys and break ids). */
async function screenPages(item: ScreenItem, theme: ProjectionTheme, prefix = ""): Promise<Natural["screens"]> {
  const logo = item.layout === "logo";
  const base: PageScreen = {
    type: "page",
    layout: item.layout,
    eyebrow: item.eyebrow.trim(),
    // The logo screen is the church's: its name under the logo.
    title: item.title.trim() || (logo
      ? theme.churchName
      : ""),
    reference: item.reference.trim(),
    html: "",
    footer: logo
      ? ""
      : theme.churchName,
    counter: "",
    scale: item.scale ?? 1,
    mediaId: logo
      ? theme.logoId
      : item.mediaId,
    align: item.align,
  };
  if (item.layout !== "text" || !item.body.trim()) {
    return [
      { key: `${prefix}p0`, screen: base, natural: 0 },
    ];
  }
  const font = resolveLook(theme, item).font;
  const pages = await paginatePage(base, withBreaks(textPieces(item.body, `${item.id}:${prefix}`), item.breaks), font);
  return pages.map((page, i) => ({
    ...pageMeta(page, i),
    natural: i,
    screen: {
      ...base,
      title: i === 0
        ? base.title
        : "",
      reference: i === 0
        ? base.reference
        : "",
      html: page.map(p => p.html).join(""),
    },
  }));
}

async function readingPages(item: ReadingItem, theme: ProjectionTheme, prefix = ""): Promise<Natural> {
  const bible = useBibleStore();
  const passage = await bible.passage(item.reference, item.versionId || undefined);
  if (!passage || !passage.verses.length)
    throw new Error(`No reconozco la cita «${item.reference}».`);
  const version = bible.versions.find(v => v.id === passage.versionId)?.label ?? "";
  const base: PageScreen = {
    type: "page",
    layout: "text",
    eyebrow: passage.label,
    title: "",
    reference: "",
    html: "",
    footer: version,
    counter: "",
    scale: item.scale ?? 1,
  };
  const pages = await paginatePage(base, withBreaks(versePieces(passage.verses, item.mode === "verse", prefix), item.breaks), resolveLook(theme, item).font);
  const first = passage.verses[0]!;
  return {
    label: passage.label,
    screens: pages.map((page, i) => {
      const html = page.map(p => p.html).join("");
      // The verses on this screen, for its eyebrow ("Salmos 46:2-3").
      const numbers = html.match(/data-v="(\d+)"/g)?.map(m => Number(m.slice(8, -1))) ?? [];
      const lo = Math.min(...numbers);
      const hi = Math.max(...numbers);
      const chapter = passage.verses.find(v => v.verse === lo)?.chapter ?? first.chapter;
      return {
        ...pageMeta(page, i),
        natural: i,
        screen: {
          ...base,
          eyebrow: numbers.length
            ? `${first.bookName} ${chapter}:${lo}${hi > lo
              ? `-${hi}`
              : ""}`
            : passage.label,
          html,
        },
      };
    }),
  };
}

/**
 * A moment's screens: its own, then each of its parts, in order. A passage
 * that cannot be read is left out and reported, so one wrong reference does
 * not take the Lord's supper off the screen.
 */
async function momentPages(item: ScreenItem, theme: ProjectionTheme): Promise<Omit<Natural, "label">> {
  const screens: Natural["screens"] = [
    ...await screenPages(item, theme),
  ];
  const partErrors: Record<string, string> = {};
  for (const part of item.parts ?? []) {
    const prefix = `${part.id}:`;
    try {
      const pages = part.kind === "reading"
        ? (await readingPages(partAsReading(item, part), theme, prefix)).screens
        : await screenPages(partAsScreen(item, part), theme, prefix);
      screens.push(...pages);
    }
    catch (err) {
      partErrors[part.id] = err instanceof Error
        ? err.message
        : String(err);
    }
  }
  return {
    screens: screens.map((s, i) => ({ ...s, natural: i })),
    partErrors: Object.keys(partErrors).length
      ? partErrors
      : undefined,
  };
}

/** A moment's passage as a reading of the moment (its size, look and breaks). */
function partAsReading(item: ScreenItem, part: Extract<MomentPart, { kind: "reading" }>): ReadingItem {
  return {
    id: item.id,
    kind: "reading",
    reference: part.reference,
    versionId: part.versionId,
    mode: part.mode,
    scale: item.scale,
    background: item.background,
    breaks: item.breaks,
  };
}

function partAsScreen(item: ScreenItem, part: Extract<MomentPart, { kind: "text" }>): ScreenItem {
  return {
    id: item.id,
    kind: "screen",
    layout: part.layout,
    eyebrow: part.eyebrow,
    title: part.title,
    body: part.body,
    reference: part.reference,
    scale: item.scale,
    background: item.background,
    breaks: item.breaks,
  };
}

// ------------------------------------------------------------ order and hidden

/**
 * Order chosen by dragging (SúperBiblia's orderSlideKeys): saved keys in
 * their order; keys not saved (the text re-flowed) right after the screen
 * that precedes them, so they do not jump to the end.
 */
export function orderKeys(keys: string[], order: readonly string[] | undefined): string[] {
  if (!order?.length)
    return keys;
  const rank = new Map(order.map((key, i) => [key, i]));
  let last = -1;
  let extra = 0;
  const ranked = keys.map((key, natural) => {
    const known = rank.get(key);
    if (known !== undefined) {
      last = known;
      extra = 0;
      return { key, rank: known, natural };
    }
    extra++;
    return { key, rank: last + extra / (keys.length + 1), natural };
  });
  return ranked.sort((a, b) => a.rank - b.rank || a.natural - b.natural).map(r => r.key);
}

function arrange(item: CultoItem, natural: Natural["screens"], theme: ProjectionTheme): Pick<ItemScreens, "all" | "screens" | "keys"> {
  // The church's look, resolved for this element, travels with each screen.
  const look = resolveLook(theme, item);
  natural = natural.map(s => s.screen.type === "image"
    ? s
    : {
        ...s,
        screen: { ...s.screen, look },
      });
  const byKey = new Map(natural.map(s => [s.key, s]));
  const hidden = new Set(item.hidden ?? []);
  const all = orderKeys(natural.map(s => s.key), item.screenOrder)
    .map(key => ({
      ...byKey.get(key)!,
      hidden: hidden.has(key),
    }));
  const visible = all.filter(s => !s.hidden);
  // "2 / 4" counts what is projected, in its order.
  const screens = visible.map((s, i) => s.screen.type === "page" && visible.length > 1 && natural.length > 1
    ? { ...s.screen, counter: `${i + 1} / ${visible.length}` }
    : s.screen);
  return {
    all,
    screens,
    keys: visible.map(s => s.key),
  };
}

// ------------------------------------------------------------ composable

/** What changes the measured screens (not the order, the hidden ones or the notes). */
function signature(item: CultoItem, theme: ProjectionTheme): string {
  const { notes: _n, inserted: _i, screenOrder: _o, hidden: _h, background: _b, ...rest } = item;
  // The letter changes how much fits; the name and logo appear on screens.
  return JSON.stringify([
    rest,
    theme.font,
    theme.churchName,
    theme.logoId,
  ]);
}

/**
 * The screens of each element of a service, recomputed only for the
 * elements that change. Hymns come from the songbook already loaded; pages
 * and readings are paginated at projection size. Hand-made order and
 * hidden screens are applied on top, without measuring again.
 */
export function useCultoScreens(items: MaybeRefOrGetter<CultoItem[]>) {
  const songStore = useSongStore();
  const songbookStore = useSongbookStore();
  const presentation = usePresentationStore();
  const { songs } = storeToRefs(songStore);
  const { currentId: songbookId, manifest } = storeToRefs(songbookStore);
  const { theme } = storeToRefs(useCultoStore());

  // Measured results by item id, valid while the signature matches.
  const done = shallowRef(new Map<string, { sig: string; result: Natural | { error: string } }>());
  const pending = new Set<string>();

  function setResult(id: string, sig: string, result: Natural | { error: string }) {
    const next = new Map(done.value);
    next.set(id, { sig, result });
    done.value = next;
  }

  function labelOf(item: CultoItem): string {
    if (item.kind === "screen")
      return item.title.trim() || item.eyebrow.trim() || SCREEN_LAYOUT_LABELS[item.layout];
    if (item.kind === "reading")
      return item.reference;
    if (item.kind === "slides")
      return item.title.trim() || "Diapositivas";
    return `Himno ${item.songId}`;
  }

  function failed(item: CultoItem, error: string, label = labelOf(item)): ItemScreens {
    return {
      item,
      label,
      status: "error",
      error,
      all: [],
      screens: [],
      keys: [],
    };
  }

  function hymnScreens(item: Extract<CultoItem, { kind: "hymn" }>): ItemScreens {
    // Another songbook than the one in Ajustes: read on the side.
    const other = item.songbookId !== songbookId.value;
    const meta = manifest.value.find(s => s.id === item.songbookId);
    let list: Song[] = songs.value;
    if (other) {
      const result = manifest.value.length
        ? songsOf(item.songbookId, meta?.file)
        : undefined;
      if (result instanceof Error)
        return failed(item, `No se pudo leer el himnario ${meta?.name ?? item.songbookId}.`);
      if (!result) {
        return {
          item,
          label: labelOf(item),
          status: "loading",
          all: [],
          screens: [],
          keys: [],
        };
      }
      list = result;
    }
    const song = list[item.songId - 1];
    if (!song) {
      return list.length
        ? failed(item, `No hay himno ${item.songId} en este himnario.`)
        : {
            item,
            label: labelOf(item),
            status: "loading",
            all: [],
            screens: [],
            keys: [],
          };
    }
    const scale = item.scale ?? presentation.scaleFor(song.songId);
    const natural = buildSlides(song).map((slide, i) => ({
      key: `s${i}`,
      natural: i,
      screen: {
        type: "lyric" as const,
        slide,
        number: song.songId,
        title: song.title,
        scale,
      },
    }));
    return {
      item,
      label: other
        ? `${song.songId} · ${song.title} (${meta?.name ?? item.songbookId})`
        : `${song.songId} · ${song.title}`,
      status: "ready",
      ...arrange(item, natural, theme.value),
    };
  }

  function slidesScreens(item: Extract<CultoItem, { kind: "slides" }>): ItemScreens {
    const natural = item.pages.map((mediaId, i) => ({
      key: `m:${mediaId}`,
      natural: i,
      screen: { type: "image" as const, mediaId },
    }));
    return {
      item,
      label: labelOf(item),
      status: "ready",
      ...arrange(item, natural, theme.value),
    };
  }

  function compute(item: Extract<CultoItem, { kind: "reading" | "screen" }>, sig: string) {
    if (pending.has(sig))
      return;
    pending.add(sig);
    const run: Promise<Natural> = item.kind === "reading"
      ? readingPages(item, theme.value)
      : momentPages(item, theme.value).then(result => ({
          label: labelOf(item),
          ...result,
        }));
    run
      .then(result => setResult(item.id, sig, result))
      .catch(err => setResult(item.id, sig, {
        error: err instanceof Error
          ? err.message
          : String(err),
      }))
      .finally(() => pending.delete(sig));
  }

  function fromResult(item: CultoItem, result: Natural | { error: string }, status: ItemScreens["status"]): ItemScreens {
    if ("error" in result) {
      return status === "loading"
        ? {
            item,
            label: labelOf(item),
            status,
            all: [],
            screens: [],
            keys: [],
          }
        : failed(item, result.error);
    }
    return {
      item,
      label: result.label,
      status,
      partErrors: result.partErrors,
      ...arrange(item, result.screens, theme.value),
    };
  }

  const entries = computed<ItemScreens[]>(() => toValue(items).map((item) => {
    if (item.kind === "hymn")
      return hymnScreens(item);
    if (item.kind === "slides")
      return slidesScreens(item);
    const sig = signature(item, theme.value);
    const cached = done.value.get(item.id);
    if (cached?.sig === sig)
      return fromResult(item, cached.result, "ready");
    if (import.meta.client)
      compute(item, sig);
    // While it re-flows, keep showing the previous screens.
    return cached
      ? fromResult(item, cached.result, "loading")
      : {
          item,
          label: labelOf(item),
          status: "loading" as const,
          all: [],
          screens: [],
          keys: [],
        };
  }));

  const flat = computed<FlatScreen[]>(() => entries.value.flatMap((entry, itemIndex) =>
    entry.screens.map((screen, index) => ({
      key: `${entry.item.id}:${entry.keys[index]}`,
      itemId: entry.item.id,
      itemIndex,
      index,
      screenKey: entry.keys[index]!,
      screen,
    })),
  ));

  return { entries, flat };
}
