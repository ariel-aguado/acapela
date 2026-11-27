import type { PageItem } from "~/utils/culto/paginate";
import type { Screen } from "~/utils/culto/screens";
import type { CultoItem, ReadingItem, ScreenItem } from "~~/lib/culto";

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
type Natural = { label: string; screens: Omit<ManagedScreen, "hidden">[] };

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
async function paginatePage(base: PageScreen, pieces: PageItem[]): Promise<PageItem[][]> {
  return measured(async () => {
    const el = measuringStage();
    el.innerHTML = renderPage(base, "");
    await document.fonts?.load(`600 ${Math.round(PAGE_BODY_PX * base.scale)}px Inter`).catch(() => {});
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

async function screenPages(item: ScreenItem): Promise<Natural["screens"]> {
  const base: PageScreen = {
    type: "page",
    layout: item.layout,
    eyebrow: item.eyebrow.trim(),
    title: item.title.trim(),
    reference: item.reference.trim(),
    html: "",
    footer: "",
    counter: "",
    scale: item.scale ?? 1,
  };
  if (item.layout !== "text" || !item.body.trim()) {
    return [
      { key: "p0", screen: base, natural: 0 },
    ];
  }
  const pages = await paginatePage(base, withBreaks(textPieces(item.body, `${item.id}:`), item.breaks));
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

async function readingPages(item: ReadingItem): Promise<Natural> {
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
  const pages = await paginatePage(base, withBreaks(versePieces(passage.verses, item.mode === "verse"), item.breaks));
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

function arrange(item: CultoItem, natural: Natural["screens"]): Pick<ItemScreens, "all" | "screens" | "keys"> {
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
function signature(item: CultoItem): string {
  const { notes: _n, inserted: _i, screenOrder: _o, hidden: _h, ...rest } = item;
  return JSON.stringify(rest);
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
    if (item.songbookId !== songbookId.value) {
      const name = manifest.value.find(s => s.id === item.songbookId)?.name ?? item.songbookId;
      return failed(item, `Es del himnario ${name}: elígelo en Ajustes para proyectarlo.`);
    }
    const song = songs.value[item.songId - 1];
    if (!song) {
      return songs.value.length
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
      label: `${song.songId} · ${song.title}`,
      status: "ready",
      ...arrange(item, natural),
    };
  }

  function compute(item: Exclude<CultoItem, { kind: "hymn" }>, sig: string) {
    if (pending.has(sig))
      return;
    pending.add(sig);
    const run: Promise<Natural> = item.kind === "reading"
      ? readingPages(item)
      : screenPages(item).then(screens => ({
          label: labelOf(item),
          screens,
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
      ...arrange(item, result.screens),
    };
  }

  const entries = computed<ItemScreens[]>(() => toValue(items).map((item) => {
    if (item.kind === "hymn")
      return hymnScreens(item);
    const sig = signature(item);
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
