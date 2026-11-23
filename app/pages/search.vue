<script lang="ts" setup>
import { useDebounceFn } from "@vueuse/core";
import Mark from "mark.js";

import type { FilteredSong, FullSearchResult, Song } from "~~/lib/types";

// One search for everything a person may remember: the number, the title or
// a phrase of the lyric. Results are grouped by where they matched.

type Scope = "all" | "titles" | "lyrics";
type LyricHit = {
  song: FilteredSong;
  line: string;
  blockIndex: number;
  tag: string;
  more: number;
};

const PAGE = 30;

const route = useRoute();
const router = useRouter();
const songStore = useSongStore();
const songbookStore = useSongbookStore();
const {
  songs,
  favoriteSongs,
  searchHistory,
  recentSongIds,
  currentTab,
  filteredSongsByNumber,
  filteredSongsByTitle,
  filteredSongIdsByNumber,
  filteredSongIdsByTitle,
} = storeToRefs(songStore);
const { currentSongbook } = storeToRefs(songbookStore);
const { search: workerSearch } = useSongbookWorker();

const query = ref(typeof route.query.q === "string" ? route.query.q : "");
const scope = ref<Scope>("all");
const inputRef = shallowRef<HTMLInputElement | null>(null);
const resultsRef = shallowRef<HTMLElement | null>(null);

const trimmed = computed(() => query.value.trim());
const hasQuery = computed(() => trimmed.value.length > 0);
const songbookName = computed(() => currentSongbook.value?.name ?? "este himnario");
const isNumberQuery = computed(() => /^\d+$/.test(trimmed.value));

function firstLine(song: Song | undefined): string {
  const block = song?.blocks?.find(b => b.kind !== "citation");
  return lyricExcerpt(block?.text[0] ?? song?.lyricLines?.[0]?.line ?? "");
}

function toFiltered(song: Song): FilteredSong {
  return { songId: song.songId, title: song.title, firstLine: firstLine(song), favorite: song.favorite };
}

// ---------------------------------------------------------------- results
const numberMatch = computed<FilteredSong | null>(() => {
  if (!isNumberQuery.value)
    return null;
  const song = songs.value[Number(trimmed.value) - 1];
  return song ? toFiltered(song) : null;
});

const titleHits = ref<FilteredSong[]>([]);
const lyricHits = ref<LyricHit[]>([]);
const searching = ref(false);
const titleLimit = ref(PAGE);
const lyricLimit = ref(PAGE);
let searchSeq = 0;

async function runSearch(text: string) {
  const q = text.trim();
  const mySeq = ++searchSeq;
  titleLimit.value = PAGE;
  lyricLimit.value = PAGE;
  if (!q) {
    titleHits.value = [];
    lyricHits.value = [];
    searching.value = false;
    return;
  }
  searching.value = true;
  const favoriteIds = favoriteSongs.value.slice();
  const [titles, full] = await Promise.all([
    workerSearch(q, { mode: "byTitle", favoriteIds, limit: 200 }) as Promise<FilteredSong[]>,
    workerSearch(q, { mode: "full", favoriteIds, limit: 400 }) as Promise<FullSearchResult[]>,
  ]);
  if (mySeq !== searchSeq)
    return;

  const inTitles = new Set(titles.map(t => t.songId));
  // Use the reader's first sung line (the worker's may be "CORO:" or "//…").
  titleHits.value = titles
    .filter(t => t.songId !== numberMatch.value?.songId)
    .map((t) => {
      const song = songs.value[t.songId - 1];
      return song ? { ...t, firstLine: firstLine(song) } : t;
    });
  lyricHits.value = full
    .filter(r => !inTitles.has(r.songId) && r.matchedLines.length > 0)
    .map((r) => {
      const song = songs.value[r.songId - 1];
      const rawLine = r.matchedLines[0]?.line ?? "";
      const line = lyricExcerpt(rawLine);
      const blockIndex = findBlockIndex(song, rawLine.replace(/\*+/g, ""));
      return {
        song: { songId: r.songId, title: r.title, firstLine: r.firstLine, favorite: r.favorite },
        line,
        blockIndex,
        tag: blockLabel(song?.blocks?.[blockIndex]),
        more: r.matchedLines.length - 1,
      };
    });
  searching.value = false;
}

