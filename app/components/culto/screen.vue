<script setup lang="ts">
import type { Screen } from "~/utils/culto/screens";

import { lookVars } from "~/utils/culto/look";
import { mediaUrl } from "~/utils/culto/media";

// Any projected screen: a hymn verse (the existing ProjectionSlide), a
// designed page or a slide image. The church's look travels with the screen
// (screen.look) and reaches the slides as CSS variables. Used by the
// console, the editor previews and the projector.
const props = withDefaults(defineProps<{
  screen: Screen | null;
  black?: boolean;
  badge?: string;
}>(), {
  black: false,
  badge: "",
});

defineEmits<{ (e: "overflow", value: boolean): void }>();

const look = computed(() => props.screen && props.screen.type !== "image"
  ? props.screen.look
  : undefined);

// Images live in IndexedDB: their URL arrives a moment later.
const backgroundUrl = ref<string | null>(null);
const slideUrl = ref<string | null>(null);
watchEffect(async () => {
  const bg = look.value?.background;
  backgroundUrl.value = bg?.kind === "image"
    ? await mediaUrl(bg.mediaId)
    : null;
});
watchEffect(async () => {
  slideUrl.value = props.screen?.type === "image"
    ? await mediaUrl(props.screen.mediaId)
    : null;
});

const vars = computed(() => lookVars(look.value, backgroundUrl.value));
</script>

<template>
  <div class="culto-screen" :style="vars">
    <div v-if="screen?.type === 'image'" class="projection-frame">
      <img
        v-if="slideUrl && !black"
        :src="slideUrl"
        alt=""
        class="absolute inset-0 size-full object-contain"
      >
      <span v-if="badge" class="projection-badge">{{ badge }}</span>
    </div>
    <ProjectionSlide
      v-else-if="!screen || screen.type === 'lyric'"
      :slide="screen?.slide ?? null"
      :number="screen?.number ?? null"
      :title="screen?.title ?? ''"
      :scale="screen?.scale ?? 1"
      :size="screen?.type === 'lyric' ? screen.size : undefined"
      :black="black"
      :badge="badge"
      @overflow="$emit('overflow', $event)"
    />
    <CultoPageSlide
      v-else
      :screen="screen"
      :black="black"
      :badge="badge"
    />
  </div>
</template>
