import type { Screen } from "~/utils/culto/screens";
import type { CultoItem, ReadingItem, ScreenItem } from "~~/lib/culto";

import { paginate } from "~/utils/culto/paginate";
import { PAGE_BODY_PX, renderPage, textPieces, versePieces } from "~/utils/culto/screens";
import { SCREEN_LAYOUT_LABELS } from "~~/lib/culto";

export type ItemScreens = {
  item: CultoItem;
  /** Name of the element in lists ("12 · El nombre de Dios", "Salmos 46:1-7"). */
  label: string;
  status: "ready" | "loading" | "error";
  error?: string;
  screens: Screen[];
};

/** One screen in the order of the whole service. */
export type FlatScreen = {
  key: string;
  itemId: string;
  itemIndex: number;
  /** Position inside its element. */
  index: number;
  screen: Screen;
};

type PageScreen = Extract<Screen, { type: "page" }>;

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
async function paginatePage(base: PageScreen, pieces: ReturnType<typeof textPieces>): Promise<string[][]> {
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
    return pages.map(page => page.map(p => p.html));
  });
}

// ------------------------------------------------------------ per kind

function counter(i: number, n: number) {
  return n > 1
    ? `${i + 1} / ${n}`
    : "";
}

async function screenPages(item: ScreenItem): Promise<Screen[]> {
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
  if (item.layout !== "text" || !item.body.trim())
    return [base];
  const pages = await paginatePage(base, textPieces(item.body, `${item.id}:`));
  return pages.map((html, i) => ({
    ...base,
    title: i === 0
      ? base.title
      : "",
    reference: i === 0
      ? base.reference
      : "",
    html: html.join(""),
    counter: counter(i, pages.length),
  }));
}

async function readingPages(item: ReadingItem): Promise<{ label: string; screens: Screen[] }> {
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
  const pages = await paginatePage(base, versePieces(passage.verses, item.mode === "verse"));
  const first = passage.verses[0]!;
  const book = first.bookName;
  return {
    label: passage.label,
    screens: pages.map((html, i) => {
      // The verses on this screen, for its eyebrow ("Salmos 46:2-3").
      const numbers = html.join("").match(/data-v="(\d+)"/g)?.map(m => Number(m.slice(8, -1))) ?? [];
      const lo = Math.min(...numbers);
      const hi = Math.max(...numbers);
      const chapter = passage.verses.find(v => v.verse === lo)?.chapter ?? first.chapter;
      return {
        ...base,
        eyebrow: numbers.length
          ? `${book} ${chapter}:${lo}${hi > lo
            ? `-${hi}`
            : ""}`
          : passage.label,
        html: html.join(""),
        counter: counter(i, pages.length),
      };
    }),
  };
}

// ------------------------------------------------------------ composable

function signature(item: CultoItem): string {
  const { notes: _notes, inserted: _inserted, ...rest } = item;
  return JSON.stringify(rest);
}

/**
 * The screens of each element of a service, recomputed only for the
 * elements that change. Hymns come from the songbook already loaded; pages
 * and readings are paginated at projection size.
 */
export function useCultoScreens(items: MaybeRefOrGetter<CultoItem[]>) {
  const songStore = useSongStore();
  const songbookStore = useSongbookStore();
  const presentation = usePresentationStore();
  const { songs } = storeToRefs(songStore);
  const { currentId: songbookId, manifest } = storeToRefs(songbookStore);

  // Async results by item id, valid while the signature matches.
  const done = shallowRef(new Map<string, { sig: string; result: ItemScreens }>());
  const pending = new Set<string>();

  function setResult(id: string, sig: string, result: ItemScreens) {
    const next = new Map(done.value);
    next.set(id, { sig, result });
    done.value = next;
  }

  function hymnScreens(item: Extract<CultoItem, { kind: "hymn" }>): ItemScreens {
    if (item.songbookId !== songbookId.value) {
      const name = manifest.value.find(s => s.id === item.songbookId)?.name ?? item.songbookId;
      return {
        item,
        label: `Himno ${item.songId}`,
        status: "error",
        error: `Es del himnario ${name}: elígelo en Ajustes para proyectarlo.`,
        screens: [],
      };
    }
    const song = songs.value[item.songId - 1];
    if (!song) {
      return {
        item,
        label: `Himno ${item.songId}`,
        status: songs.value.length ? "error" : "loading",
        error: songs.value.length
          ? `No hay himno ${item.songId} en este himnario.`
          : undefined,
        screens: [],
      };
    }
    const scale = item.scale ?? presentation.scaleFor(song.songId);
    return {
      item,
      label: `${song.songId} · ${song.title}`,
      status: "ready",
      screens: buildSlides(song).map(slide => ({
        type: "lyric",
        slide,
        number: song.songId,
        title: song.title,
        scale,
      })),
    };
  }

  function labelOf(item: CultoItem): string {
    if (item.kind === "screen")
      return item.title.trim() || item.eyebrow.trim() || SCREEN_LAYOUT_LABELS[item.layout];
    if (item.kind === "reading")
      return item.reference;
    return `Himno ${item.songId}`;
  }

  function compute(item: Exclude<CultoItem, { kind: "hymn" }>, sig: string) {
    if (pending.has(sig))
      return;
    pending.add(sig);
    const run = item.kind === "reading"
      ? readingPages(item)
      : screenPages(item).then(screens => ({
          label: labelOf(item),
          screens,
        }));
    run
      .then(({ label, screens }) => setResult(item.id, sig, {
        item,
        label,
        status: "ready",
        screens,
      }))
      .catch(err => setResult(item.id, sig, {
        item,
        label: labelOf(item),
        status: "error",
        error: err instanceof Error
          ? err.message
          : String(err),
        screens: [],
      }))
      .finally(() => pending.delete(sig));
  }

  const entries = computed<ItemScreens[]>(() => toValue(items).map((item) => {
    if (item.kind === "hymn")
      return hymnScreens(item);
    const sig = signature(item);
    const cached = done.value.get(item.id);
    if (cached?.sig === sig)
      return { ...cached.result, item };
    if (import.meta.client)
      compute(item, sig);
    // While it re-flows, keep showing the previous screens.
    return cached
      ? { ...cached.result, item, status: "loading" as const }
      : {
          item,
          label: labelOf(item),
          status: "loading" as const,
          screens: [],
        };
  }));

  const flat = computed<FlatScreen[]>(() => entries.value.flatMap((entry, itemIndex) =>
    entry.screens.map((screen, index) => ({
      key: `${entry.item.id}:${index}`,
      itemId: entry.item.id,
      itemIndex,
      index,
      screen,
    })),
  ));

  return { entries, flat };
}
