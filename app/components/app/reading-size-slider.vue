<script setup lang="ts">
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from "reka-ui";

// Ported from Superbiblia (BibleReadingSizeSlider): a slider whose thumb
// shows the current value. Reka UI directly, because USlider has no slot
// for content inside the thumb. `label` / `valueText` (not aria-*) because
// Vue never matches props named aria-*; the thumb, which is the real
// role="slider", gets them.
defineProps<{
  min: number;
  max: number;
  step?: number;
  displayValue: string | number;
  label: string;
  valueText?: string;
}>();

const modelValue = defineModel<number>({ required: true });

const sliderValue = computed({
  get: () => [modelValue.value],
  set: (value) => {
    if (value[0] != null)
      modelValue.value = value[0];
  },
});
</script>

<template>
  <!-- #start / #end stay outside SliderRoot: the thumb is placed with a %
    of the root's width, so the root holds only track + thumb. -->
  <div class="flex items-center gap-2">
    <slot name="start" />
    <SliderRoot
      v-model="sliderValue"
      :min="min"
      :max="max"
      :step="step ?? 1"
      class="relative flex h-9 grow touch-none items-center select-none"
      data-vaul-no-drag
    >
      <SliderTrack class="relative h-1.5 grow rounded-full bg-accented">
        <SliderRange class="absolute h-full rounded-full bg-primary" />
      </SliderTrack>
      <SliderThumb
        :aria-label="label"
        :aria-valuetext="valueText"
        class="absolute top-1/2 -mt-4.5 flex size-9 items-center justify-center rounded-full bg-primary text-xs font-semibold tabular-nums text-inverted shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-(--ui-bg)"
      >
        {{ displayValue }}
      </SliderThumb>
    </SliderRoot>
    <slot name="end" />
  </div>
</template>
