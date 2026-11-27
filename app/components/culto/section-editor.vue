<script lang="ts" setup>
import type { CultoSection, ScreenMoment } from "~~/lib/culto";

import { SCREEN_MOMENT_LABELS } from "~~/lib/culto";

// A section of the service (the Lord's supper, the offering, the sermon…):
// its name in the order and its moment (its colour). It can be undone, its
// elements staying on their own, or removed with them.
const props = defineProps<{ section: CultoSection }>();
const emit = defineEmits<{ remove: [] }>();

const culto = useCultoStore();
const momentItems = (Object.keys(SCREEN_MOMENT_LABELS) as ScreenMoment[])
  .map(value => ({
    label: value === "other"
      ? "Otro"
      : SCREEN_MOMENT_LABELS[value],
    value,
  }));

const title = computed({
  get: () => props.section.title,
  set: (value: string) => culto.updateSection(props.section.id, { title: value }),
});
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-xs font-bold uppercase tracking-wider opacity-70">
        Sección
      </h2>
      <UButton
        color="error"
        variant="ghost"
        size="sm"
        icon="i-tabler-trash"
        label="Quitar con sus elementos"
        @click="emit('remove')"
      />
    </div>
    <UFormField label="Nombre" help="Para reconocerla en el orden; no se proyecta.">
      <UInput v-model="title" size="lg" class="w-full" />
    </UFormField>
    <UFormField label="Momento" help="Su color en el orden del culto.">
      <USelect
        :model-value="section.moment"
        :items="momentItems"
        size="lg"
        class="w-full sm:w-64"
        @update:model-value="v => culto.updateSection(section.id, { moment: v as ScreenMoment })"
      />
    </UFormField>
    <p class="text-sm text-muted">
      Para añadirle una pantalla, una cita bíblica o un himno, usa «Añadir a {{ section.title }}» al pie de la sección.
    </p>
    <UButton
      color="neutral"
      variant="outline"
      icon="i-tabler-layout-list"
      label="Deshacer la sección"
      class="self-start"
      @click="culto.dissolveSection(section.id)"
    />
    <p class="-mt-3 text-xs text-muted">
      Sus elementos quedan en el orden, sueltos.
    </p>
  </div>
</template>
