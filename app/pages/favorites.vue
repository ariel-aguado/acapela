<script lang="ts" setup>
import type { FilteredSong } from "~~/lib/types";

const songStore = useSongStore();
const songbookStore = useSongbookStore();
const { songs, favoriteSongs } = storeToRefs(songStore);
const { currentSongbook } = storeToRefs(songbookStore);
const { status } = useSongbookWorker();

const favorites = computed<FilteredSong[]>(() =>
  favoriteSongs.value
    .slice()
    .sort((a, b) => a - b)
    .map(id => songs.value[id - 1])
    .filter(s => !!s)
    .map((s) => {
      const block = s!.blocks?.find(b => b.kind !== "citation");
      return {
        songId: s!.songId,
        title: s!.title,
        firstLine: lyricExcerpt(block?.text[0] ?? ""),
        favorite: true,
      };
    }),
);
</script>

<template>
  <div class="page-scroll flex flex-col w-full max-w-2xl mx-auto min-w-0">
    <div v-if="status === 'loading'" class="flex justify-center py-10">
      <UIcon name="i-tabler-loader-2" class="size-8 animate-spin text-primary" aria-label="Cargando" />
    </div>

    <template v-else-if="favorites.length">
      <p class="px-4 pt-4 pb-2 text-xs font-bold uppercase tracking-wider opacity-70">
        {{ favorites.length }} {{ favorites.length === 1 ? 'himno' : 'himnos' }} en {{ currentSongbook?.name }}
      </p>
      <ul>
        <li v-for="song in favorites" :key="song.songId" class="border-t border-muted first:border-t-0">
          <SongItem :song />
        </li>
      </ul>
    </template>

    <div v-else class="flex flex-col items-center text-center gap-3 px-8 py-14">
      <span class="grid place-items-center h-16 w-16 rounded-full bg-secondary/10 text-secondary">
        <Icon name="tabler:heart" size="32" aria-hidden="true" />
      </span>
      <p class="text-lg font-bold">
        Aún no tienes favoritos en {{ currentSongbook?.name ?? 'este himnario' }}
      </p>
      <p class="opacity-80 max-w-xs">
        Toca el corazón en un himno, o en la lista de Buscar, para tenerlo siempre a mano aquí.
      </p>
      <UButton
        to="/search"
        size="lg"
        class="mt-2"
        icon="i-tabler-search"
        label="Buscar himnos"
      />
    </div>
  </div>
</template>
