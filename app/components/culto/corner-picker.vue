<script lang="ts" setup>
import type { TitleCorner } from "~~/lib/culto";

import { TITLE_CORNER_LABELS } from "~~/lib/culto";

// Where a hymn's number and title go, picked on a small screen with its four
// corners (recognition over recall: the place is seen, not named). Used by
// the church's theme and by each hymn.
defineProps<{ label?: string }>();
const model = defineModel<TitleCorner>({ required: true });

const PLACES: Record<TitleCorner, string> = {
  "top-start": "top-1.5 start-1.5",
  "top-end": "top-1.5 end-1.5",
  "bottom-start": "bottom-1.5 start-1.5",
  "bottom-end": "bottom-1.5 end-1.5",
};
const corners = (Object.keys(PLACES) as TitleCorner[]).map(value => ({ value, label: TITLE_CORNER_LABELS[value], place: PLACES[value] }));
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label ?? 'Dónde va el título del himno'"
    class="relative aspect-video w-48 rounded-xl bg-elevated ring-1 ring-default"
  >
    <button
      v-for="c in corners"
      :key="c.value"
      type="button"
      role="radio"
      :aria-checked="model === c.value"
      :aria-label="c.label"
      :title="c.label"
      class="absolute flex h-7 w-16 items-center justify-center rounded-md text-[0.65rem] font-bold transition-colors"
      :class="[c.place, model === c.value ? 'bg-primary text-inverted shadow-sm' : 'bg-default text-muted ring-1 ring-default hover:text-highlighted hover:ring-primary']"
      @click="model = c.value"
    >
      56. Título
    </button>
    <span class="pointer-events-none absolute inset-x-6 top-1/2 flex -translate-y-1/2 flex-col items-center gap-1" aria-hidden="true">
      <span class="h-1.5 w-24 rounded-full bg-muted" />
      <span class="h-1.5 w-20 rounded-full bg-muted" />
    </span>
  </div>
</template>
