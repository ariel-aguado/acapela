<script setup lang="ts">
import type { ItemScreens } from "~/composables/use-culto-screens";
import type { ImportProgress } from "~/utils/culto/import-slides";
import type { Background, CultoItem, FieldStyle, ReadingMode, ScreenLayout, ScreenMoment, ScreenTransition, TextAlign, TextField } from "~~/lib/culto";

import { GALLERY } from "~/utils/culto/backgrounds";
import { importSlides } from "~/utils/culto/import-slides";
import { importImage, mediaUrl } from "~/utils/culto/media";
import { itemLook, screenMoment } from "~/utils/culto/moment";
import { DEFAULT_TRANSITIONS, ITEM_KIND_LABELS, SCREEN_LAYOUT_LABELS, SCREEN_MOMENT_LABELS, TRANSITION_LABELS, TRANSITION_SPEED_LABELS } from "~~/lib/culto";

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
/** The texts' models, by field (refs inside an object stay refs in the template). */
const fieldModels = { eyebrow, title, reference, body };

const { sections } = storeToRefs(culto);
const sectionItems = computed(() => [
  { label: "Ninguna (suelto)", value: "none" },
  ...sections.value.map(s => ({ label: s.title, value: s.id })),
]);
/** A screen on its own can start a section, to add more to its moment. */
const canGroup = computed(() => item.value.kind === "screen" && !item.value.sectionId);

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

// How the text of a screen lines up; a title is centred unless chosen.
/** The texts of a screen, in the order they are shown. */
const textFields: { field: TextField; label: string; name: string; help?: string }[] = [
  {
    field: "eyebrow",
    label: "Etiqueta",
    name: "la etiqueta",
    help: "Arriba, en letra pequeña: «Santa Cena», «Anuncios»…",
  },
  { field: "title", label: "Título", name: "el título" },
  { field: "reference", label: "Referencia o subtítulo", name: "la referencia" },
  {
    field: "body",
    label: "Texto",
    name: "el texto",
    help: "Si no cabe, sigue en otras pantallas. Una línea en blanco separa párrafos.",
  },
];

const alignItems: { label: string; value: TextAlign; icon: string }[] = [
  { label: "Izquierda", value: "start", icon: "i-tabler-align-left" },
  { label: "Centro", value: "center", icon: "i-tabler-align-center" },
  { label: "Derecha", value: "end", icon: "i-tabler-align-right" },
];
const screenAlign = computed<TextAlign>(() => {
  const it = item.value;
  if (it.kind !== "screen")
    return "start";
  return it.align ?? (it.layout === "title"
    ? "center"
    : "start");
});

// The moment whose backgrounds the picker offers first: the section's, or
// the screen's own; readings have theirs.
const backgroundMoment = computed(() => {
  const it = item.value;
  const section = sections.value.find(s => s.id === it.sectionId);
  if (section)
    return { moment: section.moment, label: section.title };
  if (it.kind === "screen") {
    return {
      moment: screenMoment(it),
      label: itemLook(it).label,
    };
  }
  if (it.kind === "reading")
    return { moment: "reading" as const, label: "lecturas" };
  return null;
});

