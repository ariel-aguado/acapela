<script lang="ts" setup>
import type { Song } from "~~/lib/types";

import { blockLabel } from "~/utils/lyric-match";

// The chosen hymn beside a list, on a computer: its number, title and whole
// lyric, to be sure it is the one before leaving the list, with what can be
// done with it (Cantar, Proyectar, Al culto, the heart).
const props = defineProps<{
  song: Song;
  songbookName?: string;
}>();

const songStore = useSongStore();
const songbookStore = useSongbookStore();
const culto = useCultoStore();
const { toggle, isFavorite } = useFavoriteToggle();
const { projectHymn } = useProjectHymn();

const blocks = computed(() => (props.song.blocks ?? [])
  .map((block, index) => ({ block, index }))
  .filter(({ block }) => block.kind !== "citation"));
const citation = computed(() => (props.song.blocks ?? [])
  .filter(b => b.kind === "citation")
  .map(b => b.text.join(" "))
  .join(" · "));
const summary = computed(() => {
  const list = blocks.value.map(b => b.block);
  const stanzas = list.filter(b => b.kind === "stanza").length;
  const parts = [
    stanzas === 1
      ? "1 estrofa"
      : `${stanzas} estrofas`,
  ];
  if (list.some(b => b.kind === "chorus"))
    parts.push("con coro");
  return parts.join(" · ");
});

function sing() {
  songStore.navigateToSong(props.song.songId);
}
function toService() {
  const item = culto.addItem(culto.newHymn(songbookStore.currentId, props.song.songId));
  useUndoToast().show("Agregado al culto", {
    label: "Deshacer",
    run: () => culto.removeItem(item.id),
  });
}

const lyricRef = useTemplateRef<HTMLElement>("lyric");
watch(() => props.song.songId, () => lyricRef.value?.scrollTo({ top: 0 }));
</script>

<template>
  <article class="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl bg-default shadow-card" :aria-label="`Vista previa del himno ${song.songId}`">
    <header class="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-muted px-7 pt-6 pb-5">
      <span class="grid h-18 min-w-18 place-items-center rounded-2xl bg-primary/10 px-3 text-3xl font-extrabold text-primary tabular-nums">
        {{ song.songId }}
      </span>
      <div class="min-w-0 flex-[1_1_16rem]">
        <p class="text-xs font-bold uppercase tracking-wider text-muted">
          <template v-if="songbookName">
            {{ songbookName }} ·
          </template>{{ summary }}
        </p>
        <h2 class="mt-1 text-2xl font-bold leading-tight text-highlighted text-balance">
          {{ song.title }}
        </h2>
        <p v-if="citation" class="mt-0.5 text-sm text-muted">
          {{ citation }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          size="lg"
          icon="i-tabler-music"
          label="Cantar"
          class="h-12 px-5"
          @click="sing"
        />
        <UButton
          size="lg"
          color="neutral"
          variant="soft"
          icon="i-tabler-presentation"
          label="Proyectar"
          class="h-12 px-4"
          @click="projectHymn(song.songId)"
        />
        <UButton
          size="lg"
          color="neutral"
          variant="soft"
          icon="i-tabler-plus"
          label="Al culto"
          class="h-12 px-4"
          @click="toService"
        />
        <UButton
          size="lg"
          :color="isFavorite(song.songId) ? 'secondary' : 'neutral'"
          variant="soft"
          square
          class="size-12 justify-center"
          :icon="isFavorite(song.songId) ? 'i-tabler-heart-filled' : 'i-tabler-heart'"
          :ui="{ leadingIcon: 'size-5.5' }"
          :aria-pressed="isFavorite(song.songId)"
          :aria-label="isFavorite(song.songId) ? `Quitar «${song.title}» de favoritos` : `Agregar «${song.title}» a favoritos`"
          @click="toggle(song)"
        />
      </div>
    </header>

    <!-- The lyric in the reading face, two columns when there is room. -->
    <div ref="lyric" class="soft-scrollbar min-h-0 flex-1 overflow-y-auto px-7 py-6">
      <div class="hp-lyric font-lyric text-lg/relaxed text-default">
        <section
          v-for="{ block, index } in blocks"
          :key="`p-${song.songId}-${index}`"
          class="hp-block"
          :class="{ 'hp-block--chorus': block.kind === 'chorus' }"
        >
          <p class="hp-block__label">
            {{ blockLabel(block) || ' ' }}
          </p>
          <div class="hymn-block__text min-w-0" v-html="block.html" />
        </section>
      </div>
    </div>

    <footer class="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-muted px-7 py-3 text-sm text-muted">
      <span class="inline-flex items-center gap-1"><UKbd value="↑" /><UKbd value="↓" /> elegir</span>
      <span class="inline-flex items-center gap-1"><UKbd value="Enter" /> o doble clic: cantar</span>
    </footer>
  </article>
</template>

<style scoped>
.hp-lyric {
  columns: 2 20rem;
  column-gap: 2.5rem;
}
.hp-block {
  break-inside: avoid;
  margin-bottom: 1.5rem;
}
.hp-block--chorus .hymn-block__text {
  font-style: italic;
  font-weight: 600;
}
.hp-block__label {
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ui-text-muted);
  margin-bottom: 0.25rem;
}
</style>
