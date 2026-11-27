<script lang="ts" setup>
import { VueDraggable } from "vue-draggable-plus";

import type { ItemScreens } from "~/composables/use-culto-screens";
import type { CultoItem } from "~~/lib/culto";

import { formatCultoDate, SCREEN_TEMPLATES } from "~/stores/culto";
import { importSlides, titleFromFiles } from "~/utils/culto/import-slides";
import { itemLook } from "~/utils/culto/moment";
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

function insertIndex() {
  const i = items.value.findIndex(item => item.id === selectedId.value);
  return i < 0
    ? items.value.length
    : i + 1;
}

function add(item: CultoItem) {
  culto.addItem(item, insertIndex());
  selectedId.value = item.id;
}

function addHymn(songId: number) {
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

function addReading() {
  add(culto.newReading("", bible.currentId));
}

const screenMenu = [
  SCREEN_TEMPLATES.map(t => ({
    label: t.label,
    icon: itemLook({ ...t.item, id: "" }).icon,
    onSelect: () => add(culto.newScreen(t.item)),
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

/** A row's title: a hymn's number is already on its tile. */
function rowTitle(entry: ItemScreens): string {
  const label = entry.label || looks.value.get(entry.item.id)?.label || "";
  return entry.item.kind === "hymn"
    ? label.replace(new RegExp(`^${entry.item.songId} · `), "")
    : label;
}

function reorder(list: ItemScreens[]) {
  culto.setOrder(list.map(e => e.item.id));
}

// Two ways to reorder (NN/g, WCAG 2.2 · 2.5.7): dragging by the handle, a
// shortcut for the mouse, and the arrows of the selected element, which
// need no dragging and work from the keyboard. Either way the new position
// is announced, and the arrows keep the focus so they can be pressed again.
const announcement = ref("");

/** An element as it is read aloud: «Himno 217, Maravillosa gracia», «Santa Cena: …». */
function spoken(entry: ItemScreens): string {
  const title = rowTitle(entry);
  const kind = looks.value.get(entry.item.id)?.label ?? "";
  if (entry.item.kind === "hymn")
    return `Himno ${entry.item.songId}, ${title}`;
  return kind && kind !== title
    ? `${kind}: ${title}`
    : title;
}

function announce(id: string) {
  const index = entries.value.findIndex(e => e.item.id === id);
  const entry = entries.value[index];
  if (entry)
    announcement.value = `${spoken(entry).replace(/[.\s]+$/, "")}. Posición ${index + 1} de ${entries.value.length}.`;
}

function onDragEnd(event: { newIndex?: number }) {
  nextTick(() => {
    const id = entries.value[event.newIndex ?? -1]?.item.id;
    if (id)
      announce(id);
  });
}

async function move(id: string, delta: number) {
  const index = items.value.findIndex(i => i.id === id);
  culto.moveItem(id, index + delta);
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
          <!-- Drag by the handle (as in SúperBiblia's screen manager); the
            arrows do the same from the keyboard. -->
          <VueDraggable
            :model-value="[...entries]"
            tag="ol"
            class="flex flex-col gap-1.5"
            handle=".drag-handle"
            :animation="150"
            :force-fallback="true"
            ghost-class="drag-ghost"
            chosen-class="drag-chosen"
            @end="onDragEnd"
            @update:model-value="reorder"
          >
            <li v-for="(entry, i) in entries" :key="entry.item.id">
              <div
                class="flex items-center gap-1 rounded-2xl border transition-colors"
                :class="entry.item.id === selectedId ? 'border-primary bg-primary/10' : 'border-transparent bg-default shadow-card hover:bg-muted'"
              >
                <!-- A mouse shortcut: the arrows do the same without dragging,
                  so assistive technology skips it. -->
                <span
                  class="drag-handle self-stretch flex items-center ps-2 cursor-grab touch-none opacity-50 hover:opacity-100"
                  aria-hidden="true"
                  title="Arrastrar para mover"
                >
                  <UIcon name="i-tabler-grip-vertical" class="size-5" />
                </span>
                <button
                  type="button"
                  class="flex-1 min-w-0 flex items-center gap-3 ps-1 py-2.5 text-start"
                  :aria-current="entry.item.id === selectedId ? 'true' : undefined"
                  @click="choose(entry.item.id)"
                >
                  <CultoMomentTile :item="entry.item" />
                  <span class="flex-1 min-w-0 flex flex-col">
                    <span class="font-semibold text-highlighted truncate">{{ rowTitle(entry) }}</span>
                    <span class="text-xs text-muted truncate">
                      <span class="font-semibold text-(--m-label)" :class="`moment--${looks.get(entry.item.id)?.tone}`">{{ looks.get(entry.item.id)?.label }}</span>
                      <template v-if="entry.status === 'ready'"> · {{ entry.screens.length }} {{ entry.screens.length === 1 ? 'pantalla' : 'pantallas' }}</template>
                      <template v-if="entry.item.inserted"> · insertado en vivo</template>
                    </span>
                  </span>
                  <UIcon
                    v-if="entry.status === 'error'"
                    name="i-tabler-alert-triangle"
                    class="size-5 text-warning shrink-0"
                    :aria-label="entry.error"
                  />
                  <UIcon
                    v-else-if="entry.status === 'loading'"
                    name="i-tabler-loader-2"
                    class="size-4 animate-spin opacity-60 shrink-0"
                    aria-label="Preparando"
                  />
                </button>
                <div v-if="entry.item.id === selectedId" class="flex flex-col pe-1">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    square
                    icon="i-tabler-chevron-up"
                    :disabled="i === 0"
                    :aria-label="`Subir: ${spoken(entry)}`"
                    :data-move-for="entry.item.id"
                    data-move="up"
                    @click="move(entry.item.id, -1)"
                  />
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    square
                    icon="i-tabler-chevron-down"
                    :disabled="i === entries.length - 1"
                    :aria-label="`Bajar: ${spoken(entry)}`"
                    :data-move-for="entry.item.id"
                    data-move="down"
                    @click="move(entry.item.id, 1)"
                  />
                </div>
              </div>
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
            Lo nuevo se agrega debajo del elemento elegido.
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
              <CultoScreenManager v-if="selected.all.length" :entry="selected" />
              <div v-else-if="selected.status === 'loading'" class="aspect-video rounded-xl bg-muted grid place-items-center">
                <UIcon name="i-tabler-loader-2" class="size-8 animate-spin opacity-60" aria-label="Preparando" />
              </div>
            </div>
            <div class="rounded-2xl p-4 bg-default shadow-card">
              <CultoItemEditor :key="selected.item.id" :entry="selected" @remove="removeItem(selected.item.id)" />
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