// Which moment a screen is: its icon and colour in the order.
const momentItems = (Object.keys(SCREEN_MOMENT_LABELS) as ScreenMoment[]).map(value => ({ label: SCREEN_MOMENT_LABELS[value], value }));
const moment = computed({
  get: () => item.value.kind === "screen"
    ? screenMoment(item.value)
    : "other",
  set: (value: ScreenMoment) => set({ moment: value }),
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

// ------------------------------------------------------------ styles
// Content first, then what changes how it looks (NN/g: proximity, forms in
// the order of the task, progressive disclosure): each text has its own
// style right under it, behind «Aa»; the whole screen's, the size and the
// background are in «Presentación», folded with a summary.

/** «de el título» → «del título». */
function ofName(name: string) {
  return name.startsWith("el ")
    ? `del ${name.slice(3)}`
    : `de ${name}`;
}

const openStyles = ref(new Set<TextField>());
function toggleStyle(field: TextField) {
  const next = new Set(openStyles.value);
  if (next.has(field))
    next.delete(field);
  else
    next.add(field);
  openStyles.value = next;
}
function styleOf(field: TextField): FieldStyle | undefined {
  return item.value.kind === "screen"
    ? item.value.styles?.[field]
    : undefined;
}
function setStyle(field: TextField, value: FieldStyle | undefined) {
  if (item.value.kind !== "screen")
    return;
  const styles = { ...item.value.styles };
  if (value)
    styles[field] = value;
  else
    delete styles[field];
  set({
    styles: Object.keys(styles).length
      ? styles
      : undefined,
  } as Partial<CultoItem>);
}

const presentationOpen = ref(false);
const backgroundName = computed(() => {
  const b = background.value;
  if (!b)
    return "Fondo del tema";
  if (b.kind === "acapela")
    return "La cruz al amanecer";
  if (b.kind === "gallery")
    return GALLERY.find(g => g.id === b.id)?.label ?? "Galería";
  return b.kind === "color"
    ? "Color"
    : "Imagen propia";
});
// Its own transition, entering it and between its screens; none: the theme's.
const themeTransitions = computed(() => useCultoStore().theme.transitions ?? DEFAULT_TRANSITIONS);
const transition = computed({
  get: () => item.value.transition,
  set: (value: ScreenTransition | undefined) => set({ transition: value } as Partial<CultoItem>),
});
const transitionName = computed(() => {
  const t = transition.value;
  if (!t)
    return "transición del tema";
  return t.kind === "cut"
    ? "corte"
    : `${TRANSITION_LABELS[t.kind].toLowerCase()} ${TRANSITION_SPEED_LABELS[t.speed].toLowerCase()}`;
});

const presentationSummary = computed(() => {
  if (item.value.kind === "slides")
    return transitionName.value;
  const parts = [backgroundName.value];
  if (item.value.kind !== "hymn")
    parts.push(`letra ${scalePercent.value} %`);
  if (item.value.kind === "screen" && (item.value.layout === "title" || item.value.layout === "quote" || item.value.layout === "text"))
    parts.push(alignItems.find(a => a.value === screenAlign.value)!.label.toLowerCase());
  parts.push(transitionName.value);
  return parts.join(" · ");
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
        <UFormField label="Cita" class="flex-1 min-w-64" help="Escríbela o elige libro, capítulo y versículos.">
          <CultoPassagePicker v-model="reference" :version-id="item.versionId" />
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
      <UFormField label="Momento" help="Su icono y su color en el orden del culto.">
        <USelect
          v-model="moment"
          :items="momentItems"
          size="lg"
          class="w-full sm:w-64"
        />
      </UFormField>
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
      <!-- What it says: each text with its own style right under it. -->
      <h3 class="-mb-2 border-t border-muted pt-4 text-xs font-bold uppercase tracking-wider opacity-70">
        Contenido
      </h3>
      <template v-for="f in textFields" :key="f.field">
        <UFormField
          v-if="f.field !== 'body' || item.layout === 'text'"
          :label="f.label"
          :help="f.help"
        >
          <template #hint>
            <UButton
              color="neutral"
              :variant="openStyles.has(f.field) ? 'soft' : 'ghost'"
              size="xs"
              class="relative font-semibold"
              :aria-expanded="openStyles.has(f.field)"
              :aria-label="`Estilo ${ofName(f.name)}${styleOf(f.field) ? ' (cambiado)' : ''}`"
              :title="`Alineación y tamaño ${ofName(f.name)}`"
              @click="toggleStyle(f.field)"
            >
              Aa
              <span v-if="styleOf(f.field)" class="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary" aria-hidden="true" />
            </UButton>
          </template>
          <div class="flex flex-col gap-2">
            <UTextarea
              v-if="f.field === 'title' || f.field === 'body'"
              v-model="fieldModels[f.field].value"
              :rows="f.field === 'title' ? 2 : 6"
              autoresize
              size="lg"
              class="w-full"
            />
            <UInput
              v-else
              v-model="fieldModels[f.field].value"
              size="lg"
              class="w-full"
            />
            <CultoFieldStyle
              v-if="openStyles.has(f.field)"
              :model-value="styleOf(f.field)"
              :name="f.name"
              :inherited-align="screenAlign"
              @update:model-value="v => setStyle(f.field, v)"
            />
          </div>
        </UFormField>
      </template>
    </template>

    <!-- How it looks: folded, with a summary. -->
    <UCollapsible v-model:open="presentationOpen" class="flex flex-col border-t border-muted pt-3">
      <UButton
        color="neutral"
        variant="ghost"
        class="-mx-2 justify-between text-start"
        :trailing-icon="presentationOpen ? 'i-tabler-chevron-up' : 'i-tabler-chevron-down'"
      >
        <span class="flex min-w-0 flex-col items-start">
          <span class="text-xs font-bold uppercase tracking-wider opacity-70">Presentación</span>
          <span class="text-sm font-normal text-muted text-pretty">{{ presentationSummary }}</span>
        </span>
      </UButton>
      <template #content>
        <div class="flex flex-col gap-5 pt-3 pb-1">
          <UFormField
            v-if="item.kind === 'screen' && (item.layout === 'title' || item.layout === 'quote' || item.layout === 'text')"
            label="Alineación de toda la pantalla"
            help="Cada texto puede tener la suya con «Aa»."
          >
            <UFieldGroup role="radiogroup" aria-label="Alineación de toda la pantalla">
              <UButton
                v-for="a in alignItems"
                :key="a.value"
                color="neutral"
                :variant="screenAlign === a.value ? 'solid' : 'outline'"
                size="lg"
                :icon="a.icon"
                :label="a.label"
                role="radio"
                :aria-checked="screenAlign === a.value"
                @click="set({ align: a.value })"
              />
            </UFieldGroup>
          </UFormField>
          <UFormField v-if="item.kind !== 'hymn'" :label="`Tamaño de letra · ${scalePercent} %`">
            <USlider
              v-model="scalePercent"
              :min="60"
              :max="150"
              :step="5"
            />
          </UFormField>
          <UFormField v-if="item.kind !== 'slides'" label="Fondo">
            <CultoBackgroundPicker
              v-model="background"
              inherit
              :moment="backgroundMoment?.moment"
              :moment-label="backgroundMoment?.label"
            />
          </UFormField>
          <UFormField label="Transición" help="Al entrar a este elemento y entre sus pantallas.">
            <CultoTransitionPicker
              v-model="transition"
              inherit
              :inherited="themeTransitions.element"
              label="Transición de este elemento"
            />
          </UFormField>
        </div>
      </template>
    </UCollapsible>

    <!-- The section it belongs to (the Lord's supper, the offering…). -->
    <UFormField
      v-if="sectionItems.length > 1 || canGroup"
      label="Sección"
      help="Una sección junta pantallas, citas e himnos de un momento del culto, y se mueven juntos."
    >
      <div class="flex flex-wrap items-center gap-2">
        <USelect
          v-if="sectionItems.length > 1"
          :model-value="item.sectionId ?? 'none'"
          :items="sectionItems"
          size="lg"
          class="w-full sm:w-64"
          @update:model-value="v => culto.setItemSection(item.id, v === 'none' ? undefined : String(v))"
        />
        <UButton
          v-if="canGroup"
          color="neutral"
          variant="outline"
          icon="i-tabler-stack-2"
          label="Agrupar en una sección"
          @click="culto.groupInSection(item.id)"
        />
      </div>
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
