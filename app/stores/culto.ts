import { nanoid } from "nanoid";

import type { Culto, CultoItem, CultoSection, HymnItem, ProjectionTheme, ReadingItem, ScreenItem, ScreenMoment, SlidesItem } from "~~/lib/culto";

import { screenMoment } from "~/utils/culto/moment";
import { assignSections, normalizeCulto, sectionTitleFor, stepItem, stepSection } from "~/utils/culto/sections";
import { DEFAULT_THEME } from "~~/lib/culto";

/** Ready-made screens for the usual moments of a service. */
export const SCREEN_TEMPLATES: { label: string; item: Omit<ScreenItem, "id"> }[] = [
  {
    label: "Bienvenida",
    item: {
      kind: "screen",
      moment: "welcome",
      layout: "title",
      eyebrow: "Bienvenidos",
      title: "Nos alegra verte hoy",
      body: "",
      reference: "",
    },
  },
  {
    label: "Oración",
    item: {
      kind: "screen",
      moment: "prayer",
      layout: "title",
      eyebrow: "",
      title: "Oremos",
      body: "",
      reference: "",
    },
  },
  {
    label: "Santa Cena",
    item: {
      kind: "screen",
      moment: "supper",
      layout: "quote",
      eyebrow: "Santa Cena",
      title: "«Haced esto en memoria de mí».",
      body: "",
      reference: "1 Corintios 11:24",
    },
  },
  {
    label: "Ofrenda",
    item: {
      kind: "screen",
      moment: "offering",
      layout: "quote",
      eyebrow: "Ofrenda",
      title: "«Dios ama al dador alegre».",
      body: "",
      reference: "2 Corintios 9:7",
    },
  },
  {
    label: "Predicación",
    item: {
      kind: "screen",
      moment: "sermon",
      layout: "title",
      eyebrow: "Predicación",
      title: "Título del sermón",
      body: "",
      reference: "Predicador · Pasaje",
    },
  },
  {
    label: "Anuncios",
    item: {
      kind: "screen",
      moment: "notices",
      layout: "text",
      eyebrow: "Anuncios",
      title: "Esta semana",
      body: "",
      reference: "",
    },
  },
  {
    label: "Despedida",
    item: {
      kind: "screen",
      moment: "farewell",
      layout: "title",
      eyebrow: "",
      title: "Hasta el domingo",
      body: "",
      reference: "",
    },
  },
  {
    label: "Logo (antes de empezar)",
    item: {
      kind: "screen",
      layout: "logo",
      eyebrow: "",
      title: "",
      body: "",
      reference: "",
    },
  },
  {
    label: "Imagen o afiche",
    item: {
      kind: "screen",
      layout: "image",
      eyebrow: "",
      title: "",
      body: "",
      reference: "",
    },
  },
];

function nextSunday(): string {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return toIsoDate(d);
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The part of the day of a time: what a church says ("el culto de la noche"). */
export type DayPart = "mañana" | "tarde" | "noche";
export function partOfDay(time?: string): DayPart | null {
  const hour = Number(time?.slice(0, 2));
  if (!time || Number.isNaN(hour))
    return null;
  return hour >= 5 && hour < 12
    ? "mañana"
    : hour >= 12 && hour < 19
      ? "tarde"
      : "noche";
}

const PART_TITLE: Record<DayPart, string> = {
  mañana: "Culto de la mañana",
  tarde: "Culto de la tarde",
  noche: "Culto de la noche",
};
const DEFAULT_TITLE = "Culto del domingo";
/** A name Acapela gave, not one written by hand: it may follow the time. */
function isDefaultTitle(title: string) {
  return title === DEFAULT_TITLE || Object.values(PART_TITLE).includes(title) || /^Culto (?:del domingo|de la (?:mañana|tarde|noche)) (?:\d+|\(\d\d:\d\d\))$/.test(title);
}

/** When a service is: "domingo, 29 de noviembre · 19:00 · noche". */
export function cultoWhen(culto: Pick<Culto, "date" | "time">): string {
  const part = partOfDay(culto.time);
  return part
    ? `${formatCultoDate(culto.date)} · ${culto.time} · ${part}`
    : formatCultoDate(culto.date);
}

export function formatCultoDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d)
    return iso;
  return new Date(y, m - 1, d).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
}

