<script setup lang="ts">
// Slider with the current value and a live preview in the lyric typeface,
// so the reader sees the result before closing the panel.
const fontStore = useFontStore();
const { fontSize } = storeToRefs(fontStore);
const songStore = useSongStore();

const sample = computed(() => {
  const block = songStore.currentSong?.blocks?.find(b => b.kind !== "citation");
  return block?.text[0] ?? "Cantad alegres; sí, cantad a Dios";
});

function onSlide(value: number | undefined) {
  if (value !== undefined)
    fontStore.setFont(value);
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-baseline justify-between">
      <span id="font-size-label" class="font-medium">Tamaño de letra</span>
      <span class="text-sm tabular-nums opacity-70">{{ fontSize }} px</span>
    </div>
    <div class="flex items-center gap-3">
      <UButton
        color="neutral"
        variant="ghost"
        square
        class="size-11 justify-center text-sm font-bold"
        label="A"
        aria-label="Achicar la letra"
        :disabled="fontSize <= fontStore.min"
        @click="fontStore.decreaseFont()"
      />
      <USlider
        :model-value="fontSize"
        :min="fontStore.min"
        :max="fontStore.max"
        :step="2"
        class="flex-1"
        aria-labelledby="font-size-label"
        @update:model-value="onSlide"
      />
      <UButton
        color="neutral"
        variant="ghost"
        square
        class="size-11 justify-center text-2xl font-bold"
        label="A"
        aria-label="Agrandar la letra"
        :disabled="fontSize >= fontStore.max"
        @click="fontStore.increaseFont()"
      />
    </div>
    <p
      class="font-lyric rounded-2xl bg-muted px-4 py-3 leading-snug overflow-hidden"
      :style="{ fontSize: `${fontSize}px` }"
      aria-hidden="true"
    >
      {{ sample }}
    </p>
    <UButton
      v-if="fontSize !== fontStore.defaultSize"
      color="neutral"
      variant="ghost"
      class="self-start"
      :label="`Restablecer (${fontStore.defaultSize} px)`"
      @click="fontStore.resetFont()"
    />
  </div>
</template>
