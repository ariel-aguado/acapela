<script lang="ts" setup>
import type { FilteredSong } from "~~/lib/types";

// One hymn row: the title leads, the number is plain tabular text in the
// brand tone, and the heart is a real toggle button with Deshacer.
const props = withDefaults(defineProps<{
  song: FilteredSong;
  /** Second line; defaults to the hymn's first line. */
  detail?: string;
  /** Small tag after the detail, e.g. "Estrofa 2" or "Coro". */
  tag?: string;
  /** Block to open the hymn at (lyric search hits). */
  blockIndex?: number;
  showFavorite?: boolean;
}>(), {
  detail: undefined,
  tag: "",
  blockIndex: -1,
  showFavorite: true,
});

const emit = defineEmits<{ (e: "open", songId: number): void }>();

const songStore = useSongStore();
const { toggle, isFavorite } = useFavoriteToggle();

const favorite = computed(() => isFavorite(props.song.songId));

function open() {
  emit("open", props.song.songId);
  songStore.navigateToSong(props.song.songId, props.blockIndex);
}
</script>

<template>
  <div class="song-row flex items-center gap-1 pl-4 pr-1">
    <button
      type="button"
      class="flex-1 min-w-0 flex items-center gap-3 py-2.5 text-start cursor-pointer"
      @click="open"
    >
      <span class="w-10 shrink-0 text-lg font-semibold text-primary tabular-nums text-end">
        {{ song.songId }}
      </span>
      <span class="flex-1 min-w-0 flex flex-col">
        <span class="font-semibold leading-snug line-clamp-1">{{ song.title }}</span>
        <span class="text-sm opacity-70 line-clamp-1">
          <slot name="detail">{{ detail ?? song.firstLine }}</slot>
        </span>
        <span v-if="tag" class="text-xs opacity-60 mt-0.5">{{ tag }}</span>
      </span>
    </button>
    <UButton
      v-if="showFavorite"
      :color="favorite ? 'secondary' : 'neutral'"
      variant="ghost"
      square
      class="size-12 shrink-0 justify-center"
      :class="{ 'opacity-60': !favorite }"
      :icon="favorite ? 'i-tabler-heart-filled' : 'i-tabler-heart'"
      :ui="{ leadingIcon: 'size-6' }"
      :aria-pressed="favorite"
      :aria-label="favorite ? `Quitar «${song.title}» de favoritos` : `Agregar «${song.title}» a favoritos`"
      @click="toggle(song)"
    />
  </div>
</template>
