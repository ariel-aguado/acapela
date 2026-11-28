<script lang="ts" setup>
import { onKeyStroke, refDebounced, useElementSize, useLocalStorage, useMediaQuery } from "@vueuse/core";

import type { FilteredSong, FullSearchResult } from "~~/lib/types";

// Favourites, for 5 hymns or for hundreds (NN/g: in a long list, search and
// filter are how people find things): a search that filters as you type
// (number, title or words of the lyric), the order people remember them
// by (number, title, recently added), groups with a heading and a row to
// jump between them, the ones opened lately at hand, and, on a computer,
// several at once to the service or out of the favourites.
const songStore = useSongStore();
const songbookStore = useSongbookStore();
const culto = useCultoStore();
const { songs, favoriteSongs, recentSongIds } = storeToRefs(songStore);
const { currentSongbook, manifest } = storeToRefs(songbookStore);
const { status, search } = useSongbookWorker();
const { show } = useUndoToast();
const isLarge = useMediaQuery("(min-width: 1024px)");
const barRef = useTemplateRef<HTMLElement>("bar");
const { height: barHeight } = useElementSize(barRef, undefined, { box: "border-box" });

type Fav = FilteredSong & { added: number; detail?: string };

/** In the order they were marked (the latest last). */
const all = computed<Fav[]>(() => favoriteSongs.value
  .map((id, added) => ({ id, added }))
  .filter(({ id }) => !!songs.value[id - 1])
  .map(({ id, added }) => {
    const s = songs.value[id - 1]!;
    const block = s.blocks?.find(b => b.kind !== "citation");
    return {
      songId: s.songId,
      title: s.title,
      firstLine: lyricExcerpt(block?.text[0] ?? ""),
      favorite: true,
      added,
    };
  }));

// ------------------------------------------------------------ search
const query = ref("");
const q = refDebounced(computed(() => query.value.trim()), 150);
/** Words: the hits of the lyric search among the favourites, with their line. */
const wordHits = ref<Map<number, string> | null>(null);
watch([q, favoriteSongs, status], async ([text]) => {
  if (!text || /^\d+$/.test(text) || status.value !== "ready") {
    wordHits.value = null;
    return;
  }
  const found = await search(text, {
    mode: "full",
    favoritesOnly: true,
    favoriteIds: favoriteSongs.value.slice(),
    limit: 2000,
  }) as FullSearchResult[];
  if (text !== q.value)
    return;
  wordHits.value = new Map(found.map(r => [
    r.songId,
    lyricExcerpt(r.matchedLines[0]?.line ?? ""),
  ]));
}, { immediate: true });

const filtered = computed<Fav[]>(() => {
  const text = q.value;
  if (!text)
    return all.value;
  if (/^\d+$/.test(text))
    return all.value.filter(f => String(f.songId).startsWith(text));
  const hits = wordHits.value;
  if (!hits)
    return [];
  return all.value
    .filter(f => hits.has(f.songId))
    .map(f => ({ ...f, detail: hits.get(f.songId) || undefined }));
});
const searching = computed(() => !!q.value && !/^\d+$/.test(q.value) && !wordHits.value);

// ------------------------------------------------------------ order and groups
type SortBy = "number" | "title" | "recent";
const sortBy = useLocalStorage<SortBy>("favoritesSort", "number");
const sortItems = [
  { label: "Número", value: "number" },
  { label: "Título", value: "title" },
  { label: "Recientes", value: "recent" },
];

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });
/** «¡Sublime gracia!» goes under S: signs at the start do not count. */
function sortKey(title: string) {
  return title.replace(/^[^\p{L}\p{N}]+/u, "");
}
function initial(title: string) {
  const c = title.normalize("NFD").replace(/[^\p{L}\p{N}]/gu, "").charAt(0).toUpperCase();
  return /\d/.test(c)
    ? "#"
    : c || "#";
}
function range(id: number) {
  const start = Math.floor(id / 100) * 100;
  return `${Math.max(1, start)}–${start + 99}`;
}

