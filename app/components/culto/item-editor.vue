<script setup lang="ts">
import type { ItemScreens } from "~/composables/use-culto-screens";
import type { ImportProgress } from "~/utils/culto/import-slides";
import type { Background, CultoItem, ReadingMode, ScreenLayout } from "~~/lib/culto";

import { importSlides } from "~/utils/culto/import-slides";
import { importImage, mediaUrl } from "~/utils/culto/media";
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

const songbookItems = computed(() => manifest.value.map(sb => ({ label: sb.name, value: sb.id })));

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

const background = computed({
  get: () => item.value.background,
  set: (value: Background | undefined) => set({ background: value }),
});

// Image layout: the picture.
const imageInput = useTemplateRef<HTMLInputElement>("image");
const imageUrl = ref<string | null>(null);
watchEffect(async () => {
  const it = item.value;
  imageUrl.value = it.kind === "screen" && it.mediaId
    ? await mediaUrl(it.mediaId)
    : null;
});
async function onImage(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = "";
  if (file)
    set({ mediaId: await importImage(file, file.name) });
}

// Slides: more pages from a PDF or images, after the ones it has.
const pagesInput = useTemplateRef<HTMLInputElement>("pages");
const importing = ref<ImportProgress | null>(null);
const importError = ref("");
async function onPages(e: Event) {
  const files = [
    ...(e.target as HTMLInputElement).files ?? [],
  ];
  (e.target as HTMLInputElement).value = "";
  const it = item.value;
  if (!files.length || it.kind !== "slides")
    return;
  importError.value = "";
  importing.value = { done: 0, total: files.length, name: files[0]!.name };
  try {
    const ids = await importSlides(files, (p) => {
      importing.value = p;
    });
    set({
      pages: [
        ...it.pages,
        ...ids,
      ],
    });
  }
  catch (err) {
    importError.value = `No se pudo leer el archivo: ${err instanceof Error
      ? err.message
      : String(err)}`;
  }
  finally {
    importing.value = null;
  }
}

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
      <div class="flex flex-wrap gap-3">
        <UFormField label="Número de himno">
          <UInputNumber
            v-model="songId"
            :min="1"
            size="lg"
            class="w-40"
          />
        </UFormField>
        <UFormField label="Himnario" help="Puede ser otro que el elegido en Ajustes.">
          <USelect
            :model-value="item.songbookId"
            :items="songbookItems"
            size="lg"
            class="w-56"
            @update:model-value="v => set({ songbookId: String(v) })"
          />
        </UFormField>
      </div>
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

    <!-- Slides -->
    <template v-else-if="item.kind === 'slides'">
      <UFormField label="Nombre" help="Para reconocerlas en el orden; no se proyecta.">
        <UInput v-model="title" size="lg" class="w-full" />
      </UFormField>
      <div class="flex flex-col gap-2">
        <span class="text-sm">{{ item.pages.length }} {{ item.pages.length === 1 ? 'diapositiva' : 'diapositivas' }}</span>
        <UButton
          color="neutral"
          variant="outline"
          icon="i-tabler-file-plus"
          label="Agregar PDF o imágenes"
          class="self-start"
          :loading="!!importing"
          @click="pagesInput?.click()"
        />
        <p v-if="importing" class="text-xs opacity-70">
          Preparando {{ importing.name }}: {{ importing.done }} de {{ importing.total }}…
        </p>
        <p v-if="importError" class="text-xs text-error">
          {{ importError }}
        </p>
        <p class="text-xs opacity-70">
          De PowerPoint, Keynote o Google Slides: expórtalas como PDF. Para quitar una, ocúltala en la lista de pantallas.
        </p>
        <input
          ref="pages"
          type="file"
          accept="application/pdf,image/*"
          multiple
          class="hidden"
          @change="onPages"
        >
      </div>
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
      <UFormField v-if="item.layout === 'image'" label="Imagen" help="Un afiche, una foto: se muestra entera.">
        <div class="flex items-center gap-3">
          <img
            v-if="imageUrl"
            :src="imageUrl"
            alt=""
            class="h-16 aspect-video object-contain rounded-lg ring-1 ring-default bg-muted"
          >
          <UButton
            color="neutral"
            variant="outline"
            icon="i-tabler-photo"
            :label="item.mediaId ? 'Cambiar imagen' : 'Elegir imagen'"
            @click="imageInput?.click()"
          />
        </div>
        <input
          ref="image"
          type="file"
          accept="image/*"
          class="hidden"
          @change="onImage"
        >
      </UFormField>
      <p v-if="item.layout === 'logo'" class="text-sm opacity-75">
        El logo y el nombre son los del tema de la iglesia (en el menú ⋯ del culto).
      </p>
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

    <UFormField v-if="item.kind !== 'slides'" label="Fondo">
      <CultoBackgroundPicker v-model="background" inherit />
    </UFormField>

    <UFormField v-if="item.kind !== 'hymn' && item.kind !== 'slides'" :label="`Tamaño de letra · ${scalePercent} %`">
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
