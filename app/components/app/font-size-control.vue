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

function onInput(e: Event) {
  fontStore.setFont(Number((e.target as HTMLInputElement).value));
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-baseline justify-between">
      <label for="font-size-range" class="font-medium">Tamaño de letra</label>
      <span class="text-sm tabular-nums opacity-70">{{ fontSize }} px</span>
    </div>
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="btn btn-ghost btn-square h-11 w-11 text-sm"
        aria-label="Achicar la letra"
        :disabled="fontSize <= fontStore.min"
        @click="fontStore.decreaseFont()"
      >
        A
      </button>
      <input
        id="font-size-range"
        type="range"
        class="range range-primary range-sm flex-1"
        :min="fontStore.min"
        :max="fontStore.max"
        step="2"
        :value="fontSize"
        :aria-valuetext="`${fontSize} píxeles`"
        @input="onInput"
      >
      <button
        type="button"
        class="btn btn-ghost btn-square h-11 w-11 text-2xl"
        aria-label="Agrandar la letra"
        :disabled="fontSize >= fontStore.max"
        @click="fontStore.increaseFont()"
      >
        A
      </button>
    </div>
    <p
      class="font-lyric rounded-box bg-base-200 px-4 py-3 leading-snug overflow-hidden"
      :style="{ fontSize: `${fontSize}px` }"
      aria-hidden="true"
    >
      {{ sample }}
    </p>
    <button
      v-if="fontSize !== fontStore.defaultSize"
      type="button"
      class="btn btn-ghost btn-sm self-start"
      @click="fontStore.resetFont()"
    >
      Restablecer ({{ fontStore.defaultSize }} px)
    </button>
  </div>
</template>
