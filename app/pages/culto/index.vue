<script lang="ts" setup>
import { VueDraggable } from "vue-draggable-plus";

import type { ItemScreens } from "~/composables/use-culto-screens";
import type { CultoItem, CultoSection, ScreenItem } from "~~/lib/culto";

import { formatCultoDate, SCREEN_TEMPLATES } from "~/stores/culto";
import { importSlides, titleFromFiles } from "~/utils/culto/import-slides";
import { itemLook, momentTone, spokenLabel } from "~/utils/culto/moment";
import { blocksOf } from "~/utils/culto/sections";
import { exportCulto, importCulto, shareOrDownload } from "~/utils/culto/transfer";

// Preparing a service: its order (hymns, readings, screens), each element's
// fields and a preview of the screens it becomes. Works the same on a phone
// and on a computer; "Iniciar culto" opens the live console.
useHead({ title: "Culto" });

const culto = useCultoStore();
const songStore = useSongStore();
const songbook = useSongbookStore();
const bible = useBibleStore();
const { current, sorted } = storeToRefs(culto);
const { show: toast } = useUndoToast();

const items = computed<CultoItem[]>(() => current.value?.items ?? []);
const { entries } = useCultoScreens(items);

const selectedId = ref<string | null>(null);
const selected = computed(() => entries.value.find(e => e.item.id === selectedId.value) ?? null);
/** The element after the chosen one, for the stage's «Siguiente». */
const nextEntry = computed(() => {
  const at = entries.value.findIndex(e => e.item.id === selectedId.value);
  return at >= 0
    ? entries.value[at + 1] ?? null
    : null;
});

watch(items, (list) => {
  if (!list.some(i => i.id === selectedId.value))
    selectedId.value = list[0]?.id ?? null;
}, { immediate: true });

