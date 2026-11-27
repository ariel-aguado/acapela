<script lang="ts" setup>
import { onKeyStroke, useDebounceFn, useMediaQuery } from "@vueuse/core";
import Mark from "mark.js";

import type { ElsewhereHit } from "~/composables/use-search-elsewhere";
import type { FilteredSong, FullSearchResult, Song } from "~~/lib/types";

// One search for everything a person may remember: the number, the title or
// a phrase of the lyric. Results are grouped by where they matched.
//
// Desktop (lg) uses the whole width: the field spans the page, the results
// are a column on the left and the highlighted hymn is shown whole on the
// right (click selects, double click or Enter opens it). Without a query,
// recents are a row of cards and every hymn sits in a three-column grid with
// a horizontal index. The phone keeps its single column.
//
// When the chosen songbook has nothing, the same query runs in the other
// songbooks (a hymn of another one opens at /himno without changing the
// choice), and each word of the query is offered as a search of its own.

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
const cultoStore = useCultoStore();
const { toggle: toggleFavorite, isFavorite } = useFavoriteToggle();
const isLarge = useMediaQuery("(min-width: 1024px)");
const {
  songs,
  favoriteSongs,
  searchHistory,
  recentSongIds,
  currentTab,
  songId,
  filteredSongsByNumber,
  filteredSongsByTitle,
  filteredSongIdsByNumber,
  filteredSongIdsByTitle,
} = storeToRefs(songStore);
const { currentSongbook } = storeToRefs(songbookStore);
const { search: workerSearch } = useSongbookWorker();

const query = ref(typeof route.query.q === "string"
  ? route.query.q
  : "");
const scope = ref<Scope>("all");
const queryInput = useTemplateRef<{ inputRef: HTMLInputElement | null }>("queryInput");
const inputRef = computed(() => queryInput.value?.inputRef ?? null);
const resultsRef = shallowRef<HTMLElement | null>(null);
const previewRef = shallowRef<HTMLElement | null>(null);

const trimmed = computed(() => query.value.trim());
const hasQuery = computed(() => trimmed.value.length > 0);
const songbookName = computed(() => currentSongbook.value?.name ?? "este himnario");
const isNumberQuery = computed(() => /^\d+$/.test(trimmed.value));

function firstLine(song: Song | undefined): string {
  const block = song?.blocks?.find(b => b.kind !== "citation");
  return lyricExcerpt(block?.text[0] ?? song?.lyricLines?.[0]?.line ?? "");
}

function toFiltered(song: Song): FilteredSong {
  return {
    songId: song.songId,
    title: song.title,
    firstLine: firstLine(song),
    favorite: song.favorite,
  };
}

// ---------------------------------------------------------------- results
const numberMatch = computed<FilteredSong | null>(() => {
  if (!isNumberQuery.value)
    return null;
  const song = songs.value[Number(trimmed.value) - 1];
  return song
    ? toFiltered(song)
    : null;
});

const titleHits = ref<FilteredSong[]>([]);
const lyricHits = ref<LyricHit[]>([]);
/** Each word of a query that found nothing, with how many hymns it finds. */
const wordSuggestions = ref<Array<{ word: string; count: number }>>([]);
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
    wordSuggestions.value = [];
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
      return song
        ? {
            ...t,
            firstLine: firstLine(song),
          }
        : t;
    });
  lyricHits.value = full
    .filter(r => !inTitles.has(r.songId) && r.matchedLines.length > 0)
    .map((r) => {
      const song = songs.value[r.songId - 1];
      const rawLine = r.matchedLines[0]?.line ?? "";
      const line = lyricExcerpt(rawLine);
      const blockIndex = findBlockIndex(song, rawLine.replace(/\*+/g, ""));
      return {
        song: {
          songId: r.songId,
          title: r.title,
          firstLine: r.firstLine,
          favorite: r.favorite,
        },
        line,
        blockIndex,
        tag: blockLabel(song?.blocks?.[blockIndex]),
        more: r.matchedLines.length - 1,
      };
    });
  const empty = titles.length === 0 && full.length === 0 && !numberMatch.value;
  const suggestions = empty
    ? await suggestWords(q, favoriteIds)
    : [];
  if (mySeq !== searchSeq)
    return;
  wordSuggestions.value = suggestions;
  searching.value = false;
}

// Words that say nothing on their own are not offered.
const STOPWORDS = new Set([
  "al",
  "con",
  "del",
  "el",
  "en",
  "es",
  "la",
  "las",
  "los",
  "mas",
  "más",
  "me",
  "mi",
  "nos",
  "oh",
  "para",
  "por",
  "que",
  "se",
  "su",
  "te",
  "tu",
  "tú",
  "un",
  "una",
  "y",
]);

async function suggestWords(q: string, favoriteIds: number[]) {
  const words = [
    ...new Set(q.split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}]/gu, "")).filter(w => w.length >= 3 && !STOPWORDS.has(w.toLowerCase()))),
  ];
  if (words.length < 2)
    return [];
  const counts = await Promise.all(words.map(async (word) => {
    const found = await workerSearch(word, { mode: "full", favoriteIds, limit: 400 }) as FullSearchResult[];
    return { word, count: found.length };
  }));
  return counts
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
}

