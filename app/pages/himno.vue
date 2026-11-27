<script lang="ts" setup>
import type { Song } from "~~/lib/types";

// One hymn of a songbook other than the chosen one, read without changing
// the choice in Ajustes: the search sends here when the chosen songbook has
// nothing and another one has it. /himno?himnario=<id>&n=<number>&estrofa=<block>

const route = useRoute();
const router = useRouter();
const songbookStore = useSongbookStore();
const { manifest, currentSongbook } = storeToRefs(songbookStore);
const { fontSize } = storeToRefs(useFontStore());

const songbookId = computed(() => String(route.query.himnario ?? ""));
const number = computed(() => Number(route.query.n) || 0);
const blockIndex = computed(() => {
  const b = Number(route.query.estrofa);
  return Number.isInteger(b)
    ? b
    : -1;
});

const meta = computed(() => manifest.value.find(s => s.id === songbookId.value));
const loaded = computed<Song[] | Error | undefined>(() => (meta.value
  ? songsOf(meta.value.id, meta.value.file)
  : undefined));
const song = computed<Song | null>(() => {
  const songs = loaded.value;
  return Array.isArray(songs)
    ? songs.find(s => s.songId === number.value) ?? null
    : null;
});
const failed = computed(() =>
  (songbookStore.manifestLoaded && !meta.value)
  || loaded.value instanceof Error
  || (Array.isArray(loaded.value) && !song.value),
);

onMounted(() => {
  songbookStore.loadManifest().catch(() => {});
});

// The stanza that matched the search, shown and tinted as in Cantar.
const shownBlock = ref(-1);
watch(song, async (s) => {
  if (!s || blockIndex.value < 0)
    return;
  await nextTick();
  const el = document.querySelector<HTMLElement>(`[data-block="${blockIndex.value}"]`);
  if (!el)
    return;
  shownBlock.value = blockIndex.value;
  el.scrollIntoView({ block: "center" });
}, { immediate: true });

function back() {
  if (window.history.state?.back)
    router.back();
  else
    navigateTo("/search");
}

useHead(() => ({
  title: song.value
    ? `${song.value.songId}. ${song.value.title} · ${meta.value?.name}`
    : "Himno",
}));
</script>

<template>
  <div class="flex-1 min-h-0 overflow-y-auto pad-bar-top pad-bar-bottom">
    <div class="mx-auto w-full max-w-[44rem] px-4 pt-2 pb-6">
      <div class="flex items-center gap-3 rounded-2xl bg-aqua-50 text-aqua-800 px-4 py-3 text-sm dark:bg-aqua-950 dark:text-aqua-200">
        <UIcon name="i-tabler-info-circle" class="size-5 shrink-0" />
        <p class="flex-1 min-w-0">
          <template v-if="meta">
            Himno de <strong class="font-semibold">{{ meta.name }}</strong>.
          </template>
          <template v-if="currentSongbook">
            Tu himnario sigue siendo {{ currentSongbook.name }}.
          </template>
        </p>
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-tabler-arrow-left"
          label="Volver"
          class="shrink-0"
          @click="back"
        />
      </div>
    </div>

    <div v-if="failed" class="flex flex-col items-center text-center gap-3 px-6 py-10">
      <AppEmptyIllustration class="w-36" />
      <p class="text-lg font-bold">
        No pudimos abrir este himno
      </p>
      <UButton
        color="neutral"
        variant="soft"
        label="Volver a buscar"
        @click="back"
      />
    </div>

    <div v-else-if="!song" class="flex justify-center py-16">
      <UIcon name="i-tabler-loader-2" class="size-10 animate-spin text-primary" aria-label="Cargando" />
    </div>

    <article
      v-else
      class="hymn flex flex-col w-full"
      :data-song="song.songId"
      :aria-labelledby="`hymn-title-${song.songId}`"
    >
      <header :style="{ paddingInline: 'var(--reading-margin)' }">
        <div class="mx-auto w-full max-w-[38rem]">
          <h2
            :id="`hymn-title-${song.songId}`"
            class="font-lyric font-semibold flex items-baseline gap-[0.35em]"
            :style="{ fontSize: `${Math.round(fontSize * 1.25)}px`, lineHeight: 1.25 }"
          >
            <span class="shrink-0 text-primary tabular-nums">{{ song.songId }}.</span>
            <span class="min-w-0 text-balance">{{ song.title }}</span>
          </h2>
          <p
            v-for="(cite, ci) in song.blocks.filter(b => b.kind === 'citation')"
            :key="`cite-${ci}`"
            class="text-sm opacity-70 mt-0.5"
          >
            {{ cite.text.join(" ") }}
          </p>
        </div>
      </header>
      <div
        class="mx-auto w-full max-w-[40rem] font-lyric pt-4 flex flex-col gap-5"
        :style="{ fontSize: `${fontSize}px`, lineHeight: 'var(--reading-line-height)', paddingInline: 'var(--reading-margin)' }"
      >
        <template v-for="(block, bi) in song.blocks" :key="`b-${song.songId}-${bi}`">
          <section
            v-if="block.kind !== 'citation'"
            class="hymn-block"
            :class="[
              block.kind === 'chorus' ? 'hymn-block--chorus' : 'hymn-block--stanza',
              { 'hymn-block--found': bi === shownBlock },
            ]"
            :data-block="bi"
            :aria-label="blockLabel(block) || undefined"
          >
            <span class="hymn-block__label" aria-hidden="true">
              {{ block.kind === 'chorus' ? 'Coro' : block.number }}
            </span>
            <div class="hymn-block__text min-w-0" v-html="block.html" />
          </section>
        </template>
      </div>
    </article>
  </div>
</template>
