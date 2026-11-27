<script lang="ts" setup>
import type { FieldStyle, TextAlign } from "~~/lib/culto";

// A text's own style, right under the text it changes (NN/g: proximity):
// its alignment and size, over the screen's. The same row for every text of
// a screen; "Como la pantalla" goes back to the screen's.
const props = defineProps<{
  /** "el título", "la etiqueta"…, for the labels read aloud. */
  name: string;
  /** What it looks like with no style of its own. */
  inheritedAlign: TextAlign;
}>();
const model = defineModel<FieldStyle | undefined>();

const ALIGN: { value: TextAlign; icon: string; label: string }[] = [
  { value: "start", icon: "i-tabler-align-left", label: "a la izquierda" },
  { value: "center", icon: "i-tabler-align-center", label: "al centro" },
  { value: "end", icon: "i-tabler-align-right", label: "a la derecha" },
];

/** «de el título» → «del título». */
const ofName = computed(() => props.name.startsWith("el ")
  ? `del ${props.name.slice(3)}`
  : `de ${props.name}`);

const align = computed(() => model.value?.align ?? props.inheritedAlign);
const percent = computed(() => Math.round((model.value?.scale ?? 1) * 100));

function patch(changes: FieldStyle) {
  const next: FieldStyle = {
    ...model.value,
    ...changes,
  };
  if (!next.align)
    delete next.align;
  if (!next.scale || next.scale === 1)
    delete next.scale;
  model.value = Object.keys(next).length
    ? next
    : undefined;
}

function resize(delta: number) {
  const value = Math.round(Math.min(2, Math.max(0.5, (model.value?.scale ?? 1) + delta)) * 10) / 10;
  patch({ scale: value });
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 rounded-xl bg-elevated/60 px-2 py-1.5">
    <UFieldGroup role="radiogroup" :aria-label="`Alineación ${ofName}`">
      <UButton
        v-for="a in ALIGN"
        :key="a.value"
        color="neutral"
        :variant="align === a.value ? 'solid' : 'ghost'"
        size="sm"
        square
        :icon="a.icon"
        role="radio"
        :aria-checked="align === a.value"
        :aria-label="`Alinear ${name} ${a.label}`"
        @click="patch({ align: a.value })"
      />
    </UFieldGroup>
    <UFieldGroup role="group" :aria-label="`Tamaño ${ofName}`">
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        square
        icon="i-tabler-minus"
        :aria-label="`Achicar ${name}`"
        :disabled="percent <= 50"
        @click="resize(-0.1)"
      />
      <span class="min-w-12 self-center text-center text-sm tabular-nums" aria-live="polite">{{ percent }} %</span>
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        square
        icon="i-tabler-plus"
        :aria-label="`Agrandar ${name}`"
        :disabled="percent >= 200"
        @click="resize(0.1)"
      />
    </UFieldGroup>
    <UButton
      v-if="model"
      color="neutral"
      variant="link"
      size="sm"
      label="Como la pantalla"
      class="ms-auto"
      @click="model = undefined"
    />
  </div>
</template>