const visibleTitles = computed(() => (scope.value === "lyrics"
  ? []
  : titleHits.value));
const visibleLyrics = computed(() => (scope.value === "titles"
  ? []
  : lyricHits.value));
const totalHits = computed(() => titleHits.value.length + lyricHits.value.length);
/** The chosen songbook has nothing at all for a (non-number) query. */
const noLocalHits = computed(() =>
  hasQuery.value
  && !isNumberQuery.value
  && !searching.value
  && totalHits.value === 0,
);
const elsewhere = useSearchElsewhere(trimmed, noLocalHits);
const { hits: elsewhereHits, loading: elsewhereLoading } = elsewhere;
const searchedList = computed(() => {
  const names = elsewhere.searchedNames.value;
  return names.length > 1
    ? `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`
    : names[0] ?? "";
});
const elsewhereBooks = computed(() => [
  ...new Set(elsewhereHits.value.map(h => h.songbook.name)),
]);
const emptyHeadline = computed(() => {
  if (elsewhereHits.value.length)
    return `No está en ${songbookName.value}`;
  if (elsewhereLoading.value)
    return `Nada en ${songbookName.value} con «${trimmed.value}»`;
  return `Ningún himno coincide con «${trimmed.value}»`;
});
const emptySubline = computed(() => {
  if (elsewhereHits.value.length) {
    return elsewhereBooks.value.length === 1
      ? `Pero lo encontramos en ${elsewhereBooks.value[0]}.`
      : "Pero lo encontramos en otros himnarios.";
  }
  if (elsewhereLoading.value)
    return "Buscando en los otros himnarios…";
  return elsewhere.searchedNames.value.length > 1
    ? `Buscamos en ${searchedList.value}.`
    : "Revisa la ortografía o prueba con menos palabras.";
});
/** Nothing here and nothing in the other songbooks either. */
const nothingAnywhere = computed(() =>
  noLocalHits.value && !elsewhere.loading.value && elsewhere.hits.value.length === 0,
);
const nothingFound = computed(() =>
  hasQuery.value
  && !searching.value
  && !numberMatch.value
  && totalHits.value > 0
  && visibleTitles.value.length === 0
  && visibleLyrics.value.length === 0,
);

// ------------------------------------------------- desktop: selection/preview
/** A result in the order shown; `songbookId` only for another songbook. */
type Picked = { songId: number; blockIndex: number; songbookId?: string };

function keyOf(songId: number, songbookId = ""): string {
  return `${songbookId}:${songId}`;
}

/** Every visible result, in the order shown, for ↑ ↓ and the preview. */
const ordered = computed<Picked[]>(() => noLocalHits.value
  ? elsewhere.hits.value.map(h => ({ songId: h.song.songId, blockIndex: h.blockIndex, songbookId: h.songbook.id }))
  : [
      ...(numberMatch.value
        ? [
            { songId: numberMatch.value.songId, blockIndex: -1 },
          ]
        : []),
      ...visibleTitles.value.slice(0, titleLimit.value).map(s => ({ songId: s.songId, blockIndex: -1 })),
      ...visibleLyrics.value.slice(0, lyricLimit.value).map(h => ({ songId: h.song.songId, blockIndex: h.blockIndex })),
    ]);
const selectedKey = ref<string | null>(null);
// Keep the selection while it is still among the results; else the first.
watch(ordered, (list) => {
  if (!list.some(p => keyOf(p.songId, p.songbookId) === selectedKey.value)) {
    const first = list[0];
    selectedKey.value = first
      ? keyOf(first.songId, first.songbookId)
      : null;
  }
}, { immediate: true });
const selected = computed(() => ordered.value.find(p => keyOf(p.songId, p.songbookId) === selectedKey.value) ?? null);
const selectedHit = computed(() => (selected.value?.songbookId
  ? elsewhere.hits.value.find(h => h.songbook.id === selected.value!.songbookId && h.song.songId === selected.value!.songId) ?? null
  : null));
const previewSong = computed<Song | null>(() => {
  if (!selected.value)
    return null;
  if (selected.value.songbookId)
    return selectedHit.value?.song ?? null;
  return songs.value[selected.value.songId - 1] ?? null;
});
const previewSongbookName = computed(() => selectedHit.value?.songbook.name ?? songbookName.value);
const previewBlocks = computed(() => (previewSong.value?.blocks ?? [])
  .map((block, index) => ({ block, index }))
  .filter(({ block }) => block.kind !== "citation"));
const previewCitation = computed(() => (previewSong.value?.blocks ?? [])
  .filter(b => b.kind === "citation")
  .map(b => b.text.join(" "))
  .join(" · "));
const previewSummary = computed(() => {
  const blocks = previewBlocks.value.map(b => b.block);
  const stanzas = blocks.filter(b => b.kind === "stanza").length;
  const parts = [
    stanzas === 1
      ? "1 estrofa"
      : `${stanzas} estrofas`,
  ];
  if (blocks.some(b => b.kind === "chorus"))
    parts.push("con coro");
  return parts.join(" · ");
});

