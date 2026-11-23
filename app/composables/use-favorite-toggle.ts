import type { FilteredSong, Song } from "~~/lib/types";

/**
 * Toggle a favorite and say so, with Deshacer. Used by the reading header,
 * search results and the Favoritos tab so the behaviour is the same everywhere.
 */
export function useFavoriteToggle() {
  const songStore = useSongStore();
  const { show } = useUndoToast();

  function isFavorite(songId: number) {
    return songStore.favoriteSongs.includes(songId);
  }

  function toggle(song: Pick<Song | FilteredSong, "songId">) {
    const target = songStore.songs[song.songId - 1];
    if (!target)
      return;
    const wasFavorite = isFavorite(song.songId);
    songStore.toggleFavorite(target);
    show(
      wasFavorite ? "Quitado de Favoritos" : "Agregado a Favoritos",
      {
        label: "Deshacer",
        run: () => {
          const again = songStore.songs[song.songId - 1];
          if (again && isFavorite(song.songId) !== wasFavorite)
            songStore.toggleFavorite(again);
        },
      },
    );
  }

  return { toggle, isFavorite };
}
