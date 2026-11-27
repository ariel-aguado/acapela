<script setup lang="ts">
import type { ItemScreens } from "~/composables/use-culto-screens";
import type { CultoItem, ReadingMode, ScreenLayout } from "~~/lib/culto";

import { ITEM_KIND_LABELS, SCREEN_LAYOUT_LABELS } from "~~/lib/culto";

// The fields of one element of the service, by kind. Every change is saved
// at once (the store writes to this device) and the screens re-flow.
const props = defineProps<{
  entry: ItemScreens;
}>();

const emit = defineEmits<{ (e: "remove"): void }>();

const culto = useCultoStore();
const bible = useBibleStore();
const songbook = useSongbookStore();
const { versions } = storeToRefs(bible);
const { manifest } = storeToRefs(songbook);

const item = computed(() => props.entry.item);

function set(changes: Partial<CultoItem>) {
  culto.updateItem(item.value.id, changes);
}

function field<K extends string>(key: K) {
  return computed({
    get: () => (item.value as Record<string, unknown>)[key] as string ?? "",
    set: (value: string) => set({ [key]: value } as Partial<CultoItem>),
  });
}

const eyebrow = field("eyebrow");
const title = field("title");
const reference = field("reference");
const body = field("body");
const notes = field("notes");

const songbookName = computed(() => {
  const it = item.value;
  return it.kind === "hymn"
    ? manifest.value.find(s => s.id === it.songbookId)?.name
    : undefined;
});

const songId = computed({
  get: () => item.value.kind === "hymn"
    ? item.value.songId
    : 0,
  set: (value: number) => {
    if (value >= 1) {
      set({
        songId: Math.round(value),
      });
    }
  },
});

const layoutItems = (Object.keys(SCREEN_LAYOUT_LABELS) as ScreenLayout[]).map(value => ({ label: SCREEN_LAYOUT_LABELS[value], value }));
const modeItems: { label: string; value: ReadingMode }[] = [
  { label: "Ajustar a la pantalla", value: "fit" },
  { label: "Un versículo por pantalla", value: "verse" },
];
const versionItems = computed(() => versions.value.map(v => ({ label: v.label, value: v.id })));

const scalePercent = computed({
  get: () => Math.round((item.value.scale ?? 1) * 100),
  set: (value: number) => set({ scale: Math.round(value) / 100 }),
});

onMounted(() => {
  if (!bible.loaded)
    bible.refresh();
});
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-xs font-bold uppercase tracking-wider opacity-70">
        {{ ITEM_KIND_LABELS[item.kind] }}
        <UBadge
          v-if="item.inserted"
          class="ms-2 normal-case tracking-normal"
          color="primary"
          variant="soft"
          label="Insertado en vivo"
        />
      </h2>
      <UButton
        color="error"
        variant="ghost"
        icon="i-tabler-trash"
        label="Quitar"
        @click="emit('remove')"
      />
    </div>

    <!-- Hymn -->
    <template v-if="item.kind === 'hymn'">
      <UFormField label="Número de himno" :help="songbookName">
        <UInputNumber
          v-model="songId"
          :min="1"
          size="lg"
          class="w-40"
        />
      </UFormField>
    </template>

    <!-- Reading -->
    <template v-else-if="item.kind === 'reading'">
      <div class="flex flex-wrap gap-3">
        <UFormField label="Cita" class="flex-1 min-w-48" help="Sal 46:1-7, jn 3:16, 1co13:4-7…">
          <UInput
            v-model="reference"
            size="lg"
            class="w-full"
            autocomplete="off"
          />
        </UFormField>
        <UFormField label="Versión" class="w-56">
          <USelect
            :model-value="item.versionId || bible.currentId"
            :items="versionItems"
            size="lg"
            class="w-full"
            @update:model-value="v => set({ versionId: String(v) })"
          />
        </UFormField>
      </div>
      <UFormField label="Cómo repartir">
        <URadioGroup
          :model-value="item.mode"
          :items="modeItems"
          orientation="horizontal"
          @update:model-value="v => set({ mode: v as ReadingMode })"
        />
      </UFormField>
    </template>

    <!-- Screen -->
    <template v-else>
      <UFormField label="Diseño">
        <URadioGroup
          :model-value="item.layout"
          :items="layoutItems"
          orientation="horizontal"
          variant="card"
          @update:model-value="v => set({ layout: v as ScreenLayout })"
        />
      </UFormField>
      <UFormField label="Etiqueta" help="Arriba, en letra pequeña: «Santa Cena», «Anuncios»…">
        <UInput v-model="eyebrow" size="lg" class="w-full" />
      </UFormField>
      <UFormField label="Título">
        <UTextarea
          v-model="title"
          :rows="2"
          autoresize
          size="lg"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Referencia o subtítulo">
        <UInput v-model="reference" size="lg" class="w-full" />
      </UFormField>
      <UFormField
        v-if="item.layout === 'text'"
        label="Texto"
        help="Si no cabe, sigue en otras pantallas. Una línea en blanco separa párrafos."
      >
        <UTextarea
          v-model="body"
          :rows="6"
          autoresize
          size="lg"
          class="w-full"
        />
      </UFormField>
    </template>

    <UFormField v-if="item.kind !== 'hymn'" :label="`Tamaño de letra · ${scalePercent} %`">
      <USlider
        v-model="scalePercent"
        :min="60"
        :max="150"
        :step="5"
      />
    </UFormField>

    <UFormField label="Notas para quien dirige" help="No se proyectan; se ven en la consola.">
      <UTextarea
        v-model="notes"
        :rows="2"
        autoresize
        class="w-full"
      />
    </UFormField>
  </div>
</template>