const groups = computed(() => {
  const list = filtered.value.slice();
  if (sortBy.value === "title")
    list.sort((a, b) => collator.compare(sortKey(a.title), sortKey(b.title)));
  else if (sortBy.value === "recent")
    list.sort((a, b) => b.added - a.added);
  else
    list.sort((a, b) => a.songId - b.songId);
  // Few, or the latest first: one list, with no headings.
  if (sortBy.value === "recent" || list.length <= 12) {
    return [
      { key: "all", label: "", songs: list },
    ];
  }
  const out: { key: string; label: string; songs: Fav[] }[] = [];
  for (const song of list) {
    const label = sortBy.value === "title"
      ? initial(song.title)
      : range(song.songId);
    const last = out.at(-1);
    if (last?.label === label) {
      last.songs.push(song);
    }
    else {
      out.push({
        key: label,
        label,
        songs: [song],
      });
    }
  }
  return out;
});
/** The row to jump between groups, for a long list. */
const showJump = computed(() => groups.value.length > 1 && filtered.value.length > 40);
function jumpTo(key: string) {
  document.getElementById(`fav-group-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ------------------------------------------------------------ at hand
/** Favourites opened lately: the ones of every week, one touch away. */
const recentFavs = computed(() => {
  if (q.value || all.value.length < 8)
    return [];
  const byId = new Map(all.value.map(f => [f.songId, f]));
  return recentSongIds.value.map(id => byId.get(id)).filter(f => !!f).slice(0, 8) as Fav[];
});

/** Favourites kept in the other songbooks. */
const favoritesBySongbook = useLocalStorage<Record<string, number[]>>("favoritesBySongbook", {});
const elsewhere = computed(() => manifest.value
  .filter(b => b.id !== currentSongbook.value?.id && (favoritesBySongbook.value[b.id]?.length ?? 0) > 0)
  .map(b => ({ id: b.id, name: b.name, count: favoritesBySongbook.value[b.id]!.length })));
onMounted(() => {
  if (!manifest.value.length)
    songbookStore.loadManifest();
});

// ------------------------------------------------------------ several at once
const selecting = ref(false);
const chosen = ref(new Set<number>());
watch(isLarge, (large) => {
  if (!large)
    selecting.value = false;
});
watch(selecting, () => (chosen.value = new Set()));
function pick(songId: number) {
  const next = new Set(chosen.value);
  if (next.has(songId))
    next.delete(songId);
  else
    next.add(songId);
  chosen.value = next;
}
const allShownChosen = computed(() => filtered.value.length > 0 && filtered.value.every(f => chosen.value.has(f.songId)));
function pickAll() {
  chosen.value = allShownChosen.value
    ? new Set()
    : new Set(filtered.value.map(f => f.songId));
}
/** In the order shown. */
const chosenInOrder = computed(() => groups.value.flatMap(g => g.songs).filter(f => chosen.value.has(f.songId)));

function toService() {
  const songbookId = currentSongbook.value?.id;
  if (!songbookId || !chosenInOrder.value.length)
    return;
  const n = chosenInOrder.value.length;
  for (const f of chosenInOrder.value)
    culto.addItem(culto.newHymn(songbookId, f.songId));
  selecting.value = false;
  show(`${n === 1
    ? "Se agregó 1 himno"
    : `Se agregaron ${n} himnos`} al culto`, {
    label: "Ir al culto",
    run: () => navigateTo("/culto"),
  });
}

function unfavorite() {
  const before = favoriteSongs.value.slice();
  const out = new Set(chosen.value);
  const n = out.size;
  if (!n)
    return;
  favoriteSongs.value = before.filter(id => !out.has(id));
  selecting.value = false;
  show(n === 1
    ? "Se quitó 1 himno de Favoritos"
    : `Se quitaron ${n} himnos de Favoritos`, {
    label: "Deshacer",
    run: () => (favoriteSongs.value = before),
  });
}

// ------------------------------------------------------------ the one beside
// On a computer the list is one column, and the chosen hymn's lyric is shown
// beside it (as in Buscar): ↑ ↓ to go through the list, Enter to open it.
const shown = computed(() => groups.value.flatMap(g => g.songs));
const previewId = ref<number | null>(null);
watch(shown, (list) => {
  if (!list.some(f => f.songId === previewId.value))
    previewId.value = list[0]?.songId ?? null;
}, { immediate: true });
const previewSong = computed(() => (previewId.value
  ? songs.value[previewId.value - 1] ?? null
  : null));
function step(delta: 1 | -1) {
  const list = shown.value;
  const at = list.findIndex(f => f.songId === previewId.value);
  const next = list[Math.min(list.length - 1, Math.max(0, at + delta))];
  if (!next)
    return;
  previewId.value = next.songId;
  nextTick(() => document.querySelector(`[data-fav="${next.songId}"]`)?.scrollIntoView({ block: "nearest" }));
}
onKeyStroke(["ArrowDown", "ArrowUp", "Enter"], (e: KeyboardEvent) => {
  if (!isLarge.value || selecting.value || e.defaultPrevented)
    return;
  const target = e.target as HTMLElement | null;
  // From the search field, the page or a row of the list; not from another
  // button or a menu.
  const fromList = !target || target === document.body || target.tagName === "INPUT" || !!target.closest(".song-row");
  if (!fromList)
    return;
  if (e.key === "Enter") {
    if (previewId.value)
      songStore.navigateToSong(previewId.value);
    return;
  }
  e.preventDefault();
  step(e.key === "ArrowDown"
    ? 1
    : -1);
});

function searchEverywhere() {
  navigateTo({
    path: "/search",
    query: {
      q: query.value.trim(),
    },
  });
}
</script>

<template>
  <div class="page-scroll" :style="{ '--fav-bar-h': `${Math.round(barHeight)}px` }">
    <div class="flex flex-col w-full max-w-2xl lg:max-w-7xl lg:px-4 mx-auto min-w-0">
      <div v-if="status === 'loading'" class="flex justify-center py-10">
        <UIcon name="i-tabler-loader-2" class="size-8 animate-spin text-primary" aria-label="Cargando" />
      </div>

      <template v-else-if="all.length">
        <!-- Search, count, order and the jump row: always at hand. Its
          backdrop is the page canvas in either theme, so it never shows as
          a lighter band in dark mode. -->
        <div ref="bar" class="fav-bar sticky top-0 z-20 flex flex-col gap-2 bg-(--app-canvas)/90 px-4 pt-3 pb-2 backdrop-blur lg:px-0">
          <div class="flex items-center gap-2">
            <UInput
              v-model="query"
              icon="i-tabler-search"
              size="xl"
              class="flex-1"
              placeholder="Número, título o letra"
              aria-label="Buscar en tus favoritos"
              :ui="{ base: 'rounded-full' }"
            >
              <template v-if="query" #trailing>
                <UButton
                  color="neutral"
                  variant="link"
                  size="sm"
                  icon="i-tabler-x"
                  aria-label="Borrar la búsqueda"
                  @click="query = ''"
                />
              </template>
            </UInput>
          </div>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span class="text-sm font-semibold tabular-nums" role="status">
              <template v-if="q">{{ searching ? 'Buscando…' : `${filtered.length} de ${all.length}` }}</template>
              <template v-else>{{ all.length }} {{ all.length === 1 ? 'himno' : 'himnos' }}</template>
              <span class="font-normal text-muted"> en {{ currentSongbook?.name }}</span>
            </span>
            <span class="flex-1" />
            <UFieldGroup role="radiogroup" aria-label="Ordenar favoritos" class="shrink-0">
              <UButton
                v-for="o in sortItems"
                :key="o.value"
                color="neutral"
                :variant="sortBy === o.value ? 'solid' : 'outline'"
                size="sm"
                role="radio"
                :aria-checked="sortBy === o.value"
                :label="o.label"
                @click="sortBy = o.value as SortBy"
              />
            </UFieldGroup>
            <UButton
              v-if="isLarge"
              color="neutral"
              :variant="selecting ? 'solid' : 'outline'"
              size="sm"
              icon="i-tabler-checkbox"
              :label="selecting ? 'Listo' : 'Seleccionar'"
              @click="selecting = !selecting"
            />
          </div>
          <nav
            v-if="showJump"
            v-scroll-fade-x
            class="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] lg:mx-0 lg:px-0"
            aria-label="Ir a un grupo"
          >
            <UButton
              v-for="g in groups"
              :key="g.key"
              color="neutral"
              variant="soft"
              size="xs"
              class="shrink-0 tabular-nums"
              :label="g.label"
              @click="jumpTo(g.key)"
            />
          </nav>
        </div>

        <!-- Several at once (computer). -->
        <div v-if="selecting" class="mx-4 mb-2 flex flex-wrap items-center gap-2 rounded-2xl bg-primary/10 px-3 py-2 lg:mx-0">
          <UCheckbox
            :model-value="allShownChosen"
            :label="`${chosen.size} ${chosen.size === 1 ? 'elegido' : 'elegidos'}`"
            aria-label="Elegir todos los que se ven"
            @update:model-value="pickAll"
          />
          <span class="flex-1" />
          <UButton
            icon="i-tabler-list-details"
            size="sm"
            label="Agregar al culto"
            :disabled="!chosen.size"
            @click="toService"
          />
          <UButton
            color="error"
            variant="soft"
            size="sm"
            icon="i-tabler-heart-off"
            label="Quitar de Favoritos"
            :disabled="!chosen.size"
            @click="unfavorite"
          />
        </div>

        <!-- Opened lately. -->
        <section v-if="recentFavs.length && !selecting" class="flex flex-col gap-2 px-4 pt-2 pb-3 lg:px-0" aria-labelledby="fav-recent">
          <h2 id="fav-recent" class="text-xs font-bold uppercase tracking-wider opacity-70">
            Abiertos hace poco
          </h2>
          <ul v-scroll-fade-x class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0">
            <li v-for="f in recentFavs" :key="f.songId" class="shrink-0">
              <button
                type="button"
                class="flex max-w-56 items-center gap-2 rounded-xl bg-default px-3 py-2 text-start shadow-card hover:ring-1 hover:ring-primary"
                @click="songStore.navigateToSong(f.songId)"
              >
                <span class="font-semibold text-primary tabular-nums">{{ f.songId }}</span>
                <span class="truncate text-sm font-semibold">{{ f.title }}</span>
              </button>
            </li>
          </ul>
        </section>

        <!-- One under the other; on a computer, the chosen one's lyric beside. -->
        <div v-if="filtered.length" class="lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-4 lg:pb-6">
          <div class="flex flex-col gap-3">
            <section
              v-for="g in groups"
              :id="`fav-group-${g.key}`"
              :key="g.key"
              class="fav-group lg:rounded-2xl lg:bg-default lg:shadow-card"
              :aria-label="g.label || 'Favoritos'"
            >
              <h2
                v-if="g.label"
                class="fav-group__head sticky z-10 border-b border-muted bg-default/95 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-muted backdrop-blur lg:rounded-t-2xl"
              >
                {{ g.label }}
                <span class="font-semibold normal-case tracking-normal">· {{ g.songs.length }}</span>
              </h2>
              <ul class="bg-default lg:rounded-2xl lg:p-1.5">
                <li
                  v-for="song in g.songs"
                  :key="song.songId"
                  class="border-t border-muted first:border-t-0 lg:border-t-0"
                  :data-fav="song.songId"
                >
                  <SongItem
                    :song
                    :detail="song.detail"
                    :selectable="isLarge"
                    :selected="selecting ? chosen.has(song.songId) : song.songId === previewId"
                    :show-favorite="!selecting"
                    @select="id => selecting ? pick(id) : (previewId = id)"
                  />
                </li>
              </ul>
            </section>
          </div>
          <HymnPreview
            v-if="isLarge && previewSong"
            :song="previewSong"
            :songbook-name="currentSongbook?.name"
            class="fav-preview sticky"
          />
        </div>

        <!-- Nothing matches. -->
        <div v-else-if="!searching" class="flex flex-col items-center gap-3 px-8 py-12 text-center">
          <UIcon name="i-tabler-heart-search" class="size-10 text-secondary" />
          <p class="font-bold">
            Ningún favorito coincide con «{{ q }}»
          </p>
          <p class="max-w-xs text-sm opacity-80">
            Prueba con otras palabras, o búscalo en todo el himnario.
          </p>
          <UButton icon="i-tabler-search" label="Buscar en todo el himnario" @click="searchEverywhere" />
        </div>
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

      <!-- Favourites kept in other songbooks. -->
      <p v-if="elsewhere.length && status !== 'loading'" class="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-6 text-sm text-muted lg:px-0">
        También tienes favoritos en:
        <template v-for="(b, i) in elsewhere" :key="b.id">
          <UButton
            color="neutral"
            variant="link"
            size="sm"
            class="px-0 font-semibold"
            :label="`${b.name} (${b.count})`"
            @click="songbookStore.selectSongbook(b.id)"
          /><span v-if="i < elsewhere.length - 1" aria-hidden="true">·</span>
        </template>
      </p>
    </div>
  </div>
</template>

<style scoped>
/* The group heading sits under the bar while its group scrolls by. */
.fav-group__head {
  top: var(--fav-bar-h, 0px);
}
/* The lyric beside the list stays in sight, under the bar. */
.fav-preview {
  top: calc(var(--fav-bar-h, 0px) + 0.5rem);
  max-height: calc(100dvh - var(--fav-bar-h, 0px) - 8rem);
}
</style>