function moveSelection(step: number) {
  const list = ordered.value;
  if (!list.length)
    return;
  const at = list.findIndex(p => keyOf(p.songId, p.songbookId) === selectedKey.value);
  const next = list[Math.max(0, Math.min(list.length - 1, at + step))]!;
  selectedKey.value = keyOf(next.songId, next.songbookId);
  nextTick(() => {
    resultsRef.value
      ?.querySelector("[aria-current=\"true\"]")
      ?.scrollIntoView({ block: "nearest" });
  });
}

function onInputKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && query.value) {
    e.preventDefault();
    clearQuery();
    return;
  }
  if (!isLarge.value || !hasQuery.value)
    return;
  if (e.key === "Enter" && !selected.value && wordSuggestions.value[0]) {
    e.preventDefault();
    useSuggestion(wordSuggestions.value[0].word);
    return;
  }
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    moveSelection(e.key === "ArrowDown"
      ? 1
      : -1);
  }
  else if (e.key === "Enter" && selected.value) {
    e.preventDefault();
    sing(selected.value);
  }
}

function sing(pick: Picked) {
  onOpen();
  if (pick.songbookId) {
    navigateTo({
      path: "/himno",
      query: {
        himnario: pick.songbookId,
        n: pick.songId,
        ...(pick.blockIndex >= 0
          ? { estrofa: pick.blockIndex }
          : {}),
      },
    });
    return;
  }
  songStore.navigateToSong(pick.songId, pick.blockIndex);
}

function hitPick(hit: ElsewhereHit): Picked {
  return { songId: hit.song.songId, blockIndex: hit.blockIndex, songbookId: hit.songbook.id };
}

function useSuggestion(word: string) {
  query.value = word;
  inputRef.value?.focus();
}

function project(pick: Picked) {
  onOpen();
  songId.value = pick.songId;
  navigateTo("/fullscreen");
}

function addToCulto(pick: Picked) {
  const item = cultoStore.addItem(cultoStore.newHymn(pick.songbookId ?? songbookStore.currentId, pick.songId));
  useUndoToast().show("Agregado al culto", {
    label: "Deshacer",
    run: () => cultoStore.removeItem(item.id),
  });
}

// The preview opens at the stanza that matched.
watch(selected, (pick) => {
  nextTick(() => {
    const el = previewRef.value;
    if (!el)
      return;
    const block = pick && pick.blockIndex >= 0
      ? el.querySelector<HTMLElement>(`[data-block="${pick.blockIndex}"]`)
      : null;
    if (block)
      block.scrollIntoView({ block: "center" });
    else
      el.scrollTop = 0;
  });
});

// Results and browsing share the scroller: each starts at the top.
watch(hasQuery, () => {
  if (resultsRef.value)
    resultsRef.value.scrollTop = 0;
});

// "/" goes back to the field from anywhere on the page.
onKeyStroke("/", (e: KeyboardEvent) => {
  const target = e.target as HTMLElement | null;
  if (target?.closest("input, textarea, [contenteditable]"))
    return;
  e.preventDefault();
  inputRef.value?.focus();
  inputRef.value?.select();
});

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

// Desktop index of "Todos los himnos": the same anchors as the phone's side
// rail, as a horizontal strip.
const browseList = computed(() => (currentTab.value === "byTitle"
  ? filteredSongsByTitle.value
  : filteredSongsByNumber.value));
const browseAnchors = computed<Array<number | string>>(() => (currentTab.value === "byTitle"
  ? filteredSongIdsByTitle.value
  : filteredSongIdsByNumber.value));
function browseKey(song: FilteredSong) {
  return currentTab.value === "byTitle"
    ? titleInitial(song.title)
    : song.songId;
}

// --------------------------------------------------------------- highlight
function performMark() {
  const els = [resultsRef.value, previewRef.value].filter((el): el is HTMLElement => !!el);
  if (!els.length)
    return;
  const marker = new Mark(els);
  marker.unmark({
    done() {
      if (hasQuery.value && !isNumberQuery.value) {
        marker.mark(trimmed.value, {
          diacritics: true,
          separateWordSearch: false,
          exclude: [".no-mark", ".no-mark *"],
        });
      }
    },
  });
}

// ---------------------------------------------------------------- wiring
const debouncedSearch = useDebounceFn(async (q: string) => {
  await runSearch(q);
  // Keep the query in the URL so "back" from a hymn restores the results.
  router.replace({
    query: q.trim()
      ? {
          q: q.trim(),
        }
      : {},
  });
}, 150);

watch(query, q => debouncedSearch(q));

