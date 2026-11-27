<script setup lang="ts">
import type { Screen } from "~/utils/culto/screens";

// Any projected screen: a hymn verse (the existing ProjectionSlide) or a
// designed page. Used by the console, the editor previews and the projector.
withDefaults(defineProps<{
  screen: Screen | null;
  black?: boolean;
  badge?: string;
}>(), {
  black: false,
  badge: "",
});

defineEmits<{ (e: "overflow", value: boolean): void }>();
</script>

<template>
  <ProjectionSlide
    v-if="!screen || screen.type === 'lyric'"
    :slide="screen?.slide ?? null"
    :number="screen?.number ?? null"
    :title="screen?.title ?? ''"
    :scale="screen?.scale ?? 1"
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
</template>
