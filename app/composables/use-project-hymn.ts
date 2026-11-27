// "Proyectar himno": one console for everything projected. A hymn goes on
// the free projection (a service of the day nobody prepared, see the culto
// store) and the live console of services opens on it, so there is a single
// projection interface whether the service was planned or not.

/** Where the free projection is on the console (one per tab, as the service's). */
export const QUICK_POSITION_KEY = "cultoLivePositionLibre";

export function useProjectHymn() {
  const culto = useCultoStore();
  const songStore = useSongStore();
  const songbookStore = useSongbookStore();
  const position = useSessionStorage<{ itemId: string; key: string } | null>(QUICK_POSITION_KEY, null);

  /**
   * Projects a hymn of the chosen songbook (the open one by default).
   * `replace`: the page calling it is left out of the history.
   */
  function projectHymn(songId?: number, replace = false) {
    const id = songId ?? (Number(songStore.songId) || 1);
    const item = culto.projectQuick(songbookStore.currentId, id);
    position.value = { itemId: item.id, key: "" };
    return navigateTo({
      path: "/culto/vivo",
      query: { libre: null },
    }, { replace });
  }

  return { projectHymn };
}
