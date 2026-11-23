export const SCALE_MIN = 0.6;
export const SCALE_MAX = 1.5;
export const SCALE_STEP = 0.1;

/**
 * Projection text size chosen for each hymn (per songbook: the same number
 * is a different hymn in each one), so a hymn that needed smaller text keeps
 * it the next time it is projected.
 */
export const usePresentationStore = defineStore("presentation", () => {
  const { currentId: songbookId } = storeToRefs(useSongbookStore());
  const scaleBySongbook = useLocalStorage<Record<string, Record<string, number>>>("projectionScaleBySongbook", {});

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

  return { scaleFor, setScale };
});