const visibleTitles = computed(() => (scope.value === "lyrics" ? [] : titleHits.value));
const visibleLyrics = computed(() => (scope.value === "titles" ? [] : lyricHits.value));
const nothingFound = computed(() =>
  hasQuery.value
  && !searching.value
  && !numberMatch.value
  && visibleTitles.value.length === 0
  && visibleLyrics.value.length === 0,
);

// --------------------------------------------------------- browsing (empty)
const recentSongs = computed(() =>
  recentSongIds.value
    .map(id => songs.value[id - 1])
    .filter((s): s is Song => !!s)
    .slice(0, 5)
    .map(toFiltered),
);

function fillBrowseLists() {
  const all = songs.value.map(toFiltered);
  filteredSongsByNumber.value = all.slice().sort((a, b) => a.songId - b.songId);
  filteredSongIdsByNumber.value = songStore.generateAnchorsFromSongIds(filteredSongsByNumber.value.map(s => s.songId));
  filteredSongsByTitle.value = all.slice().sort((a, b) => titleSortKey(a.title).localeCompare(titleSortKey(b.title)));
  filteredSongIdsByTitle.value = Array.from(new Set(filteredSongsByTitle.value.map(s => titleInitial(s.title)).filter(c => /[A-Z]/.test(c))));
}

// ---------------------------------------------------------------- history
function onOpen() {
  if (hasQuery.value)
    songStore.rememberSearch(trimmed.value);
}

function useHistory(entry: string) {
  query.value = entry;
  inputRef.value?.focus();
}

function clearHistory() {
  const previous = searchHistory.value.slice();
  searchHistory.value = [];
  useUndoToast().show("Historial borrado", {
    label: "Deshacer",
    run: () => {
      searchHistory.value = previous;
    },
  });
}

function clearQuery() {
  query.value = "";
  inputRef.value?.focus();
}

// --------------------------------------------------------------- highlight
function performMark() {
  const el = resultsRef.value;
  if (!el)
    return;
  const marker = new Mark(el);
  marker.unmark({
    done() {
      if (hasQuery.value && !isNumberQuery.value)
        marker.mark(trimmed.value, { diacritics: true, separateWordSearch: false, exclude: [".no-mark", ".no-mark *"] });
    },
  });
}

// ---------------------------------------------------------------- wiring
const debouncedSearch = useDebounceFn(async (q: string) => {
  await runSearch(q);
  // Keep the query in the URL so "back" from a hymn restores the results.
  router.replace({ query: q.trim() ? { q: q.trim() } : {} });
}, 150);

watch(query, q => debouncedSearch(q));

watch([titleHits, lyricHits, scope, titleLimit, lyricLimit, hasQuery], () => {
  nextTick().then(performMark);
});

watch(
  () => [songs.value.length, currentSongbook.value?.id],
  () => {
    if (songs.value.length === 0)
      return;
    fillBrowseLists();
    if (hasQuery.value)
      runSearch(query.value);
  },
);

onMounted(async () => {
  if (currentTab.value !== "byTitle")
    currentTab.value = "byNumber";
  if (songs.value.length > 0)
    fillBrowseLists();
  if (hasQuery.value)
    await runSearch(query.value);
  // Raise the keyboard only where it doesn't cover the list (mouse/trackpad).
  if (window.matchMedia("(pointer: fine)").matches || route.query.focus !== undefined)
    inputRef.value?.focus();
});
</script>

