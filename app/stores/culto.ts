import { nanoid } from "nanoid";

import type { Culto, CultoItem, HymnItem, ProjectionTheme, ReadingItem, ScreenItem, SlidesItem } from "~~/lib/culto";

import { DEFAULT_THEME } from "~~/lib/culto";

/** Ready-made screens for the usual moments of a service. */
export const SCREEN_TEMPLATES: { label: string; item: Omit<ScreenItem, "id"> }[] = [
  {
    label: "Bienvenida",
    item: {
      kind: "screen",
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

  const current = computed<Culto | null>(() =>
    cultos.value.find(c => c.id === currentId.value) ?? cultos.value[0] ?? null,
  );

  const sorted = computed(() => [...cultos.value].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt));

  function save(culto: Culto) {
    culto.updatedAt = Date.now();
    cultos.value = cultos.value.map(c => c.id === culto.id
      ? { ...culto }
      : c);
  }

  function create(): Culto {
    const culto: Culto = {
      id: nanoid(10),
      title: "Culto del domingo",
      date: nextSunday(),
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
    const copy: Culto = {
      ...structuredClone(toRaw(source)),
      id: nanoid(10),
      title: source.title,
      date: nextSunday(),
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

  function patch(changes: Partial<Pick<Culto, "title" | "date">>) {
    const culto = current.value;
    if (culto) {
      save({
        ...culto,
        ...changes,
      });
    }
  }

  // ------------------------------------------------------------ items

  function addItem(item: CultoItem, index?: number): CultoItem {
    const culto = ensureCurrent();
    const items = [...culto.items];
    items.splice(index ?? items.length, 0, item);
    save({ ...culto, items });
    return item;
  }

  function updateItem(itemId: string, changes: Partial<CultoItem>) {
    const culto = current.value;
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
