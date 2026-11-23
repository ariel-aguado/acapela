<script setup lang="ts">
import {
  APP_FONTS,
  lineHeightFor,
  marginFor,
  READING_FONTS,
  STEP_MAX,
  STEP_MIN,
} from "~/composables/use-reading-preferences";

// Reading settings, as in Superbiblia's «Ajustes de lectura»: a live
// preview, the size, line spacing and margin, and the typeface of the
// lyrics and of the interface as "Aa" tiles (recognise the letter instead
// of remembering its name). Used by the "Aa" sheet and by Ajustes.
const fontStore = useFontStore();
const { fontSize } = storeToRefs(fontStore);
const { readingFont, lineHeightStep, marginStep, appFont } = useReadingPreferences();
const songStore = useSongStore();

// Two lines of the open hymn, so line spacing shows in the preview.
const sample = computed(() => {
  const block = songStore.currentSong?.blocks?.find(b => b.kind !== "citation");
  return block?.text.slice(0, 2) ?? ["Cantad alegres; sí, cantad a Dios,", "habitantes de toda la tierra."];
});

const size = computed({
  get: () => fontSize.value,
  set: v => fontStore.setFont(v),
});

const isDefault = computed(() =>
  fontSize.value === fontStore.defaultSize
  && lineHeightStep.value === 1
  && marginStep.value === 1
  && readingFont.value === "literata"
  && appFont.value === "inter",
);

function reset() {
  fontStore.resetFont();
  lineHeightStep.value = 1;
  marginStep.value = 1;
  readingFont.value = "literata";
  appFont.value = "inter";
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Preview: the panel covers part of the hymn on a phone. -->
    <section
      aria-label="Vista previa"
      class="rounded-2xl bg-muted py-3 overflow-hidden"
      :style="{ paddingInline: 'var(--reading-margin)' }"
    >
      <p
        class="font-lyric"
        :style="{ fontSize: `${fontSize}px`, lineHeight: 'var(--reading-line-height)' }"
      >
        <template v-for="(line, i) in sample" :key="i">
          {{ line }}<br v-if="i < sample.length - 1">
        </template>
      </p>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="rs-text">
      <h3 id="rs-text" class="rs-heading">
        Texto
      </h3>
      <div>
        <p class="mb-2 text-sm font-semibold">
          Tamaño
        </p>
        <AppReadingSizeSlider
          v-model="size"
          :min="fontStore.min"
          :max="fontStore.max"
          :step="2"
          :display-value="fontSize"
          label="Tamaño de la letra"
          :value-text="`${fontSize} píxeles`"
        >
          <template #start>
            <span aria-hidden="true" class="w-4 shrink-0 text-center text-sm text-muted">A</span>
          </template>
          <template #end>
            <span aria-hidden="true" class="w-5 shrink-0 text-center text-xl font-semibold text-muted">A</span>
          </template>
        </AppReadingSizeSlider>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <p class="mb-2 text-sm font-semibold">
            Interlineado
          </p>
          <AppReadingSizeSlider
            v-model="lineHeightStep"
            :min="STEP_MIN"
            :max="STEP_MAX"
            :display-value="lineHeightFor(lineHeightStep)"
            label="Interlineado"
          >
            <template #start>
              <UIcon name="i-tabler-baseline-density-small" class="size-4 shrink-0 text-muted" />
            </template>
            <template #end>
              <UIcon name="i-tabler-baseline-density-large" class="size-5 shrink-0 text-muted" />
            </template>
          </AppReadingSizeSlider>
        </div>
        <div>
          <p class="mb-2 text-sm font-semibold">
            Margen
          </p>
          <AppReadingSizeSlider
            v-model="marginStep"
            :min="STEP_MIN"
            :max="STEP_MAX"
            :display-value="marginFor(marginStep)"
            label="Margen"
            :value-text="`${marginFor(marginStep)} píxeles`"
          >
            <template #start>
              <UIcon name="i-tabler-layout-sidebar-left-collapse" class="size-4 shrink-0 text-muted" />
            </template>
            <template #end>
              <UIcon name="i-tabler-layout-sidebar-left-expand" class="size-5 shrink-0 text-muted" />
            </template>
          </AppReadingSizeSlider>
        </div>
      </div>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="rs-font">
      <h3 id="rs-font" class="rs-heading">
        Letra
      </h3>
      <p id="rs-lyric-font" class="text-sm font-semibold">
        Himnos
      </p>
      <div role="radiogroup" aria-labelledby="rs-lyric-font" class="grid grid-cols-3 gap-2">
        <button
          v-for="opt in READING_FONTS"
          :key="opt.value"
          type="button"
          role="radio"
          :aria-checked="readingFont === opt.value"
          class="font-tile"
          :class="{ 'font-tile--on': readingFont === opt.value }"
          @click="readingFont = opt.value"
        >
          <span aria-hidden="true" class="font-tile__sample" :style="{ fontFamily: opt.family }">Aa</span>
          <span class="font-tile__name">{{ opt.label }}</span>
        </button>
      </div>
      <p id="rs-app-font" class="pt-1 text-sm font-semibold">
        Menús y botones
      </p>
      <div role="radiogroup" aria-labelledby="rs-app-font" class="grid grid-cols-3 gap-2">
        <button
          v-for="opt in APP_FONTS"
          :key="opt.value"
          type="button"
          role="radio"
          :aria-checked="appFont === opt.value"
          class="font-tile"
          :class="{ 'font-tile--on': appFont === opt.value }"
          @click="appFont = opt.value"
        >
          <span aria-hidden="true" class="font-tile__sample" :style="{ fontFamily: opt.family }">Aa</span>
          <span class="font-tile__name">{{ opt.label }}</span>
        </button>
      </div>
    </section>

    <UButton
      v-if="!isDefault"
      color="neutral"
      variant="ghost"
      class="self-start"
      icon="i-tabler-restore"
      label="Restablecer la lectura"
      @click="reset"
    />
  </div>
</template>

<style scoped>
.rs-heading {
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ui-text-muted);
}
/* Choice tiles: the chosen one with the brand colour. */
.font-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  min-height: 4.75rem;
  padding: 0.5rem;
  border-radius: 0.875rem;
  box-shadow: inset 0 0 0 1px var(--ui-border);
  transition:
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}
.font-tile:hover {
  background: var(--ui-bg-elevated);
}
.font-tile:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}
.font-tile--on,
.font-tile--on:hover {
  background: color-mix(in oklab, var(--ui-primary) 10%, transparent);
  box-shadow: inset 0 0 0 2px var(--ui-primary);
}
.font-tile__sample {
  font-size: 1.625rem;
  font-weight: 600;
  line-height: 1;
  color: var(--ui-text-highlighted);
}
.font-tile__name {
  font-size: 0.75rem;
  color: var(--ui-text-toned);
}
</style>