watch([
  titleHits,
  lyricHits,
  scope,
  titleLimit,
  lyricLimit,
  hasQuery,
  selectedKey,
  elsewhere.hits,
], () => {
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
  <div class="flex flex-col h-dvh pad-bar-top w-full max-w-2xl lg:max-w-[calc(1440px+3rem)] lg:px-6 mx-auto min-w-0">
    <!-- ===================== Search band ===================== -->
    <div class="flex flex-col gap-2 px-4 pt-1 pb-3 bg-default border-b border-muted z-10 lg:mt-1 lg:gap-3 lg:px-6 lg:py-5 lg:rounded-2xl lg:border-0 lg:shadow-card">
      <label for="query" class="text-sm font-medium lg:sr-only">Número, título o una frase de la letra</label>
      <div class="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
        <UInput
          id="query"
          ref="queryInput"
          v-model="query"
          type="search"
          autocomplete="off"
          enterkeyhint="search"
          :placeholder="isLarge ? 'Número, título o una frase de la letra: 214, cuán grande…' : 'Por ejemplo: 214 o cuán grande'"
          size="xl"
          icon="i-tabler-search"
          class="w-full lg:flex-1 lg:min-w-0"
          :ui="{ base: 'h-12 text-base lg:h-14 lg:text-lg lg:ps-12', leadingIcon: 'lg:size-6', leading: 'lg:ps-4', trailing: 'pe-1.5' }"
          @keydown="onInputKeydown"
        >
          <template v-if="query" #trailing>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-tabler-x"
              aria-label="Borrar búsqueda"
              @click="clearQuery"
            />
          </template>
          <template v-else-if="isLarge" #trailing>
            <UKbd value="/" class="me-2.5" />
          </template>
        </UInput>

        <div
          v-if="hasQuery && !isNumberQuery && totalHits > 0"
          class="flex flex-wrap gap-2 lg:flex-nowrap lg:gap-1 lg:rounded-full lg:bg-(--well-bg) lg:p-1"
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
            class="chip lg:h-11 lg:px-4 lg:border-0"
            :class="{ 'chip--on': scope === opt.value }"
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

        <span
          v-if="isLarge && currentSongbook"
          class="hidden lg:inline-flex shrink-0 h-11 items-center gap-2 rounded-full bg-primary/10 text-primary px-4 text-sm font-semibold dark:bg-lime-300/15 dark:text-lime-300"
        >
          <UIcon name="i-tabler-book" class="size-5" />
          {{ currentSongbook.name }} · {{ songs.length }} himnos
        </span>
      </div>

      <!-- Desktop: recent searches right under the field. -->
      <div v-if="isLarge && !hasQuery && searchHistory.length" class="flex flex-wrap items-center gap-2">
        <span class="text-xs font-bold uppercase tracking-wider opacity-70 me-1">Búsquedas recientes</span>
        <UButton
          v-for="entry in searchHistory"
          :key="entry"
          color="neutral"
          variant="soft"
          icon="i-tabler-clock"
          class="h-9 font-normal"
          :label="entry"
          data-history-entry
          @click="useHistory(entry)"
        />
        <UButton
          color="neutral"
          variant="link"
          size="sm"
          label="Borrar historial"
          @click="clearHistory"
        />
      </div>
    </div>

    <div class="flex-1 min-h-0 flex lg:gap-4 lg:pt-4 lg:pb-6">
      <div
        ref="resultsRef"
        class="context flex-1 min-w-0 overflow-y-auto pad-bar-bottom lg:pb-2"
        :class="hasQuery && !nothingAnywhere ? 'lg:flex-none lg:w-[30rem] lg:rounded-2xl lg:bg-default lg:shadow-card lg:p-2' : ''"
      >
        <!-- ===================== Results ===================== -->
        <template v-if="hasQuery">
          <section v-if="isNumberQuery" aria-labelledby="g-number">
            <h3 id="g-number" class="group-title no-mark">
              Número
            </h3>
            <SongItem
              v-if="numberMatch"
              :song="numberMatch"
              :selectable="isLarge"
              :selected="selectedKey === keyOf(numberMatch.songId)"
              @open="onOpen"
              @select="selectedKey = keyOf($event)"
            />
            <p v-else class="px-4 py-3 text-sm opacity-80 no-mark">
              {{ songbookName }} tiene {{ songs.length }} himnos.
            </p>
          </section>

          <section v-if="visibleTitles.length" aria-labelledby="g-titles">
            <h3 id="g-titles" class="group-title no-mark">
              Títulos · {{ visibleTitles.length }} {{ visibleTitles.length === 1 ? 'himno' : 'himnos' }}
            </h3>
            <ul>
              <li v-for="song in visibleTitles.slice(0, titleLimit)" :key="`t-${song.songId}`" class="border-t border-muted first:border-t-0 lg:border-0">
                <SongItem
                  :song
                  :selectable="isLarge"
                  :selected="selectedKey === keyOf(song.songId)"
                  @open="onOpen"
                  @select="selectedKey = keyOf($event)"
                />
              </li>
            </ul>
            <UButton
              v-if="visibleTitles.length > titleLimit"
              color="neutral"
              variant="ghost"
              class="mx-4 my-2 no-mark"
              :label="`Mostrar ${Math.min(PAGE, visibleTitles.length - titleLimit)} más`"
              @click="titleLimit += PAGE"
            />
          </section>

          <section v-if="visibleLyrics.length" aria-labelledby="g-lyrics">
            <h3 id="g-lyrics" class="group-title no-mark">
              En la letra · {{ visibleLyrics.length }} {{ visibleLyrics.length === 1 ? 'himno' : 'himnos' }}
            </h3>
            <ul>
              <li v-for="hit in visibleLyrics.slice(0, lyricLimit)" :key="`l-${hit.song.songId}`" class="border-t border-muted first:border-t-0 lg:border-0">
                <SongItem
                  :song="hit.song"
                  :detail="hit.line"
                  :tag="[hit.tag, hit.more > 0 ? `${hit.more} ${hit.more === 1 ? 'coincidencia' : 'coincidencias'} más` : ''].filter(Boolean).join(' · ')"
                  :block-index="hit.blockIndex"
                  :selectable="isLarge"
                  :selected="selectedKey === keyOf(hit.song.songId)"
                  @open="onOpen"
                  @select="selectedKey = keyOf($event)"
                />
              </li>
            </ul>
            <UButton
              v-if="visibleLyrics.length > lyricLimit"
              color="neutral"
              variant="ghost"
              class="mx-4 my-2 no-mark"
              :label="`Mostrar ${Math.min(PAGE, visibleLyrics.length - lyricLimit)} más`"
              @click="lyricLimit += PAGE"
            />
          </section>

          <div v-if="searching && !titleHits.length && !lyricHits.length && !numberMatch" class="flex justify-center py-10">
            <UIcon name="i-tabler-loader-2" class="size-8 animate-spin text-primary" aria-label="Buscando" />
          </div>

          <!-- A scope (Títulos / Letra) with nothing while the other has hits. -->
          <div v-if="nothingFound && !isNumberQuery" class="flex flex-col items-center text-center gap-2 px-6 py-10 no-mark">
            <p class="text-lg font-bold">
              {{ scope === 'titles' ? 'Ningún título' : 'Ninguna letra' }} coincide con «{{ trimmed }}»
            </p>
            <UButton
              color="neutral"
              variant="soft"
              class="mt-1"
              :label="`Ver los ${totalHits} resultados`"
              @click="scope = 'all'"
            />
          </div>

          <!-- ============ Nothing in this songbook ============ -->
          <div v-if="noLocalHits" class="flex flex-col gap-5 px-4 py-6 lg:px-2 lg:py-3" data-empty-state>
            <div
              class="flex flex-col items-center text-center gap-2 no-mark"
              :class="nothingAnywhere ? 'lg:py-10' : 'lg:flex-row lg:items-center lg:text-start lg:gap-4 lg:px-2'"
            >
              <AppEmptyIllustration class="shrink-0 w-36" :class="nothingAnywhere ? 'lg:w-48' : 'lg:w-28'" />
              <div class="flex flex-col gap-1 min-w-0">
                <p class="hidden lg:block text-xs font-bold uppercase tracking-wider text-muted">
                  {{ songbookName }}: 0 coincidencias
                </p>
                <h2 class="text-xl font-bold text-highlighted text-balance">
                  {{ emptyHeadline }}
                </h2>
                <p class="text-muted flex items-center gap-2" :class="nothingAnywhere ? 'justify-center' : 'justify-center lg:justify-start'">
                  <UIcon v-if="elsewhereLoading && !elsewhereHits.length" name="i-tabler-loader-2" class="size-4 animate-spin" />
                  {{ emptySubline }}
                </p>
              </div>
            </div>

            <!-- Phone: the first hymn found, ready to sing; the rest as rows. -->
            <template v-if="!isLarge && elsewhereHits.length">
              <div class="rounded-2xl bg-default shadow-card p-4 flex flex-col gap-3.5">
                <div class="flex items-center gap-3.5">
                  <span class="size-14 shrink-0 rounded-[1.125rem] bg-primary/10 text-primary grid place-items-center text-2xl font-extrabold tabular-nums dark:bg-lime-300/15 dark:text-lime-300">
                    {{ elsewhereHits[0]!.song.songId }}
                  </span>
                  <div class="min-w-0 flex flex-col items-start gap-0.5">
                    <span class="songbook-badge no-mark">{{ elsewhereHits[0]!.songbook.name }}</span>
                    <span class="text-lg font-bold leading-snug text-highlighted">{{ elsewhereHits[0]!.song.title }}</span>
                    <span class="max-w-full font-lyric italic text-sm text-muted truncate">{{ elsewhereHits[0]!.line }}</span>
                  </div>
                </div>
                <UButton
                  size="lg"
                  icon="i-tabler-music"
                  block
                  class="h-12 no-mark"
                  :label="`Cantar desde ${elsewhereHits[0]!.songbook.name}`"
                  @click="sing(hitPick(elsewhereHits[0]!))"
                />
                <p class="text-sm text-muted text-center no-mark">
                  Tu himnario sigue siendo {{ songbookName }}.
                </p>
              </div>
              <section v-if="elsewhereHits.length > 1" aria-labelledby="g-elsewhere-more">
                <h3 id="g-elsewhere-more" class="group-title px-0! no-mark">
                  Más en otros himnarios
                </h3>
                <ul>
                  <li v-for="hit in elsewhereHits.slice(1)" :key="`em-${hit.songbook.id}-${hit.song.songId}`" class="border-t border-muted first:border-t-0">
                    <button type="button" class="w-full flex items-center gap-3 py-2.5 text-start" @click="sing(hitPick(hit))">
                      <span class="w-12 shrink-0 text-lg font-bold text-primary tabular-nums">{{ hit.song.songId }}</span>
                      <span class="flex-1 min-w-0 flex flex-col items-start gap-0.5">
                        <span class="songbook-badge no-mark">{{ hit.songbook.name }}</span>
                        <span class="max-w-full font-semibold text-highlighted truncate">{{ hit.song.title }}</span>
                        <span class="max-w-full font-lyric italic text-sm text-muted truncate">{{ hit.line }}</span>
                      </span>
                    </button>
                  </li>
                </ul>
              </section>
            </template>

            <!-- Desktop: rows to choose from; the hymn is shown on the right. -->
            <section v-if="isLarge && elsewhereHits.length" aria-labelledby="g-elsewhere">
              <h3 id="g-elsewhere" class="group-title no-mark">
                En otros himnarios · {{ elsewhereHits.length }}
              </h3>
              <ul class="flex flex-col gap-1">
                <li v-for="hit in elsewhereHits" :key="`el-${hit.songbook.id}-${hit.song.songId}`">
                  <button
                    type="button"
                    class="w-full flex items-center gap-3.5 rounded-2xl px-4 py-2.5 text-start"
                    :class="selectedKey === keyOf(hit.song.songId, hit.songbook.id) ? 'bg-primary/8 ring-[1.5px] ring-inset ring-primary/35' : 'hover:bg-muted'"
                    :aria-current="selectedKey === keyOf(hit.song.songId, hit.songbook.id) ? 'true' : undefined"
                    @click="selectedKey = keyOf(hit.song.songId, hit.songbook.id)"
                    @dblclick="sing(hitPick(hit))"
                  >
                    <span class="w-16 shrink-0 flex flex-col items-center gap-0.5">
                      <span class="songbook-badge no-mark">{{ hit.songbook.name }}</span>
                      <span class="text-xl font-extrabold leading-tight text-primary tabular-nums dark:text-lime-300">{{ hit.song.songId }}</span>
                    </span>
                    <span class="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span class="font-semibold text-highlighted truncate">{{ hit.song.title }}</span>
                      <span class="font-lyric italic text-sm text-muted truncate">{{ hit.line }}</span>
                    </span>
                  </button>
                </li>
              </ul>
            </section>

            <!-- Other searches: each word on its own, or every hymn. -->
            <section
              v-if="!elsewhereLoading || elsewhereHits.length"
              aria-labelledby="g-try"
              class="flex flex-col gap-2.5 no-mark lg:px-2"
              :class="{ 'items-center': nothingAnywhere }"
            >
              <h3 id="g-try" class="text-xs font-bold uppercase tracking-wider text-muted">
                {{ elsewhereHits.length ? 'O prueba otra búsqueda' : 'Prueba otra búsqueda' }}
              </h3>
              <div class="flex flex-wrap gap-2" :class="{ 'justify-center': nothingAnywhere }">
                <UButton
                  v-for="s in wordSuggestions"
                  :key="`w-${s.word}`"
                  color="neutral"
                  variant="outline"
                  icon="i-tabler-search"
                  class="h-10 rounded-full px-3.5 font-medium"
                  :aria-label="`Buscar «${s.word}»: ${s.count} ${s.count === 1 ? 'himno' : 'himnos'}`"
                  @click="useSuggestion(s.word)"
                >
                  {{ s.word }}
                  <span class="tabular-nums text-muted">{{ s.count }}</span>
                </UButton>
                <UButton
                  color="neutral"
                  variant="outline"
                  class="h-10 rounded-full px-3.5 font-medium"
                  label="Todos los himnos"
                  @click="clearQuery"
                />
              </div>
              <p v-if="!wordSuggestions.length" class="text-sm text-muted" :class="{ 'text-center': nothingAnywhere }">
                El número, una palabra del título o una frase corta de la letra.
              </p>
            </section>
          </div>
        </template>

        <!-- ===================== Browse ===================== -->
        <template v-else>
          <section v-if="recentSongs.length" aria-labelledby="g-recent">
            <h3 id="g-recent" class="group-title lg:px-1! lg:pt-0!">
              Recientes
            </h3>
            <!-- Phone: one sideways row (as on the home page), so the full
                 list below shows up without scrolling past five rows. -->
            <ul v-scroll-fade-x class="sm:hidden flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar">
              <li v-for="song in recentSongs" :key="`rm-${song.songId}`" class="shrink-0">
                <button
                  type="button"
                  class="w-40 text-start rounded-2xl bg-default shadow-card px-3 py-2.5 hover:bg-elevated"
                  @click="songStore.navigateToSong(song.songId)"
                >
                  <span class="block text-lg font-bold text-primary tabular-nums leading-tight">{{ song.songId }}</span>
                  <span class="block text-sm truncate">{{ song.title }}</span>
                </button>
              </li>
            </ul>
            <ul class="hidden sm:block lg:hidden">
              <li v-for="song in recentSongs" :key="`r-${song.songId}`" class="border-t border-muted first:border-t-0">
                <SongItem :song />
              </li>
            </ul>
            <!-- Desktop: a row of cards across the width. -->
            <ul class="hidden lg:grid grid-cols-5 gap-3">
              <li v-for="song in recentSongs" :key="`rl-${song.songId}`" class="min-w-0">
                <button
                  type="button"
                  class="w-full text-start rounded-2xl bg-default shadow-card px-4 py-3.5 hover:bg-elevated flex flex-col gap-0.5"
                  @click="songStore.navigateToSong(song.songId)"
                >
                  <span class="text-2xl font-extrabold text-primary tabular-nums leading-tight">{{ song.songId }}</span>
                  <span class="text-sm font-semibold text-highlighted truncate">{{ song.title }}</span>
                  <span class="font-lyric italic text-sm text-muted truncate">{{ song.firstLine }}</span>
                </button>
              </li>
            </ul>
          </section>

          <section v-if="!isLarge && searchHistory.length" aria-labelledby="g-history" class="pb-2">
            <div class="flex items-center justify-between px-4">
              <h3 id="g-history" class="group-title px-0!">
                Búsquedas recientes
              </h3>
              <UButton
                color="neutral"
                variant="link"
                size="sm"
                class="px-0"
                label="Borrar historial"
                @click="clearHistory"
              />
            </div>
            <!-- Phone: one sideways row instead of wrapped lines. -->
            <div v-scroll-fade-x class="flex gap-2 overflow-x-auto px-4 no-scrollbar sm:flex-wrap sm:overflow-visible">
              <UButton
                v-for="entry in searchHistory"
                :key="entry"
                color="neutral"
                variant="outline"
                icon="i-tabler-clock"
                class="h-9 shrink-0 font-normal"
                :label="entry"
                data-history-entry
                @click="useHistory(entry)"
              />
            </div>
          </section>

          <section aria-labelledby="g-all" class="lg:mt-5 lg:rounded-2xl lg:bg-default lg:shadow-card lg:px-2 lg:pb-3">
            <div class="flex items-center justify-between gap-2 px-4 pt-4 pb-2 lg:sticky lg:top-0 lg:z-10 lg:bg-default lg:rounded-t-2xl lg:gap-4 lg:px-3 lg:pb-3">
              <h3 id="g-all" class="text-xs font-bold uppercase tracking-wider opacity-70 lg:shrink-0">
                Todos los himnos
                <span class="block font-normal normal-case tracking-normal tabular-nums">{{ songs.length }} himnos</span>
              </h3>
              <!-- Desktop: the index as a horizontal strip. -->
              <nav v-if="isLarge && browseList.length > 15" aria-label="Saltar a" class="flex-1 min-w-0 flex flex-wrap gap-0.5">
                <button
                  v-for="anchor in browseAnchors"
                  :key="`a-${anchor}`"
                  type="button"
                  class="h-8 min-w-8 px-2.5 rounded-full text-sm font-medium tabular-nums text-toned hover:bg-(--control-bg) hover:text-highlighted"
                  @click="songStore.jumpToSong(anchor)"
                >
                  {{ anchor }}
                </button>
              </nav>
              <div class="segmented" role="radiogroup" aria-label="Ordenar">
                <label
                  v-for="opt in [
                    { id: 'by_number', value: 'byNumber', label: 'Por número' },
                    { id: 'by_title', value: 'byTitle', label: 'Por título' },
                  ]"
                  :key="opt.id"
                  class="chip"
                  :class="{ 'chip--on': currentTab === opt.value }"
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
            <!-- Desktop: three columns. -->
            <ul v-if="isLarge" class="grid grid-cols-3 gap-x-2">
              <li
                v-for="song in browseList"
                :key="`g-${song.songId}`"
                class="border-t border-muted scroll-mt-20"
                :data-song-index="browseKey(song)"
              >
                <SongItem :song class="rounded-2xl hover:bg-muted" />
              </li>
            </ul>
            <div v-else class="flex">
              <SongsByNumber v-if="currentTab === 'byNumber'" />
              <SongsByTitle v-else />
            </div>
          </section>
        </template>
      </div>

      <!-- ===================== Desktop: the highlighted hymn ===================== -->
      <article
        v-if="isLarge && hasQuery && previewSong && selected"
        class="flex-1 min-w-0 flex flex-col rounded-2xl bg-default shadow-card overflow-hidden"
        :aria-label="`Vista previa del himno ${previewSong.songId}`"
      >
        <div
          v-if="selected.songbookId"
          class="flex items-center gap-2.5 px-7 py-2.5 bg-aqua-50 text-aqua-800 text-sm font-medium no-mark dark:bg-aqua-950 dark:text-aqua-200"
        >
          <UIcon name="i-tabler-info-circle" class="size-5 shrink-0" />
          Este himno es de {{ previewSongbookName }}. Se abre desde allí, sin cambiar tu himnario.
        </div>
        <header class="flex flex-wrap items-center gap-x-5 gap-y-3 px-7 pt-6 pb-5 border-b border-muted">
          <span class="min-w-18 h-18 px-3 rounded-2xl bg-primary/10 text-primary grid place-items-center text-3xl font-extrabold tabular-nums dark:bg-lime-300/15 dark:text-lime-300">
            {{ previewSong.songId }}
          </span>
          <div class="flex-[1_1_16rem] min-w-0">
            <p class="text-xs font-bold uppercase tracking-wider text-muted">
              {{ previewSongbookName }} · {{ previewSummary }}
            </p>
            <h2 class="mt-1 text-2xl font-bold leading-tight text-highlighted text-balance">
              {{ previewSong.title }}
            </h2>
            <p v-if="previewCitation" class="mt-0.5 text-sm text-muted no-mark">
              {{ previewCitation }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2 no-mark">
            <UButton
              size="lg"
              icon="i-tabler-music"
              label="Cantar"
              class="h-12 px-5"
              @click="sing(selected)"
            />
            <UButton
              v-if="!selected.songbookId"
              size="lg"
              color="neutral"
              variant="soft"
              icon="i-tabler-presentation"
              label="Proyectar"
              class="h-12 px-4"
              @click="project(selected)"
            />
            <UButton
              size="lg"
              color="neutral"
              variant="soft"
              icon="i-tabler-plus"
              label="Al culto"
              class="h-12 px-4"
              @click="addToCulto(selected)"
            />
            <UButton
              v-if="!selected.songbookId"
              size="lg"
              :color="isFavorite(previewSong.songId) ? 'secondary' : 'neutral'"
              variant="soft"
              square
              class="size-12 justify-center"
              :icon="isFavorite(previewSong.songId) ? 'i-tabler-heart-filled' : 'i-tabler-heart'"
              :ui="{ leadingIcon: 'size-5.5' }"
              :aria-pressed="isFavorite(previewSong.songId)"
              :aria-label="isFavorite(previewSong.songId) ? `Quitar «${previewSong.title}» de favoritos` : `Agregar «${previewSong.title}» a favoritos`"
              @click="toggleFavorite(previewSong)"
            />
          </div>
        </header>

        <!-- The lyric in the reading face, two columns when there is room. -->
        <div ref="previewRef" class="context flex-1 overflow-y-auto px-7 py-6">
          <div class="preview-lyric font-lyric text-lg/relaxed text-default">
            <section
              v-for="{ block, index } in previewBlocks"
              :key="`p-${previewSong.songId}-${index}`"
              :data-block="index"
              class="preview-block"
              :class="{
                'preview-block--chorus': block.kind === 'chorus',
                'preview-block--hit': index === selected.blockIndex,
              }"
            >
              <p class="preview-block__label no-mark">
                {{ blockLabel(block) || ' ' }}<template v-if="index === selected.blockIndex">
                  · aquí coincide
                </template>
              </p>
              <div class="hymn-block__text min-w-0" v-html="block.html" />
            </section>
          </div>
        </div>

        <footer class="flex flex-wrap items-center gap-x-5 gap-y-1 px-7 py-3 border-t border-muted text-sm text-muted no-mark">
          <span class="inline-flex items-center gap-1"><UKbd value="↑" /><UKbd value="↓" /> elegir</span>
          <span class="inline-flex items-center gap-1"><UKbd value="Enter" /> o doble clic: cantar<template v-if="selected.songbookId"> desde {{ previewSongbookName }}</template></span>
          <span class="inline-flex items-center gap-1"><UKbd value="/" /> buscar</span>
          <span class="inline-flex items-center gap-1"><UKbd value="Esc" /> borrar</span>
        </footer>
      </article>
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
.no-scrollbar {
  scrollbar-width: none;
}
/* The songbook a hymn of another one comes from. */
.songbook-badge {
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 1.3;
  border-radius: 0.375rem;
  padding: 0.0625rem 0.375rem;
  color: var(--color-aqua-700);
  background: var(--color-aqua-100);
}
/* Desktop preview: blocks flow in two columns, never split. */
.preview-lyric {
  columns: 2 20rem;
  column-gap: 2.5rem;
}
.preview-block {
  break-inside: avoid;
  margin-bottom: 1.5rem;
  border-radius: 1.125rem;
  padding: 0.75rem 1rem;
  margin-inline: -1rem;
}
.preview-block--chorus .hymn-block__text {
  font-style: italic;
}
.preview-block--hit {
  background: color-mix(in oklab, var(--ui-warning) 10%, transparent);
}
.preview-block__label {
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ui-text-muted);
  margin-bottom: 0.25rem;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>

<style>
.context mark {
  background: color-mix(in oklab, var(--ui-warning) 55%, transparent);
  color: inherit;
  border-radius: 2px;
  padding: 0 1px;
}
</style>

<style>
/* Dark mode, unscoped (`:global(.dark) .x` compiles to `.dark` alone);
   `html` outranks the scoped light values. */
html.dark .songbook-badge {
  color: var(--color-aqua-200);
  background: var(--color-aqua-950);
}
</style>
