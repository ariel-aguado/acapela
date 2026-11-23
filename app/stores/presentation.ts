type Setlist = { title: string; items: number[] };

const DEFAULT_TITLE = "Lista del culto";
export const SCALE_MIN = 0.6;
export const SCALE_MAX = 1.5;
export const SCALE_STEP = 0.1;

/**
 * Lista del culto (one per songbook, like favorites: the same number is a
 * different hymn in each songbook) and the projection text size chosen for
 * each hymn, so a hymn that needed smaller text keeps it next Sunday.
 */
export const usePresentationStore = defineStore("presentation", () => {
  const { currentId: songbookId } = storeToRefs(useSongbookStore());
  const setlistBySongbook = useLocalStorage<Record<string, Setlist>>("setlistBySongbook", {});
  const scaleBySongbook = useLocalStorage<Record<string, Record<string, number>>>("projectionScaleBySongbook", {});

  const setlist = computed<Setlist>({
    get: () => setlistBySongbook.value[songbookId.value] ?? { title: DEFAULT_TITLE, items: [] },
    set: (value) => {
      if (!songbookId.value)
        return;
      setlistBySongbook.value = { ...setlistBySongbook.value, [songbookId.value]: value };
    },
  });

  const items = computed(() => setlist.value.items);
  const title = computed({
    get: () => setlist.value.title || DEFAULT_TITLE,
    set: t => (setlist.value = { ...setlist.value, title: t.trim() || DEFAULT_TITLE }),
  });

  function has(id: number) {
    return items.value.includes(id);
  }
  function add(id: number) {
    if (!has(id))
      setlist.value = { ...setlist.value, items: [...items.value, id] };
  }
  function remove(id: number) {
    setlist.value = { ...setlist.value, items: items.value.filter(i => i !== id) };
  }
  function move(id: number, delta: -1 | 1) {
    const list = items.value.slice();
    const from = list.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= list.length)
      return;
    list.splice(from, 1);
    list.splice(to, 0, id);
    setlist.value = { ...setlist.value, items: list };
  }
  function replace(next: Setlist) {
    setlist.value = { title: next.title || DEFAULT_TITLE, items: next.items.slice() };
  }
  /** Replace the list of another songbook (used when importing a shared list). */
  function replaceFor(bookId: string, next: Setlist) {
    setlistBySongbook.value = {
      ...setlistBySongbook.value,
      [bookId]: { title: next.title || DEFAULT_TITLE, items: next.items.slice() },
    };
  }

  /** Neighbour of a hymn inside the list, or null if not in it / at an end. */
  function neighbour(id: number, delta: -1 | 1): number | null {
    const i = items.value.indexOf(id);
    if (i < 0)
      return null;
    return items.value[i + delta] ?? null;
  }

  function scaleFor(songId: number): number {
    return scaleBySongbook.value[songbookId.value]?.[String(songId)] ?? 1;
  }
  function setScale(songId: number, scale: number) {
    if (!songbookId.value)
      return;
    const clamped = Math.round(Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale)) * 10) / 10;
    const book = { ...(scaleBySongbook.value[songbookId.value] ?? {}) };
    if (clamped === 1)
      delete book[String(songId)];
    else
      book[String(songId)] = clamped;
    scaleBySongbook.value = { ...scaleBySongbook.value, [songbookId.value]: book };
  }

  /** Link that opens /list with this list (number list + title + songbook). */
  function shareUrl(origin: string): string {
    const params = new URLSearchParams({
      b: songbookId.value,
      h: items.value.join(","),
      t: title.value,
    });
    return `${origin}/list?${params.toString()}`;
  }

  return {
    setlist,
    items,
    title,
    has,
    add,
    remove,
    move,
    replace,
    replaceFor,
    neighbour,
    scaleFor,
    setScale,
    shareUrl,
  };
});