// On a phone the editor is below the list: bring it into view.
const isLarge = useMediaQuery("(min-width: 1024px)");
async function choose(id: string) {
  selectedId.value = id;
  if (!isLarge.value) {
    await nextTick();
    document.getElementById("c-selected")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

const totalScreens = computed(() => entries.value.reduce((n, e) => n + e.screens.length, 0));

// ------------------------------------------------------------ the service

const cultoItems = computed(() => sorted.value.map(c => ({
  label: `${c.title} · ${formatCultoDate(c.date)}`,
  value: c.id,
})));

const titleModel = computed({
  get: () => current.value?.title ?? "",
  set: (title: string) => culto.patch({ title }),
});
const dateModel = computed({
  get: () => current.value?.date ?? "",
  set: (date: string) => {
    if (date)
      culto.patch({ date });
  },
});

function removeCulto() {
  const target = current.value;
  if (!target)
    return;
  const copy = structuredClone(toRaw(target));
  culto.remove(target.id);
  toast(`Se borró «${copy.title}».`, {
    label: "Deshacer",
    run: () => {
      culto.cultos = [...culto.cultos, copy];
      culto.select(copy.id);
    },
  });
}

const showTheme = ref(false);

// ------------------------------------------------------------ another device
// A file with the service, its theme and images (utils/culto/transfer.ts).

const importInput = useTemplateRef<HTMLInputElement>("importFile");

async function exportCurrent() {
  if (!current.value)
    return;
  const file = await exportCulto(toRaw(current.value), toRaw(culto.theme));
  const how = await shareOrDownload(file);
  if (how === "downloaded")
    toast(`Se descargó «${file.name}». Ábrelo en el otro dispositivo desde ⋯ › Abrir un culto recibido.`, undefined, 8000);
}

async function onImportFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = "";
  if (!file)
    return;
  try {
    const { culto: received, theme } = await importCulto(file);
    culto.cultos = [...culto.cultos, received];
    culto.select(received.id);
    // The sender's theme, only if this device has none of its own yet.
    const own = culto.theme;
    if (theme && !own.churchName && !own.logoId && own.background.kind === "acapela")
      culto.setTheme(theme);
    toast(`Se abrió «${received.title}».`);
  }
  catch (err) {
    toast(err instanceof Error
      ? err.message
      : String(err), undefined, 8000);
  }
}

const cultoMenu = computed(() => [
  [
    {
      label: "Tema de la iglesia…",
      icon: "i-tabler-palette",
      onSelect: () => (showTheme.value = true),
    },
  ],
  [
    {
      label: "Nuevo culto",
      icon: "i-tabler-plus",
      onSelect: () => culto.create(),
    },
    {
      label: "Duplicar para otro día",
      icon: "i-tabler-copy",
      onSelect: () => current.value && culto.duplicate(current.value.id),
    },
  ],
  [
    {
      label: "Enviar a otro dispositivo",
      icon: "i-tabler-share",
      onSelect: exportCurrent,
    },
    {
      label: "Abrir un culto recibido…",
      icon: "i-tabler-file-import",
      onSelect: () => importInput.value?.click(),
    },
  ],
  [
    {
      label: "Borrar este culto",
      icon: "i-tabler-trash",
      color: "error" as const,
      onSelect: removeCulto,
    },
  ],
]);

// ------------------------------------------------------------ adding

const pickHymn = ref(false);
/** The section a hymn being picked goes to (its «Añadir a…»). */
const hymnSection = ref<string | null>(null);
const { sections } = storeToRefs(culto);

// Anything new goes last in the order (a section's own «Añadir a…» puts it
// last in the section), and is chosen so it can be filled in.
function add(item: CultoItem) {
  culto.addItem(item);
  selectedId.value = item.id;
}

function addHymn(songId: number) {
  const section = sections.value.find(s => s.id === hymnSection.value);
  hymnSection.value = null;
  if (section)
    addIn(section, culto.newHymn(songbook.currentId, songId));
  else
    add(culto.newHymn(songbook.currentId, songId));
}

// Slides from a PDF or images: chosen first, then imported as a new element.
const slidesInput = useTemplateRef<HTMLInputElement>("slidesFile");
const importing = ref<string | null>(null);
async function onSlidesFiles(e: Event) {
  const files = [
    ...(e.target as HTMLInputElement).files ?? [],
  ];
  (e.target as HTMLInputElement).value = "";
  if (!files.length)
    return;
  importing.value = `Preparando ${files[0]!.name}…`;
  try {
    const ids = await importSlides(files, (p) => {
      importing.value = `Preparando ${p.name}: ${p.done} de ${p.total}…`;
    });
    if (ids.length)
      add(culto.newSlides(titleFromFiles(files), ids));
  }
  catch (err) {
    toast(`No se pudo leer el archivo: ${err instanceof Error
      ? err.message
      : String(err)}`, undefined, 8000);
  }
  finally {
    importing.value = null;
  }
}

const SECTION_MOMENTS = new Set<string>(["supper", "offering", "sermon"]);

/** A section with its title screen, last in the order. */
function addSection(title: string, template: Omit<ScreenItem, "id">) {
  const screen = culto.newScreen(template);
  culto.createSection(template.moment ?? "other", title, [screen]);
  selectedId.value = screen.id;
}

function addReading() {
  add(culto.newReading("", bible.currentId));
}

const screenMenu = [
  SCREEN_TEMPLATES.map(t => ({
    label: t.label,
    icon: itemLook({ ...t.item, id: "" }).icon,
    // The central moments come as a section, ready for their passages.
    onSelect: () => SECTION_MOMENTS.has(t.item.moment ?? "other")
      ? addSection(t.label, t.item)
      : add(culto.newScreen(t.item)),
  })),
  [
    {
      label: "Pantalla en blanco",
      icon: "i-tabler-file",
      onSelect: () => add(culto.newScreen()),
    },
  ],
];

function removeItem(id: string) {
  const index = items.value.findIndex(i => i.id === id);
  const item = items.value[index];
  if (!item)
    return;
  culto.removeItem(id);
  toast("Se quitó el elemento.", {
    label: "Deshacer",
    run: () => {
      culto.addItem(item, index);
      selectedId.value = item.id;
    },
  });
}

/** Each element's family and label, for its row and the service's map. */
const looks = computed(() => new Map(items.value.map(i => [
  i.id,
  itemLook(i),
])));
const hymnCount = computed(() => items.value.filter(i => i.kind === "hymn").length);

// ------------------------------------------------------------ order, with sections
// The order in blocks: an element on its own, or a section (the Lord's
// supper, the offering, the sermon…) with its elements, which move with it.
// Two levels of dragging: blocks in the order (by their handle), and the
// elements of a section inside it or into another one. The arrows of the
// chosen element do the same without dragging (NN/g, WCAG 2.2 · 2.5.7); at
// a section's edge they take it out. Every move is announced.

type DragBlock
  = | { key: string; kind: "item"; entry: ItemScreens }
    | { key: string; kind: "section"; section: CultoSection; items: ItemScreens[] };

const dragBlocks = ref<DragBlock[]>([]);
watch([entries, sections], () => {
  const byId = new Map(entries.value.map(e => [e.item.id, e]));
  dragBlocks.value = blocksOf(items.value, sections.value).map(b => b.kind === "item"
    ? {
        key: b.item.id,
        kind: "item" as const,
        entry: byId.get(b.item.id)!,
      }
    : {
        key: `s:${b.section.id}`,
        kind: "section" as const,
        section: b.section,
        items: b.items.map(i => byId.get(i.id)!),
      }).filter(b => b.kind === "section" || b.entry);
}, { immediate: true });

/** Where everything is, in order: the first and last can't go further. */
const flatIds = computed(() => dragBlocks.value.flatMap(b => b.kind === "item"
  ? [b.entry.item.id]
  : b.items.map(e => e.item.id)));

const announcement = ref("");
function announce(id: string) {
  const index = entries.value.findIndex(e => e.item.id === id);
  const entry = entries.value[index];
  if (!entry)
    return;
  const section = sections.value.find(s => s.id === entry.item.sectionId);
  announcement.value = `${spokenLabel(entry).replace(/[.\s]+$/, "")}. Posición ${index + 1} de ${entries.value.length}${section
    ? `, en ${section.title}`
    : ""}.`;
}

/** After dragging: the new order and sections, as they are on screen. */
function commitDrag(event?: { item?: HTMLElement }) {
  culto.setLayout(dragBlocks.value.flatMap(b => b.kind === "item"
    ? [
        { id: b.entry.item.id },
      ]
    : b.items.map(e => ({ id: e.item.id, sectionId: b.section.id }))));
  const id = event?.item?.dataset.itemId;
  if (id)
    nextTick(() => announce(id));
}

async function step(id: string, delta: -1 | 1) {
  culto.stepItemInOrder(id, delta);
  await nextTick();
  announce(id);
  const here = delta < 0
    ? "up"
    : "down";
  const there = delta < 0
    ? "down"
    : "up";
  const button = document.querySelector<HTMLButtonElement>(`[data-move-for="${id}"][data-move="${here}"]:not(:disabled)`)
    ?? document.querySelector<HTMLButtonElement>(`[data-move-for="${id}"][data-move="${there}"]`);
  button?.focus();
}

// ------------------------------------------------------------ a chosen section

const selectedSectionId = ref<string | null>(null);
const selectedSection = computed(() => sections.value.find(s => s.id === selectedSectionId.value) ?? null);
watch(selectedId, () => {
  selectedSectionId.value = null;
});

function chooseSection(section: CultoSection) {
  const first = items.value.find(i => i.sectionId === section.id);
  if (first)
    selectedId.value = first.id;
  nextTick(() => {
    selectedSectionId.value = section.id;
  });
}

async function stepSection(id: string, delta: -1 | 1) {
  culto.stepSectionInOrder(id, delta);
  await nextTick();
  const section = sections.value.find(s => s.id === id);
  const at = dragBlocks.value.findIndex(b => b.kind === "section" && b.section.id === id);
  if (section)
    announcement.value = `${section.title}. Lugar ${at + 1} de ${dragBlocks.value.length} en el orden.`;
  document.querySelector<HTMLButtonElement>(`[data-section-move="${id}"][data-move="${delta < 0
    ? "up"
    : "down"}"]:not(:disabled)`)?.focus();
}

/** What can be added to a section: a screen of its moment, a passage, a hymn. */
function sectionMenu(section: CultoSection) {
  return [
    [
      {
        label: "Pantalla",
        icon: "i-tabler-presentation",
        onSelect: () => addIn(section, culto.newScreen(undefined, { moment: section.moment, layout: "title", eyebrow: section.title })),
      },
      {
        label: "Cita bíblica",
        icon: "i-tabler-book",
        onSelect: () => addIn(section, culto.newReading("", bible.currentId)),
      },
      {
        label: "Himno",
        icon: "i-tabler-music",
        onSelect: () => {
          hymnSection.value = section.id;
          pickHymn.value = true;
        },
      },
    ],
  ];
}

function addIn(section: CultoSection, item: CultoItem) {
  culto.addToSection(section.id, item);
  selectedId.value = item.id;
}

function removeSection(section: CultoSection) {
  const saved = culto.removeSection(section.id);
  if (!saved)
    return;
  toast(`Se quitó «${section.title}» con sus elementos.`, {
    label: "Deshacer",
    run: () => culto.restoreSection(saved),
  });
}

onMounted(() => {
  culto.ensureCurrent();
  songStore.getSongs();
  if (!bible.loaded)
    bible.refresh();
});
</script>

<template>
  <div class="page-scroll">
    <div class="w-full max-w-7xl mx-auto px-4 py-4 flex flex-col gap-5">
      <!-- The service -->
      <header class="flex flex-wrap items-start gap-3">
        <div class="flex-1 min-w-64 flex flex-col gap-2">
          <USelect
            v-if="sorted.length > 1"
            :model-value="current?.id"
            :items="cultoItems"
            variant="ghost"
            class="w-fit max-w-full -ms-2"
            aria-label="Elegir otro culto"
            @update:model-value="v => culto.select(String(v))"
          />
          <div class="flex flex-wrap gap-2">
            <UInput
              v-model="titleModel"
              size="xl"
              class="flex-1 min-w-56"
              :ui="{ base: 'text-lg font-semibold' }"
              aria-label="Nombre del culto"
            />
            <UInput
              v-model="dateModel"
              type="date"
              size="xl"
              aria-label="Fecha"
            />
          </div>
          <p class="text-sm opacity-70">
            {{ items.length }} {{ items.length === 1 ? 'elemento' : 'elementos' }} · {{ totalScreens }} pantallas
          </p>
        </div>
        <div class="flex items-center gap-2 sm:pt-0.5">
          <UDropdownMenu :items="cultoMenu">
            <UButton
              color="neutral"
              variant="outline"
              size="xl"
              icon="i-tabler-dots"
              aria-label="Más opciones del culto"
            />
          </UDropdownMenu>
          <UButton
            to="/culto/vivo"
            size="xl"
            icon="i-tabler-player-play-filled"
            label="Iniciar culto"
            :disabled="!totalScreens"
          />
        </div>
      </header>

      <div class="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)] items-start">
        <!-- Order -->
        <section class="flex flex-col gap-3" aria-labelledby="c-order">
          <div class="flex flex-col gap-2.5">
            <div class="flex items-baseline justify-between gap-2">
              <h2 id="c-order" class="text-xs font-bold uppercase tracking-wider opacity-70">
                Orden del culto
              </h2>
              <span v-if="items.length" class="text-xs text-muted tabular-nums">
                {{ items.length }} {{ items.length === 1 ? 'elemento' : 'elementos' }}<template v-if="hymnCount"> · {{ hymnCount }} {{ hymnCount === 1 ? 'himno' : 'himnos' }}</template>
              </span>
            </div>
            <!-- The service at a glance: one segment per element, in order,
              in the colour of its family. -->
            <div
              v-if="items.length > 1"
              class="flex gap-[3px] h-2"
              role="img"
              :aria-label="`Mapa del culto: ${entries.map(e => looks.get(e.item.id)?.label).join(', ')}`"
            >
              <button
                v-for="entry in entries"
                :key="`map-${entry.item.id}`"
                type="button"
                tabindex="-1"
                class="flex-1 rounded-full bg-(--m-seg) transition-transform hover:scale-y-150"
                :class="[`moment--${looks.get(entry.item.id)?.tone}`, { 'outline-2 outline-offset-2 outline-primary': entry.item.id === selectedId }]"
                :title="entry.label"
                @click="choose(entry.item.id)"
              />
            </div>
          </div>
          <p v-if="!items.length" class="text-sm opacity-70">
            Todavía no hay nada. Empieza por un himno o una pantalla de bienvenida.
          </p>
          <!-- Blocks: an element on its own or a section with its elements.
            Each level is dragged by its own handle. -->
          <VueDraggable
            v-model="dragBlocks"
            tag="ol"
            class="flex flex-col gap-1.5"
            handle=".block-handle"
            group="blocks"
            :animation="150"
            :force-fallback="true"
            ghost-class="drag-ghost"
            chosen-class="drag-chosen"
            @end="commitDrag"
          >
            <li
              v-for="block in dragBlocks"
              :key="block.key"
              :data-item-id="block.kind === 'item' ? block.entry.item.id : undefined"
            >
              <CultoOrderRow
                v-if="block.kind === 'item'"
                :entry="block.entry"
                :selected="block.entry.item.id === selectedId && !selectedSection"
                :can-up="flatIds[0] !== block.entry.item.id"
                :can-down="flatIds.at(-1) !== block.entry.item.id"
                handle="block-handle"
                @choose="choose(block.entry.item.id)"
                @step="d => step(block.entry.item.id, d)"
              />
              <!-- A section: its elements in one container, in its colour. -->
              <section
                v-else
                class="section-box flex flex-col gap-1.5 rounded-3xl p-1.5"
                :class="[`moment--${momentTone(block.section.moment)}`, { 'section-box--on': selectedSectionId === block.section.id }]"
                :aria-label="`Sección ${block.section.title}`"
              >
                <div class="flex items-center gap-1 ps-0.5 pe-1">
                  <span class="block-handle self-stretch flex items-center ps-1.5 cursor-grab touch-none opacity-50 hover:opacity-100" aria-hidden="true" title="Arrastrar la sección">
                    <UIcon name="i-tabler-grip-vertical" class="size-5" />
                  </span>
                  <button
                    type="button"
                    class="flex-1 min-w-0 flex items-baseline gap-2 py-1.5 ps-1 text-start"
                    :aria-current="selectedSectionId === block.section.id ? 'true' : undefined"
                    @click="chooseSection(block.section)"
                  >
                    <span class="text-sm font-bold uppercase tracking-wider text-(--m-label) truncate">{{ block.section.title }}</span>
                    <span class="text-xs text-muted shrink-0">{{ block.items.length }} {{ block.items.length === 1 ? 'elemento' : 'elementos' }}</span>
                  </button>
                  <template v-if="selectedSectionId === block.section.id">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      square
                      icon="i-tabler-chevron-up"
                      :disabled="dragBlocks[0] === block"
                      :aria-label="`Subir la sección ${block.section.title}`"
                      :data-section-move="block.section.id"
                      data-move="up"
                      @click="stepSection(block.section.id, -1)"
                    />
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      square
                      icon="i-tabler-chevron-down"
                      :disabled="dragBlocks.at(-1) === block"
                      :aria-label="`Bajar la sección ${block.section.title}`"
                      :data-section-move="block.section.id"
                      data-move="down"
                      @click="stepSection(block.section.id, 1)"
                    />
                  </template>
                </div>
                <VueDraggable
                  v-model="block.items"
                  tag="ol"
                  class="flex flex-col gap-1.5 min-h-2"
                  handle=".item-handle"
                  group="items"
                  :animation="150"
                  :force-fallback="true"
                  ghost-class="drag-ghost"
                  chosen-class="drag-chosen"
                  @end="commitDrag"
                >
                  <li v-for="entry in block.items" :key="entry.item.id" :data-item-id="entry.item.id">
                    <CultoOrderRow
                      :entry="entry"
                      :selected="entry.item.id === selectedId && !selectedSection"
                      :can-up="true"
                      :can-down="true"
                      handle="item-handle"
                      @choose="choose(entry.item.id)"
                      @step="d => step(entry.item.id, d)"
                    />
                  </li>
                </VueDraggable>
                <UDropdownMenu :items="sectionMenu(block.section)">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    icon="i-tabler-plus"
                    class="self-start text-(--m-label)"
                    :label="`Añadir a ${block.section.title}`"
                  />
                </UDropdownMenu>
              </section>
            </li>
          </VueDraggable>
          <p class="sr-only" aria-live="polite">
            {{ announcement }}
          </p>
          <div class="flex flex-wrap gap-2">
            <UButton
              color="neutral"
              variant="outline"
              icon="i-tabler-music"
              label="Himno"
              @click="pickHymn = true"
            />
            <UButton
              color="neutral"
              variant="outline"
              icon="i-tabler-book"
              label="Lectura"
              @click="addReading"
            />
            <UDropdownMenu :items="screenMenu">
              <UButton
                color="neutral"
                variant="outline"
                icon="i-tabler-presentation"
                label="Pantalla"
                trailing-icon="i-tabler-chevron-down"
              />
            </UDropdownMenu>
            <UButton
              color="neutral"
              variant="outline"
              icon="i-tabler-slideshow"
              label="Diapositivas"
              :loading="!!importing"
              @click="slidesInput?.click()"
            />
            <input
              ref="slidesFile"
              type="file"
              accept="application/pdf,image/*"
              multiple
              class="hidden"
              @change="onSlidesFiles"
            >
          </div>
          <p class="text-xs opacity-60">
            Lo nuevo se agrega al final del orden.
          </p>
          <p v-if="importing" class="text-xs opacity-80">
            {{ importing }}
          </p>
        </section>

        <!-- Selected element -->
        <section
          v-if="selected"
          id="c-selected"
          class="flex flex-col gap-5 min-w-0 scroll-mt-20"
          aria-label="Elemento elegido"
        >
          <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] items-start">
            <div class="flex flex-col gap-3 min-w-0">
              <p v-if="selected.status === 'error'" class="rounded-2xl bg-warning/10 text-warning px-4 py-3 text-sm font-medium">
                {{ selected.error }}
              </p>
              <CultoScreenManager
                v-if="selected.all.length"
                :entry="selected"
                :next="nextEntry"
                @next="nextEntry && choose(nextEntry.item.id)"
              />
              <div v-else-if="selected.status === 'loading'" class="aspect-video rounded-xl bg-muted grid place-items-center">
                <UIcon name="i-tabler-loader-2" class="size-8 animate-spin opacity-60" aria-label="Preparando" />
              </div>
            </div>
            <div class="rounded-2xl p-4 bg-default shadow-card">
              <CultoSectionEditor
                v-if="selectedSection"
                :key="selectedSection.id"
                :section="selectedSection"
                @remove="removeSection(selectedSection)"
              />
              <CultoItemEditor
                v-else
                :key="selected.item.id"
                :entry="selected"
                @remove="removeItem(selected.item.id)"
              />
            </div>
          </div>
        </section>
      </div>
    </div>

    <CultoThemeDialog v-model:open="showTheme" />
    <input
      ref="importFile"
      type="file"
      accept=".json,application/json"
      class="hidden"
      @change="onImportFile"
    >
    <AppGoToHymn
      v-model:open="pickHymn"
      heading="Agregar un himno"
      action-label="Agregar"
      @go="addHymn"
    />
  </div>
</template>

<style>
/* A section of the service: its elements on a tint of its family. */
.section-box {
  background: color-mix(in oklab, var(--m-seg) 12%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--m-seg) 30%, transparent);
}
.section-box--on {
  box-shadow: inset 0 0 0 1.5px var(--ui-primary);
}

/* Dragging, here and in the screen manager. */
.drag-ghost {
  opacity: 0.35;
}
.drag-chosen {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
  border-radius: 1rem;
}
</style>