/**
 * The services prepared on this device and the one being worked on. Kept in
 * localStorage, like everything else in Acapela: no accounts, nothing on a
 * server. Moving a service to another device is by exporting it (later).
 */
export const useCultoStore = defineStore("culto", () => {
  const cultos = useLocalStorage<Culto[]>("cultos", []);
  const currentId = useLocalStorage<string>("cultoId", "");
  /** The church's look on the projector, for every service on this device. */
  const theme = useLocalStorage<ProjectionTheme>("cultoTheme", structuredClone(DEFAULT_THEME), { mergeDefaults: true });

  function setTheme(changes: Partial<ProjectionTheme>) {
    theme.value = {
      ...theme.value,
      ...changes,
    };
  }

  /** The services, without the free projection. */
  const services = computed(() => cultos.value.filter(c => !c.quick));

  const current = computed<Culto | null>(() =>
    services.value.find(c => c.id === currentId.value) ?? services.value[0] ?? null,
  );

  /** Newest day first; on a day, by time (those without one first). */
  const sorted = computed(() => [...services.value].sort((a, b) => b.date.localeCompare(a.date) || (a.time ?? "").localeCompare(b.time ?? "") || b.updatedAt - a.updatedAt));

  /**
   * A name that tells it apart from the other services of its day (NN/g:
   * the first words distinguish): the first one keeps the usual name; the
   * next ones are named after their part of the day, or the first one free.
   */
  function distinctTitle(date: string, time: string | undefined, exceptId?: string, base = DEFAULT_TITLE): string {
    const taken = new Set(services.value.filter(c => c.date === date && c.id !== exceptId).map(c => c.title));
    if (!taken.size)
      return base;
    const part = partOfDay(time);
    const candidates = part
      ? [PART_TITLE[part]]
      : Object.values(PART_TITLE);
    const free = candidates.find(t => !taken.has(t));
    if (free)
      return free;
    // Taken: its time tells it apart; with no time, a number.
    const stem = candidates[0]!;
    if (time && !taken.has(`${stem} (${time})`))
      return `${stem} (${time})`;
    let n = 2;
    while (taken.has(`${stem} ${n}`))
      n++;
    return `${stem} ${n}`;
  }

  /** The free projection of this device, if there is one. */
  const quickCulto = computed<Culto | null>(() => cultos.value.find(c => c.quick) ?? null);

  function save(culto: Culto) {
    const kept = normalizeCulto({
      ...culto,
      updatedAt: Date.now(),
    });
    cultos.value = cultos.value.map(c => c.id === culto.id
      ? { ...kept }
      : c);
  }

  // Services saved with the earlier model (a moment's screens inside its
  // title screen) become sections, once, when they are read.
  watch(cultos, (list) => {
    if (list.some(c => normalizeCulto(c) !== c))
      cultos.value = list.map(c => normalizeCulto(c));
  }, { immediate: true });

  function create(): Culto {
    const date = nextSunday();
    const culto: Culto = {
      id: nanoid(10),
      title: distinctTitle(date, undefined),
      date,
      items: [
        {
          id: nanoid(8),
          ...structuredClone(SCREEN_TEMPLATES[0]!.item),
        },
      ],
      updatedAt: Date.now(),
    };
    cultos.value = [...cultos.value, culto];
    currentId.value = culto.id;
    return culto;
  }

  /** Same order and content, for the next service; drops what was inserted live. */
  function duplicate(id: string): Culto | null {
    const source = cultos.value.find(c => c.id === id);
    if (!source)
      return null;
    const date = nextSunday();
    // A plain deep copy: structuredClone fails on the reactive items.
    const copy: Culto = {
      ...JSON.parse(JSON.stringify(source)) as Culto,
      id: nanoid(10),
      title: isDefaultTitle(source.title)
        ? distinctTitle(date, source.time)
        : source.title,
      date,
      updatedAt: Date.now(),
    };
    copy.items = copy.items.filter(i => !i.inserted).map(i => ({
      ...i,
      id: nanoid(8),
    }));
    cultos.value = [...cultos.value, copy];
    currentId.value = copy.id;
    return copy;
  }

  /**
   * Puts a hymn on the free projection and returns its element: the one
   * already last if it is that hymn, else a new one at the end. A free
   * projection from another day starts empty.
   */
  function projectQuick(songbookId: string, songId: number): CultoItem {
    const today = toIsoDate(new Date());
    let quick = quickCulto.value;
    if (!quick || quick.date !== today) {
      const fresh: Culto = {
        id: quick?.id ?? nanoid(10),
        title: "Proyección libre",
        date: today,
        items: [],
        updatedAt: Date.now(),
        quick: true,
      };
      cultos.value = quick
        ? cultos.value.map(c => c.id === fresh.id
            ? fresh
            : c)
        : [...cultos.value, fresh];
      quick = fresh;
    }
    const last = quick.items.at(-1);
    if (last?.kind === "hymn" && last.songbookId === songbookId && last.songId === songId)
      return last;
    return addItem(newHymn(songbookId, songId), undefined, quick.id);
  }

  /** The free projection becomes a service of its own, listed and editable. */
  function saveQuick(): Culto | null {
    const quick = quickCulto.value;
    if (!quick)
      return null;
    // A shallow copy: its items are never changed in place.
    const saved: Culto = {
      ...quick,
      title: "Himnos proyectados",
      quick: undefined,
    };
    save(saved);
    currentId.value = saved.id;
    return saved;
  }

  function remove(id: string) {
    cultos.value = cultos.value.filter(c => c.id !== id);
    if (currentId.value === id)
      currentId.value = sorted.value[0]?.id ?? "";
  }

  function select(id: string) {
    currentId.value = id;
  }

  function ensureCurrent(): Culto {
    return current.value ?? create();
  }

  function patch(changes: Partial<Pick<Culto, "title" | "date" | "time">>) {
    const culto = current.value;
    if (!culto)
      return;
    const next = {
      ...culto,
      ...changes,
    };
    if ("time" in changes && !changes.time)
      delete next.time;
    // A name Acapela gave follows a new day or time, so it stays distinct.
    if (!("title" in changes) && ("date" in changes || "time" in changes) && isDefaultTitle(culto.title))
      next.title = distinctTitle(next.date, next.time, culto.id);
    save(next);
  }

  // ------------------------------------------------------------ items

  /** The service by id, or the one being worked on. */
  function target(cultoId?: string): Culto | null {
    return cultoId
      ? cultos.value.find(c => c.id === cultoId) ?? null
      : current.value;
  }

  function addItem(item: CultoItem, index?: number, cultoId?: string): CultoItem {
    const culto = target(cultoId) ?? ensureCurrent();
    const items = [...culto.items];
    items.splice(index ?? items.length, 0, item);
    save({ ...culto, items });
    return item;
  }

  function updateItem(itemId: string, changes: Partial<CultoItem>, cultoId?: string) {
    const culto = target(cultoId);
    if (!culto)
      return;
    save({
      ...culto,
      items: culto.items.map(i => i.id === itemId
        ? {
            ...i,
            ...changes,
          } as CultoItem
        : i),
    });
  }

  function removeItem(itemId: string) {
    const culto = current.value;
    if (culto) {
      save({
        ...culto,
        items: culto.items.filter(i => i.id !== itemId),
      });
    }
  }

  function moveItem(itemId: string, toIndex: number) {
    const culto = current.value;
    if (!culto)
      return;
    const items = [...culto.items];
    const from = items.findIndex(i => i.id === itemId);
    if (from < 0)
      return;
    const [item] = items.splice(from, 1);
    items.splice(Math.max(0, Math.min(toIndex, items.length)), 0, item!);
    save({ ...culto, items });
  }

  /** New order of the elements, by id (after dragging). */
  function setOrder(ids: string[]) {
    const culto = current.value;
    if (!culto)
      return;
    const byId = new Map(culto.items.map(i => [i.id, i]));
    const items = ids.map(id => byId.get(id)).filter((i): i is CultoItem => !!i);
    save({
      ...culto,
      items: [
        ...items,
        ...culto.items.filter(i => !ids.includes(i.id)),
      ],
    });
  }

  // ------------------------------------------------------------ screens of an element
  // SúperBiblia's screen manager: order, hidden, breaks.

  function itemById(itemId: string) {
    return current.value?.items.find(i => i.id === itemId);
  }

  function setScreenOrder(itemId: string, keys: string[]) {
    updateItem(itemId, { screenOrder: keys });
  }

  function toggleHidden(itemId: string, key: string) {
    const hidden = new Set(itemById(itemId)?.hidden ?? []);
    if (hidden.has(key))
      hidden.delete(key);
    else
      hidden.add(key);
    updateItem(itemId, {
      hidden: [...hidden],
    });
  }

  function setBreak(itemId: string, pieceId: string, value: boolean) {
    updateItem(itemId, {
      breaks: {
        ...itemById(itemId)?.breaks,
        [pieceId]: value,
      },
    });
  }

  // ------------------------------------------------------------ sections

  const sections = computed<CultoSection[]>(() => current.value?.sections ?? []);

  function setItems(culto: Culto, items: CultoItem[], list: CultoSection[] = culto.sections ?? []) {
    save({ ...culto, items, sections: list });
  }

  /** A new section with its first elements, at `index` (the end by default). */
  function createSection(moment: ScreenMoment, title: string, first: CultoItem[], index?: number): CultoSection {
    const culto = ensureCurrent();
    const section: CultoSection = {
      id: nanoid(8),
      moment,
      title,
    };
    const items = [...culto.items];
    items.splice(index ?? items.length, 0, ...first.map(i => ({ ...i, sectionId: section.id })));
    setItems(culto, items, [
      ...(culto.sections ?? []),
      section,
    ]);
    return section;
  }

  /** A loose screen becomes the first element of a section of its moment. */
  function groupInSection(itemId: string): CultoSection | null {
    const culto = current.value;
    const item = culto?.items.find(i => i.id === itemId);
    if (!culto || item?.kind !== "screen" || item.sectionId)
      return null;
    const section: CultoSection = {
      id: nanoid(8),
      moment: screenMoment(item),
      title: sectionTitleFor(item),
    };
    setItems(culto, culto.items.map(i => i.id === itemId
      ? { ...i, sectionId: section.id }
      : i), [
      ...(culto.sections ?? []),
      section,
    ]);
    return section;
  }

  /**
   * Adds an element right after another, in that one's section if it has
   * one (`loose`: on its own, as after a whole section).
   */
  function insertAfter(afterId: string, item: CultoItem, loose = false): CultoItem {
    const culto = ensureCurrent();
    const at = culto.items.findIndex(i => i.id === afterId);
    const after = culto.items[at];
    const placed = { ...item } as CultoItem;
    if (after?.sectionId && !loose)
      placed.sectionId = after.sectionId;
    else
      delete placed.sectionId;
    const items = [...culto.items];
    items.splice(at < 0
      ? items.length
      : at + 1, 0, placed);
    setItems(culto, items);
    return placed;
  }

  /** Adds an element at the end of a section. */
  function addToSection(sectionId: string, item: CultoItem): CultoItem {
    const culto = ensureCurrent();
    const items = [...culto.items];
    const last = items.findLastIndex(i => i.sectionId === sectionId);
    items.splice(last < 0
      ? items.length
      : last + 1, 0, { ...item, sectionId });
    setItems(culto, items);
    return item;
  }

  function updateSection(sectionId: string, changes: Partial<Omit<CultoSection, "id">>) {
    const culto = current.value;
    if (culto) {
      setItems(culto, culto.items, (culto.sections ?? []).map(s => s.id === sectionId
        ? {
            ...s,
            ...changes,
          }
        : s));
    }
  }

  /** The section goes; its elements stay, on their own, where they were. */
  function dissolveSection(sectionId: string) {
    const culto = current.value;
    if (culto) {
      setItems(culto, assignSections(culto.items, culto.items.map(i => ({
        id: i.id,
        sectionId: i.sectionId === sectionId
          ? undefined
          : i.sectionId,
      }))), (culto.sections ?? []).filter(s => s.id !== sectionId));
    }
  }

  /** The section and its elements go; returns what is needed to undo it. */
  function removeSection(sectionId: string): { section: CultoSection; items: CultoItem[]; index: number } | null {
    const culto = current.value;
    const section = culto?.sections?.find(s => s.id === sectionId);
    if (!culto || !section)
      return null;
    const index = culto.items.findIndex(i => i.sectionId === sectionId);
    const removed = culto.items.filter(i => i.sectionId === sectionId);
    setItems(culto, culto.items.filter(i => i.sectionId !== sectionId), (culto.sections ?? []).filter(s => s.id !== sectionId));
    return { section, items: removed, index };
  }

  function restoreSection(saved: { section: CultoSection; items: CultoItem[]; index: number }) {
    const culto = ensureCurrent();
    const items = [...culto.items];
    items.splice(Math.max(0, saved.index), 0, ...saved.items);
    setItems(culto, items, [
      ...(culto.sections ?? []),
      saved.section,
    ]);
  }

  /** The arrows of an element (see stepItem: it may leave its section at the edge). */
  function stepItemInOrder(itemId: string, delta: -1 | 1) {
    const culto = current.value;
    if (culto)
      setItems(culto, stepItem(culto.items, culto.sections ?? [], itemId, delta));
  }

  function stepSectionInOrder(sectionId: string, delta: -1 | 1) {
    const culto = current.value;
    if (culto)
      setItems(culto, stepSection(culto.items, culto.sections ?? [], sectionId, delta));
  }

  /** The order and sections after dragging. */
  function setLayout(order: { id: string; sectionId?: string }[]) {
    const culto = current.value;
    if (culto)
      setItems(culto, assignSections(culto.items, order));
  }

  /** Moves an element into a section (at its end) or out of its section (right after it). */
  function setItemSection(itemId: string, sectionId: string | undefined) {
    const culto = current.value;
    const item = culto?.items.find(i => i.id === itemId);
    if (!culto || !item || item.sectionId === sectionId)
      return;
    const rest = culto.items.filter(i => i.id !== itemId);
    const anchor = sectionId ?? item.sectionId;
    const last = rest.findLastIndex(i => i.sectionId === anchor);
    const moved = { ...item, sectionId } as CultoItem;
    if (!sectionId)
      delete moved.sectionId;
    rest.splice(last < 0
      ? rest.length
      : last + 1, 0, moved);
    setItems(culto, rest);
  }

  function resetScreens(itemId: string) {
    updateItem(itemId, { screenOrder: undefined, hidden: undefined, breaks: undefined });
  }

  // ------------------------------------------------------------ factories

  function newHymn(songbookId: string, songId: number, extra: Partial<HymnItem> = {}): HymnItem {
    return {
      id: nanoid(8),
      kind: "hymn",
      songbookId,
      songId,
      ...extra,
    };
  }

  function newReading(reference: string, versionId: string, extra: Partial<ReadingItem> = {}): ReadingItem {
    return {
      id: nanoid(8),
      kind: "reading",
      reference,
      versionId,
      mode: "fit",
      ...extra,
    };
  }

  function newSlides(title: string, pages: string[], extra: Partial<SlidesItem> = {}): SlidesItem {
    return {
      id: nanoid(8),
      kind: "slides",
      title,
      pages,
      ...extra,
    };
  }

  function newScreen(template?: Omit<ScreenItem, "id">, extra: Partial<ScreenItem> = {}): ScreenItem {
    return {
      id: nanoid(8),
      ...structuredClone(template ?? {
        kind: "screen",
        layout: "text",
        eyebrow: "",
        title: "",
        body: "",
        reference: "",
      }),
      ...extra,
    } as ScreenItem;
  }

  return {
    cultos,
    theme,
    setTheme,
    newSlides,
    sorted,
    current,
    sections,
    createSection,
    groupInSection,
    addToSection,
    insertAfter,
    updateSection,
    dissolveSection,
    removeSection,
    restoreSection,
    stepItemInOrder,
    stepSectionInOrder,
    setLayout,
    setItemSection,
    quickCulto,
    projectQuick,
    saveQuick,
    currentId,
    create,
    duplicate,
    remove,
    select,
    ensureCurrent,
    patch,
    addItem,
    updateItem,
    removeItem,
    moveItem,
    setOrder,
    setScreenOrder,
    toggleHidden,
    setBreak,
    resetScreens,
    newHymn,
    newReading,
    newScreen,
  };
});
