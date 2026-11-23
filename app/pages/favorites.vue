<script lang="ts" setup>
import type { FilteredSong } from "~~/lib/types";

const songStore = useSongStore();
const songbookStore = useSongbookStore();
const { songs, favoriteSongs } = storeToRefs(songStore);
const { currentSongbook } = storeToRefs(songbookStore);
const { status } = useSongbookWorker();
const presentation = usePresentationStore();
const route = useRoute();
const router = useRouter();

// Two views of "my hymns": saved favorites and the list for the next service.
type Tab = "favoritos" | "lista";
const tab = computed<Tab>({
  get: () => (route.query.tab === "lista" ? "lista" : "favoritos"),
  set: t => router.replace({ query: t === "lista" ? { tab: "lista" } : {} }),
});

const favorites = computed<FilteredSong[]>(() =>
  favoriteSongs.value
    .slice()
    .sort((a, b) => a - b)
    .map(id => songs.value[id - 1])
    .filter(s => !!s)
    .map((s) => {
      const block = s!.blocks?.find(b => b.kind !== "citation");
      return { songId: s!.songId, title: s!.title, firstLine: lyricExcerpt(block?.text[0] ?? ""), favorite: true };
    }),
);
</script>

<template>
  <div class="page-scroll flex flex-col w-full max-w-2xl mx-auto min-w-0">
    <div role="tablist" aria-label="Mis himnos" class="tabs tabs-border shrink-0 border-b border-base-200 px-2">
      <button
        id="tab-favoritos"
        type="button"
        role="tab"
        class="tab h-12 flex-1"
        :class="{ 'tab-active font-semibold': tab === 'favoritos' }"
        :aria-selected="tab === 'favoritos'"
        aria-controls="panel-mis-himnos"
        @click="tab = 'favoritos'"
      >
        Favoritos
        <span class="ml-1.5 opacity-60 tabular-nums">{{ favoriteSongs.length }}</span>
      </button>
      <button
        id="tab-lista"
        type="button"
        role="tab"
        class="tab h-12 flex-1"
        :class="{ 'tab-active font-semibold': tab === 'lista' }"
        :aria-selected="tab === 'lista'"
        aria-controls="panel-mis-himnos"
        @click="tab = 'lista'"
      >
        Lista del culto
        <span class="ml-1.5 opacity-60 tabular-nums">{{ presentation.items.length }}</span>
      </button>
    </div>

    <div
      v-if="tab === 'lista'"
      id="panel-mis-himnos"
      role="tabpanel"
      aria-labelledby="tab-lista"
      class="p-4"
    >
      <SetlistEditor />
    </div>

    <div v-else-if="status === 'loading'" class="flex justify-center py-10">
      <span class="loading loading-spinner loading-lg" aria-label="Cargando" />
    </div>

    <template v-else-if="favorites.length">
      <p class="px-4 pt-4 pb-2 text-xs font-bold uppercase tracking-wider opacity-70">
        {{ favorites.length }} {{ favorites.length === 1 ? 'himno' : 'himnos' }} en {{ currentSongbook?.name }}
      </p>
      <ul>
        <li v-for="song in favorites" :key="song.songId" class="border-t border-base-200 first:border-t-0">
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
      <NuxtLink to="/search" class="btn btn-primary mt-2">
        <Icon name="tabler:search" size="18" />
        Buscar himnos
      </NuxtLink>
    </div>
  </div>
</template>