<template>
  <div class="flex flex-col h-[calc(100dvh-64px-52px)] w-full max-w-2xl mx-auto min-w-0">
    <div class="flex flex-col gap-2 px-4 pt-3 pb-3 bg-base-100 border-b border-base-200 shadow-sm z-10">
      <label for="query" class="text-sm font-medium">Número, título o una frase de la letra</label>
      <div class="input input-lg w-full flex items-center gap-2 pr-1">
        <Icon
          name="tabler:search"
          size="20"
          class="opacity-60 shrink-0"
          aria-hidden="true"
        />
        <input
          id="query"
          ref="inputRef"
          v-model="query"
          type="search"
          autocomplete="off"
          enterkeyhint="search"
          placeholder="Por ejemplo: 214 o cuán grande"
          class="flex-1 min-w-0"
        >
        <button
          v-if="query"
          type="button"
          class="btn btn-ghost btn-circle btn-sm h-10 w-10"
          aria-label="Borrar búsqueda"
          @click="clearQuery"
        >
          <Icon name="tabler:x" size="18" />
        </button>
      </div>

      <div
        v-if="hasQuery && !isNumberQuery"
        class="flex flex-wrap gap-2"
        role="radiogroup"
        aria-label="Buscar en"
      >
        <label
          v-for="opt in [
            { value: 'all', label: 'Todos', count: titleHits.length + lyricHits.length },
            { value: 'titles', label: 'Títulos', count: titleHits.length },
            { value: 'lyrics', label: 'Letra', count: lyricHits.length },
          ]"
          :key="opt.value"
          class="btn btn-sm h-9 rounded-full font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
          :class="scope === opt.value ? 'btn-neutral' : 'btn-ghost border border-base-300'"
        >
          <input
            v-model="scope"
            type="radio"
            name="scope"
            :value="opt.value"
            class="sr-only"
          >
          {{ opt.label }}
          <span v-if="!searching" class="tabular-nums opacity-70">{{ opt.count }}</span>
        </label>
      </div>
    </div>

    <div ref="resultsRef" class="context flex-1 overflow-y-auto">
      <!-- ===================== Results ===================== -->
      <template v-if="hasQuery">
        <section v-if="isNumberQuery" aria-labelledby="g-number">
          <h3 id="g-number" class="group-title no-mark">
            Número
          </h3>
          <SongItem v-if="numberMatch" :song="numberMatch" @open="onOpen" />
          <p v-else class="px-4 py-3 text-sm opacity-80 no-mark">
            {{ songbookName }} tiene {{ songs.length }} himnos.
          </p>
        </section>

        <section v-if="visibleTitles.length" aria-labelledby="g-titles">
          <h3 id="g-titles" class="group-title no-mark">
            Títulos · {{ visibleTitles.length }} {{ visibleTitles.length === 1 ? 'himno' : 'himnos' }}
          </h3>
          <ul>
            <li v-for="song in visibleTitles.slice(0, titleLimit)" :key="`t-${song.songId}`" class="border-t border-base-200 first:border-t-0">
              <SongItem :song @open="onOpen" />
            </li>
          </ul>
          <button
            v-if="visibleTitles.length > titleLimit"
            type="button"
            class="btn btn-ghost btn-sm mx-4 my-2 no-mark"
            @click="titleLimit += PAGE"
          >
            Mostrar {{ Math.min(PAGE, visibleTitles.length - titleLimit) }} más
          </button>
        </section>

        <section v-if="visibleLyrics.length" aria-labelledby="g-lyrics">
          <h3 id="g-lyrics" class="group-title no-mark">
            En la letra · {{ visibleLyrics.length }} {{ visibleLyrics.length === 1 ? 'himno' : 'himnos' }}
          </h3>
          <ul>
            <li v-for="hit in visibleLyrics.slice(0, lyricLimit)" :key="`l-${hit.song.songId}`" class="border-t border-base-200 first:border-t-0">
              <SongItem
                :song="hit.song"
                :detail="hit.line"
                :tag="[hit.tag, hit.more > 0 ? `${hit.more} ${hit.more === 1 ? 'coincidencia' : 'coincidencias'} más` : ''].filter(Boolean).join(' · ')"
                :block-index="hit.blockIndex"
                @open="onOpen"
              />
            </li>
          </ul>
          <button
            v-if="visibleLyrics.length > lyricLimit"
            type="button"
            class="btn btn-ghost btn-sm mx-4 my-2 no-mark"
            @click="lyricLimit += PAGE"
          >
            Mostrar {{ Math.min(PAGE, visibleLyrics.length - lyricLimit) }} más
          </button>
        </section>

        <div v-if="searching && !titleHits.length && !lyricHits.length && !numberMatch" class="flex justify-center py-10">
          <span class="loading loading-spinner loading-lg" aria-label="Buscando" />
        </div>

        <div v-if="nothingFound && !isNumberQuery" class="flex flex-col items-center text-center gap-2 px-6 py-10 no-mark">
          <img src="/img/empty-state.webp" alt="Empty state" class="w-20 h-auto opacity-80">
          <p class="text-lg font-bold">
            Ningún himno de {{ songbookName }} coincide con «{{ trimmed }}»
          </p>
          <p class="opacity-80">
            Revisa la ortografía o prueba con menos palabras.
          </p>
          <button type="button" class="btn btn-ghost mt-2" @click="clearQuery">
            Ver todos los himnos
          </button>
        </div>
      </template>

      <!-- ===================== Browse ===================== -->
      <template v-else>
        <section v-if="recentSongs.length" aria-labelledby="g-recent">
          <h3 id="g-recent" class="group-title">
            Recientes
          </h3>
          <ul>
            <li v-for="song in recentSongs" :key="`r-${song.songId}`" class="border-t border-base-200 first:border-t-0">
              <SongItem :song />
            </li>
          </ul>
        </section>

        <section v-if="searchHistory.length" aria-labelledby="g-history" class="px-4 pb-2">
          <div class="flex items-center justify-between">
            <h3 id="g-history" class="group-title px-0">
              Búsquedas recientes
            </h3>
            <button type="button" class="btn btn-link btn-sm px-0 text-base-content/70" @click="clearHistory">
              Borrar historial
            </button>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="entry in searchHistory"
              :key="entry"
              type="button"
              class="btn btn-ghost btn-sm h-9 rounded-full border border-base-300 font-normal"
              @click="useHistory(entry)"
            >
              <Icon
                name="tabler:clock"
                size="16"
                class="opacity-60"
                aria-hidden="true"
              />
              {{ entry }}
            </button>
          </div>
        </section>

        <section aria-labelledby="g-all">
          <div class="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
            <h3 id="g-all" class="text-xs font-bold uppercase tracking-wider opacity-70">
              Todos los himnos · {{ songs.length }}
            </h3>
            <div class="join" role="radiogroup" aria-label="Ordenar">
              <label
                v-for="opt in [
                  { id: 'by_number', value: 'byNumber', label: 'Por número' },
                  { id: 'by_title', value: 'byTitle', label: 'Por título' },
                ]"
                :key="opt.id"
                class="join-item btn btn-sm h-9 font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
                :class="currentTab === opt.value ? 'btn-neutral' : 'btn-ghost border border-base-300'"
              >
                <input
                  :id="opt.id"
                  v-model="currentTab"
                  type="radio"
                  name="sort"
                  :value="opt.value"
                  class="sr-only"
                >
                {{ opt.label }}
              </label>
            </div>
          </div>
          <div class="flex">
            <SongsByNumber v-if="currentTab === 'byNumber'" />
            <SongsByTitle v-else />
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.group-title {
  padding: 1rem 1rem 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.7;
}
</style>

<style>
.context mark {
  background: color-mix(in oklab, var(--color-warning) 55%, transparent);
  color: inherit;
  border-radius: 2px;
  padding: 0 1px;
}
</style>
