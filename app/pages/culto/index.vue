<script lang="ts" setup>
import type { DateValue, Time } from "@internationalized/date";

import { getLocalTimeZone, parseDate, parseTime, today } from "@internationalized/date";
import { VueDraggable } from "vue-draggable-plus";

import type { ItemScreens } from "~/composables/use-culto-screens";
import type { CultoItem, CultoSection, ScreenItem } from "~~/lib/culto";

import { cultoWhen, formatCultoDate, partOfDay, SCREEN_TEMPLATES } from "~/stores/culto";
import { importSlides, titleFromFiles } from "~/utils/culto/import-slides";
import { itemLook, momentTone, spokenLabel } from "~/utils/culto/moment";
import { blocksOf } from "~/utils/culto/sections";
import { canShareFiles, downloadFile, exportCulto, importCulto, shareFile } from "~/utils/culto/transfer";

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
/** The element before the chosen one, for ← on its first screen. */
const prevEntry = computed(() => {
  const at = entries.value.findIndex(e => e.item.id === selectedId.value);
  return at > 0
    ? entries.value[at - 1] ?? null
    : null;
});
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

// On a computer, the chosen element stays in sight in the order: going to
// the next one from the screens («Siguiente») scrolls the list only when
// the element was out of view.
const isWide = useMediaQuery("(min-width: 1280px)");
watch(selectedId, async (id) => {
  if (!isLarge.value || !id)
    return;
  await nextTick();
  document.querySelector(`.c-order [data-item-id="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
});

const totalScreens = computed(() => entries.value.reduce((n, e) => n + e.screens.length, 0));

// ------------------------------------------------------------ the service

// The services by day, and on a day by time, the time first (NN/g: the
// first words tell them apart): "19:00 · noche — Culto de oración".
const cultoItems = computed(() => {
  const days = new Map<string, typeof sorted.value>();
  for (const c of sorted.value) {
    days.set(c.date, [
      ...(days.get(c.date) ?? []),
      c,
    ]);
  }
  return [
    ...days.entries(),
  ].map(([date, list]) => [
    {
      type: "label" as const,
      label: formatCultoDate(date),
    },
    ...list.map(c => ({
      label: c.time
        ? `${c.time} · ${partOfDay(c.time)} — ${c.title}`
        : c.title,
      value: c.id,
    })),
  ]);
});

/** The list of services, by day and time, to switch to another one. */
const switchItems = computed(() => cultoItems.value.map(group => group.map(entry => "value" in entry
  ? {
      label: entry.label,
      icon: entry.value === current.value?.id
        ? "i-tabler-check"
        : undefined,
      onSelect: () => culto.select(entry.value),
    }
  : entry)));

/** "Dom 29 nov · 19:00 · noche": when it is, short, for its button. */
function whenShort(c: { date: string; time?: string }) {
  const [y, m, d] = c.date.split("-").map(Number);
  const day = y && m && d
    ? new Date(y, m - 1, d).toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" }).replace(/[.,]/g, "")
    : c.date;
  const part = partOfDay(c.time);
  const text = part
    ? `${day} · ${c.time} · ${part}`
    : day;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// The time: optional, with Nuxt UI's time field; the part of the day
// (mañana, tarde, noche) follows from it.
const timeModel = computed({
  get: () => {
    try {
      return current.value?.time
        ? parseTime(current.value.time)
        : undefined;
    }
    catch {
      return undefined;
    }
  },
  set: (value: Time | undefined | null) => culto.patch({
    time: value
      ? `${String(value.hour).padStart(2, "0")}:${String(value.minute).padStart(2, "0")}`
      : undefined,
  }),
});

const titleModel = computed({
  get: () => current.value?.title ?? "",
  set: (title: string) => culto.patch({ title }),
});
// The date, with Nuxt UI's calendar (a button with the date that opens it).
const dateOpen = ref(false);
const calendarDate = computed({
  get: () => {
    try {
      return current.value?.date
        ? parseDate(current.value.date)
        : today(getLocalTimeZone());
    }
    catch {
      return today(getLocalTimeZone());
    }
  },
  set: (value: DateValue | undefined) => {
    if (value) {
      culto.patch({
        date: value.toString(),
      });
    }
  },
});

function removeCulto() {
  const target = current.value;
  if (!target)
    return;
  // A plain deep copy for «Deshacer»: structuredClone fails on reactive data.
  const copy = JSON.parse(JSON.stringify(target)) as typeof target;
  culto.remove(target.id);
  // The last one gone: an empty one to keep working on.
  const fresh = culto.sorted.length
    ? null
    : culto.create();
  toast(`Se borró «${copy.title} · ${cultoWhen(copy)}».`, {
    label: "Deshacer",
    run: () => {
      if (fresh)
        culto.remove(fresh.id);
      culto.cultos = [...culto.cultos, copy];
      culto.select(copy.id);
    },
  }, 8000);
}

/**
 * The only service and as a new one starts (its usual name, no time, only
 * the sample welcome): deleting it would leave the same, so it can't be.
 */
const isBlank = computed(() => {
  const c = current.value;
  const only = c?.items.length === 1
    ? c.items[0]
    : null;
  const welcome = SCREEN_TEMPLATES[0]!.item;
  return !!c && sorted.value.length === 1 && c.title === "Culto del domingo" && !c.time && !c.sections?.length
    && only?.kind === "screen" && only.title === welcome.title && only.eyebrow === welcome.eyebrow && !only.body && !only.background && !only.notes;
});

const showTheme = ref(false);

// ------------------------------------------------------------ another device
// A file with the service, its theme and images (utils/culto/transfer.ts).

const importInput = useTemplateRef<HTMLInputElement>("importFile");

// Two actions that say what they do (NN/g): «Descargar archivo» everywhere,
// «Enviar…» only where the browser can hand a file to the share sheet.
const canSend = ref(false);
onMounted(() => {
  canSend.value = canShareFiles();
});

async function currentFile() {
  return current.value
    ? exportCulto(toRaw(current.value), toRaw(culto.theme))
    : null;
}

async function downloadCurrent() {
  const file = await currentFile();
  if (!file)
    return;
  downloadFile(file);
  toast(`Se descargó «${file.name}». Para enviarlo, adjúntalo a un correo o un chat; para cargarlo, en cualquier dispositivo: Culto › ⋯ › Abrir archivo, o arrástralo a la página.`, undefined, 10000);
}

async function sendCurrent() {
  const file = await currentFile();
  if (file)
    await shareFile(file);
}

async function onImportFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = "";
  if (file)
    await openFile(file);
}

// A service file dropped anywhere on the page opens too.
const dropping = ref(false);
function hasFiles(e: DragEvent) {
  return [
    ...(e.dataTransfer?.types ?? []),
  ].includes("Files");
}
function onDragOver(e: DragEvent) {
  if (!hasFiles(e))
    return;
  e.preventDefault();
  dropping.value = true;
}
function onDragLeave(e: DragEvent) {
  if (e.relatedTarget === null || !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node))
    dropping.value = false;
}
async function onDrop(e: DragEvent) {
  dropping.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (!file)
    return;
  e.preventDefault();
  await openFile(file);
}

/** Opens a service file: it is added, chosen and ready to project. */
async function openFile(file: File) {
  try {
    const { culto: received, theme } = await importCulto(file);
    culto.cultos = [...culto.cultos, received];
    culto.select(received.id);
    // The sender's theme, only if this device has none of its own yet.
    const own = culto.theme;
    if (theme && !own.churchName && !own.logoId && own.background.kind === "acapela")
      culto.setTheme(theme);
    toast(`Se abrió «${received.title}». Listo para proyectar.`, {
      label: "Iniciar culto",
      run: () => navigateTo("/culto/vivo"),
    }, 9000);
  }
  catch (err) {
    toast(err instanceof Error
      ? err.message
      : String(err), undefined, 8000);
  }
}

/**
 * A new service, empty or a copy of this one, is opened; the one being
 * edited stays in the list, and the notice says so and leads back to it.
 */
function leaveFor(how: "new" | "copy") {
  const previous = current.value;
  if (how === "copy" && !previous)
    return;
  const made = how === "new"
    ? culto.create()
    : culto.duplicate(previous!.id);
  if (!made || !previous)
    return;
  const name = `«${previous.title} · ${cultoWhen(previous)}»`;
  toast(how === "new"
    ? `Se creó un culto nuevo. ${name} sigue guardado en la lista de arriba.`
    : `Se duplicó para ${formatCultoDate(made.date)}. ${name} sigue guardado en la lista de arriba.`, {
    label: "Volver al anterior",
    run: () => culto.select(previous.id),
  }, 9000);
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
      onSelect: () => leaveFor("new"),
    },
    {
      label: "Duplicar para otro día",
      icon: "i-tabler-copy",
      onSelect: () => leaveFor("copy"),
    },
  ],
  [
    // As a file, to take it to another device or share it: save, send,
    // open (or drop it on the page).
    { label: "Archivo", type: "label" as const },
    {
      label: "Descargar archivo",
      icon: "i-tabler-download",
      onSelect: downloadCurrent,
    },
    ...(canSend.value
      ? [
          {
            label: "Enviar…",
            icon: "i-tabler-send",
            onSelect: sendCurrent,
          },
        ]
      : []),
    {
      label: "Abrir archivo…",
      icon: "i-tabler-file-import",
      onSelect: () => importInput.value?.click(),
    },
  ],
  [
    {
      label: "Borrar este culto",
      icon: "i-tabler-trash",
      color: "error" as const,
      // Nothing to delete: the only one, as a new one starts.
      disabled: isBlank.value,
      onSelect: removeCulto,
    },
  ],
]);

// ------------------------------------------------------------ adding
// Three ways to the same place (NN/g: actions next to their object, not
// only on hover): the buttons at the foot add last, as by default; the
// chosen element's «+» inserts right after it; a «+» line between rows (on
// hover, for the mouse) inserts there. Inside a section it stays in it.
// What is added is chosen, announced with «Deshacer», and lit for a moment.

/** Where something new goes: last, right after an element, or last in a section. */
type Target = { after: string; loose?: boolean } | { section: string } | null;

const pickHymn = ref(false);
/** Where the hymn being picked, or the slides being read, will go. */
const pendingTarget = ref<Target>(null);
const { sections } = storeToRefs(culto);
const announcement = ref("");
const flashId = ref<string | null>(null);

function place(item: CultoItem, target: Target) {
  const placed = target && "section" in target
    ? culto.addToSection(target.section, item)
    : target && "after" in target
      ? culto.insertAfter(target.after, item, target.loose)
      : culto.addItem(item);
  done(placed.id, target);
}

/** After adding: chosen, lit for a moment, announced, with «Deshacer». */
function done(id: string, target: Target) {
  selectedId.value = id;
  flashId.value = id;
  setTimeout(() => {
    if (flashId.value === id)
      flashId.value = null;
  }, 1600);
  nextTick(() => {
    const index = entries.value.findIndex(e => e.item.id === id);
    const entry = entries.value[index];
    const after = target && "after" in target
      ? entries.value.find(e => e.item.id === target.after)
      : null;
    const what = entry
      ? itemLook(entry.item).label
      : "Elemento";
    announcement.value = `Se insertó ${what}${after
      ? ` después de «${spokenLabel(after)}»`
      : ""}. Posición ${index + 1} de ${entries.value.length}.`;
    toast(announcement.value, {
      label: "Deshacer",
      run: () => culto.removeItem(id),
    });
    document.querySelector(`[data-item-id="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}

function addHymn(songId: number) {
  const target = pendingTarget.value;
  pendingTarget.value = null;
  place(culto.newHymn(songbook.currentId, songId), target);
}

// Slides from a PDF or images: chosen first, then imported as a new element.
const slidesInput = useTemplateRef<HTMLInputElement>("slidesFile");
const importing = ref<string | null>(null);
async function onSlidesFiles(e: Event) {
  const target = pendingTarget.value;
  pendingTarget.value = null;
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
      place(culto.newSlides(titleFromFiles(files), ids), target);
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

/**
 * A central moment's template: a section with its title screen (inside a
 * section, just the screen: sections do not nest).
 */
function placeSection(title: string, template: Omit<ScreenItem, "id">, target: Target) {
  const screen = culto.newScreen(template);
  const after = target && "after" in target
    ? items.value.find(i => i.id === target.after)
    : null;
  if ((target && "section" in target) || (after?.sectionId && !(target && "after" in target && target.loose))) {
    place(screen, target);
    return;
  }
  const index = after
    ? items.value.findIndex(i => i.id === after.id) + 1
    : undefined;
  culto.createSection(template.moment ?? "other", title, [screen], index);
  done(screen.id, target);
}

function pickHymnFor(target: Target) {
  pendingTarget.value = target;
  pickHymn.value = true;
}

function pickSlidesFor(target: Target) {
  pendingTarget.value = target;
  slidesInput.value?.click();
}

function templateItems(target: Target) {
  return SCREEN_TEMPLATES.map(t => ({
    label: t.label,
    icon: itemLook({ ...t.item, id: "" }).icon,
    // The central moments come as a section, ready for their passages.
    onSelect: () => SECTION_MOMENTS.has(t.item.moment ?? "other")
      ? placeSection(t.label, t.item, target)
      : place(culto.newScreen(t.item), target),
  }));
}

/** The same menu wherever something is added. */
function addMenu(target: Target) {
  return [
    [
      {
        label: "Himno",
        icon: "i-tabler-music",
        onSelect: () => pickHymnFor(target),
      },
      {
        label: "Cita bíblica",
        icon: "i-tabler-book",
        onSelect: () => place(culto.newReading("", bible.currentId), target),
      },
      {
        label: "Diapositivas (PDF o imágenes)",
        icon: "i-tabler-slideshow",
        onSelect: () => pickSlidesFor(target),
      },
    ],
    [
      { label: "Pantalla", type: "label" as const },
      ...templateItems(target),
      {
        label: "Pantalla en blanco",
        icon: "i-tabler-file",
        onSelect: () => place(culto.newScreen(), target),
      },
    ],
  ];
}

function addReading() {
  place(culto.newReading("", bible.currentId), null);
}

const screenMenu = [
  templateItems(null),
  [
    {
      label: "Pantalla en blanco",
      icon: "i-tabler-file",
      onSelect: () => place(culto.newScreen(), null),
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
/** The chosen element's first field to fill (a reading's passage), focused. */
function focusEditorField() {
  const field = document.querySelector<HTMLInputElement>("#c-selected input[role='combobox'], #c-selected input, #c-selected textarea");
  field?.scrollIntoView({ block: "center", behavior: "smooth" });
  field?.focus({ preventScroll: true });
  field?.select();
}

/** Room for an element's name over its segment in the map, in rem. */
function mapLabelBasis(label: string | undefined) {
  return Math.max(1.25, (label?.length ?? 0) * 0.42 + 0.5);
}
/** A reading's name in the map: its passage, which says more than «Lectura». */
function mapName(item: CultoItem) {
  return item.kind === "reading"
    ? item.reference.trim() || "Lectura"
    : looks.value.get(item.id)?.label ?? "";
}
/** Room for one element of a section in the map: a reading's name, or a segment. */
function mapItemBasis(item: CultoItem) {
  return item.kind === "reading"
    ? mapLabelBasis(mapName(item))
    : 1.25;
}

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
/** «Añadir a Santa Cena»: a screen of its moment, a passage, a hymn, slides… */
function sectionMenu(section: CultoSection) {
  const target: Target = { section: section.id };
  return [
    [
      {
        label: "Pantalla",
        icon: "i-tabler-presentation",
        onSelect: () => place(culto.newScreen(undefined, { moment: section.moment, layout: "title", eyebrow: section.title }), target),
      },
      {
        label: "Cita bíblica",
        icon: "i-tabler-book",
        onSelect: () => place(culto.newReading("", bible.currentId), target),
      },
      {
        label: "Himno",
        icon: "i-tabler-music",
        onSelect: () => pickHymnFor(target),
      },
      {
        label: "Diapositivas (PDF o imágenes)",
        icon: "i-tabler-slideshow",
        onSelect: () => pickSlidesFor(target),
      },
    ],
  ];
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
  <div
    class="page-scroll relative"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <!-- A service file being dragged over the page. -->
    <div
      v-if="dropping"
      class="pointer-events-none fixed inset-4 z-50 grid place-items-center rounded-3xl border-4 border-dashed border-primary bg-primary/10 backdrop-blur-sm"
    >
      <p class="flex items-center gap-3 rounded-2xl bg-default px-6 py-4 text-lg font-semibold shadow-card">
        <UIcon name="i-tabler-file-import" class="size-7 text-primary" />
        Suelta el archivo para abrir el culto
      </p>
    </div>
    <div class="w-full max-w-7xl mx-auto px-4 py-4 flex flex-col gap-5">
      <!-- The service, in one line (NN/g: visual hierarchy, proximity): its
        name, edited in place, with the list of services beside it; when it
        is (date, time, part of the day) in one button; its main action and
        its menu. -->
      <header class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div class="flex min-w-64 flex-1 items-center gap-1">
          <UInput
            v-model="titleModel"
            variant="ghost"
            size="xl"
            class="title-edit min-w-0 max-w-full"
            trailing-icon="i-tabler-pencil"
            :ui="{ base: 'text-2xl font-bold text-highlighted px-2 [field-sizing:content] min-w-40 max-w-full', trailingIcon: 'title-edit__pencil' }"
            aria-label="Nombre del culto"
            title="Cambiar el nombre"
          />
          <UDropdownMenu v-if="sorted.length > 1" :items="switchItems">
            <UButton
              color="neutral"
              variant="ghost"
              size="xl"
              square
              icon="i-tabler-chevron-down"
              aria-label="Elegir otro culto"
              :title="`${sorted.length} cultos guardados`"
            />
          </UDropdownMenu>
        </div>
        <UPopover v-model:open="dateOpen">
          <UButton
            color="neutral"
            variant="outline"
            size="xl"
            icon="i-tabler-calendar-event"
            :label="current ? whenShort(current) : 'Cuándo'"
            :aria-label="current ? `Cuándo: ${cultoWhen(current)}. Cambiar fecha u hora` : 'Cuándo'"
          />
          <template #content>
            <div class="flex flex-col gap-3 p-3">
              <UCalendar v-model="calendarDate" />
              <div class="flex flex-wrap items-center gap-2 border-t border-muted pt-3">
                <span class="text-sm font-medium">Hora</span>
                <UInputTime
                  v-model="timeModel"
                  :hour-cycle="24"
                  aria-label="Hora del culto (opcional)"
                />
                <UBadge
                  v-if="partOfDay(current?.time)"
                  color="neutral"
                  variant="soft"
                  :label="partOfDay(current?.time)!"
                />
                <UButton
                  v-if="current?.time"
                  color="neutral"
                  variant="link"
                  size="sm"
                  label="Quitar hora"
                  @click="culto.patch({ time: undefined })"
                />
              </div>
              <p class="max-w-64 text-xs text-muted">
                La hora es opcional: distingue varios cultos del mismo día.
              </p>
            </div>
          </template>
        </UPopover>
        <div class="flex items-center gap-2">
          <UButton
            to="/culto/vivo"
            size="xl"
            icon="i-tabler-player-play-filled"
            label="Iniciar culto"
            :disabled="!totalScreens"
          />
          <UDropdownMenu :items="cultoMenu">
            <UButton
              color="neutral"
              variant="outline"
              size="xl"
              icon="i-tabler-dots"
              aria-label="Más opciones del culto"
            />
          </UDropdownMenu>
        </div>
      </header>

      <!-- The service at a glance, above the three panels (NN/g: Fitts's
        law, proximity): one segment per element in the colour of its family,
        large enough to aim at; a section's together under its name, apart
        from the rest. Each one chooses its element. -->
      <nav
        v-if="items.length > 1"
        aria-label="Mapa del culto"
        class="flex flex-wrap items-end gap-x-3 gap-y-2 rounded-2xl bg-default shadow-card px-3 py-2.5"
      >
        <template v-for="block in dragBlocks" :key="`map-${block.key}`">
          <div
            v-if="block.kind === 'section'"
            class="flex min-w-0 flex-col gap-1"
            :class="`moment--${momentTone(block.section.moment)}`"
            :style="{ flexGrow: block.items.length, flexBasis: `${block.items.reduce((sum, e) => sum + mapItemBasis(e.item), 0)}rem` }"
          >
            <span class="map-label truncate text-(--m-label)">{{ block.section.title }}</span>
            <!-- Its elements; a reading also says its passage over its segment. -->
            <span class="flex items-end gap-1">
              <span
                v-for="entry in block.items"
                :key="`map-${entry.item.id}`"
                class="flex min-w-0 flex-col gap-1"
                :class="`moment--${looks.get(entry.item.id)?.tone}`"
                :style="{ flexGrow: 1, flexBasis: `${mapItemBasis(entry.item)}rem` }"
              >
                <span v-if="entry.item.kind === 'reading'" class="map-label truncate text-(--m-label)">{{ mapName(entry.item) }}</span>
                <span class="flex">
                  <button
                    type="button"
                    class="map-seg"
                    :class="[`moment--${looks.get(entry.item.id)?.tone}`, { 'map-seg--on': entry.item.id === selectedId }]"
                    :aria-label="spokenLabel(entry)"
                    :aria-current="entry.item.id === selectedId ? 'true' : undefined"
                    :title="spokenLabel(entry)"
                    @click="choose(entry.item.id)"
                  >
                    <span v-if="entry.item.kind === 'hymn'" class="map-seg__mark">{{ entry.item.songId }}</span>
                    <UIcon v-else :name="looks.get(entry.item.id)?.icon ?? ''" class="map-seg__mark size-4" />
                  </button>
                </span>
              </span>
            </span>
          </div>
          <!-- A hymn shows its number; any other element on its own, its
            name on top, as a section does (smaller, it names one element). -->
          <button
            v-else-if="block.entry.item.kind === 'hymn'"
            type="button"
            class="map-seg self-end"
            :class="[`moment--${looks.get(block.entry.item.id)?.tone}`, { 'map-seg--on': block.entry.item.id === selectedId }]"
            :style="{ flexGrow: 1, flexBasis: '1.25rem' }"
            :aria-label="spokenLabel(block.entry)"
            :aria-current="block.entry.item.id === selectedId ? 'true' : undefined"
            :title="spokenLabel(block.entry)"
            @click="choose(block.entry.item.id)"
          >
            <span class="map-seg__mark">{{ block.entry.item.songId }}</span>
          </button>
          <div
            v-else
            class="flex min-w-0 flex-col gap-1"
            :class="`moment--${looks.get(block.entry.item.id)?.tone}`"
            :style="{ flexGrow: 1, flexBasis: `${mapLabelBasis(mapName(block.entry.item))}rem` }"
          >
            <span class="map-label truncate text-(--m-label)">{{ mapName(block.entry.item) }}</span>
            <span class="flex">
              <button
                type="button"
                class="map-seg"
                :class="[`moment--${looks.get(block.entry.item.id)?.tone}`, { 'map-seg--on': block.entry.item.id === selectedId }]"
                :aria-label="spokenLabel(block.entry)"
                :aria-current="block.entry.item.id === selectedId ? 'true' : undefined"
                :title="spokenLabel(block.entry)"
                @click="choose(block.entry.item.id)"
              >
                <UIcon :name="looks.get(block.entry.item.id)?.icon ?? ''" class="map-seg__mark size-4" />
              </button>
            </span>
          </div>
        </template>
      </nav>

      <div class="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)] items-start">
        <!-- Order -->
        <CultoPanel
          title="Orden del culto"
          icon="i-tabler-list-numbers"
          body-class="flex flex-col gap-3 p-3"
          class="c-order"
        >
          <template v-if="items.length" #meta>
            {{ items.length }} {{ items.length === 1 ? 'elemento' : 'elementos' }} · {{ totalScreens }} {{ totalScreens === 1 ? 'pantalla' : 'pantallas' }}<template v-if="hymnCount">
              · {{ hymnCount }} {{ hymnCount === 1 ? 'himno' : 'himnos' }}
            </template>
          </template>
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
              v-for="(block, bi) in dragBlocks"
              :key="block.key"
              class="order-li relative scroll-mt-28 scroll-mb-6"
              :data-item-id="block.kind === 'item' ? block.entry.item.id : undefined"
            >
              <!-- «+» under it: inserts right after this block. -->
              <CultoInsertLine
                v-if="bi < dragBlocks.length - 1 || (block.kind === 'item' && block.entry.item.id === selectedId && !selectedSection)"
                :on="block.kind === 'item' && block.entry.item.id === selectedId && !selectedSection"
                :items="addMenu(block.kind === 'item' ? { after: block.entry.item.id } : { after: block.items.at(-1)!.item.id, loose: true })"
                :label="`Insertar después de «${block.kind === 'item' ? spokenLabel(block.entry) : block.section.title}»`"
              />
              <CultoOrderRow
                v-if="block.kind === 'item'"
                :entry="block.entry"
                :selected="block.entry.item.id === selectedId && !selectedSection"
                :can-up="flatIds[0] !== block.entry.item.id"
                :can-down="flatIds.at(-1) !== block.entry.item.id"
                handle="block-handle"
                :flash="flashId === block.entry.item.id"
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
                  <li
                    v-for="(entry, ei) in block.items"
                    :key="entry.item.id"
                    class="order-li relative scroll-mt-28 scroll-mb-6"
                    :data-item-id="entry.item.id"
                  >
                    <CultoInsertLine
                      v-if="ei < block.items.length - 1 || (entry.item.id === selectedId && !selectedSection)"
                      :on="entry.item.id === selectedId && !selectedSection"
                      :items="addMenu({ after: entry.item.id })"
                      :label="`Insertar en ${block.section.title} después de «${spokenLabel(entry)}»`"
                    />
                    <CultoOrderRow
                      :entry="entry"
                      :selected="entry.item.id === selectedId && !selectedSection"
                      :can-up="true"
                      :can-down="true"
                      handle="item-handle"
                      :flash="flashId === entry.item.id"
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
          <template #footer>
            <div class="flex flex-col gap-2">
              <span class="text-xs font-bold text-muted">Agregar</span>
              <div class="flex flex-wrap gap-2">
                <UButton
                  color="neutral"
                  variant="outline"
                  icon="i-tabler-music"
                  label="Himno"
                  @click="pickHymnFor(null)"
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
                  label="Diapositivas (PDF o imágenes)"
                  :loading="!!importing"
                  @click="pickSlidesFor(null)"
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
            </div>
          </template>
        </CultoPanel>

        <!-- Selected element -->
        <section
          v-if="selected"
          id="c-selected"
          class="flex flex-col gap-5 min-w-0 scroll-mt-20"
          aria-label="Elemento elegido"
        >
          <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] items-start">
            <!-- The screens stay at the top while the panel beside them scrolls. -->
            <!-- Sticky 1rem from the window's top: the page box has the bar's
              height as top padding, but the bar goes up with the page. -->
            <div class="flex flex-col gap-3 min-w-0" :class="{ 'sticky top-[calc(1rem-var(--bar-top))] z-10': isWide }">
              <p v-if="selected.status === 'error' && selected.all.length" class="rounded-2xl bg-warning/10 text-warning px-4 py-3 text-sm font-medium">
                {{ selected.error }}
              </p>
              <CultoPanel title="Pantallas" icon="i-tabler-device-desktop" body-class="p-3">
                <template #meta>
                  {{ looks.get(selected.item.id)?.label }}<template v-if="selected.status === 'ready'">
                    · {{ selected.screens.length }} {{ selected.screens.length === 1 ? 'pantalla' : 'pantallas' }}
                  </template>
                </template>
                <CultoScreenManager
                  :entry="selected"
                  :next="nextEntry"
                  @next="nextEntry && choose(nextEntry.item.id)"
                  @prev="prevEntry && choose(prevEntry.item.id)"
                  @complete="focusEditorField"
                />
              </CultoPanel>
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
/* The «+» under a row shows while the mouse is anywhere over the row. */
@media (hover: hover) {
  .order-li:hover > .insert-line {
    opacity: 1;
  }
}
/* The service's name, edited in place: the pencil shows it can be. */
.title-edit .title-edit__pencil {
  opacity: 0;
  transition: opacity 120ms ease;
}
.title-edit:hover .title-edit__pencil,
.title-edit:focus-within .title-edit__pencil {
  opacity: 0.6;
}

/* The service's map: a segment per element, large enough to aim at. */
.map-seg {
  flex: 1 1 1.25rem;
  min-width: 0.875rem;
  height: 2.25rem;
  border-radius: 0.5rem;
  background: var(--m-seg);
  color: var(--m-seg-fg, #fff);
  display: grid;
  place-items: center;
  container-type: inline-size;
  font-size: 0.7rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  transition:
    transform 120ms ease,
    box-shadow 120ms ease;
}
/* Its icon or hymn number, the same as its row's; left out when the
   segment is too narrow to hold it whole. */
@container (max-width: 1.4rem) {
  .map-seg__mark {
    display: none;
  }
}
.map-seg:hover {
  transform: translateY(-2px);
}
.map-seg--on {
  box-shadow:
    0 0 0 2px var(--ui-bg),
    0 0 0 4px var(--ui-primary);
}
@media (prefers-reduced-motion: reduce) {
  .map-seg {
    transition: none;
  }
}

/* Just added: lit for a moment, so the eye finds it. */
.row-flash {
  animation: row-flash 1.6s ease-out;
}
@keyframes row-flash {
  0%,
  35% {
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--ui-primary) 55%, transparent);
    background: color-mix(in oklab, var(--ui-primary) 14%, var(--ui-bg));
  }
}
@media (prefers-reduced-motion: reduce) {
  .row-flash {
    animation: none;
  }
}

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
/* The names over the service's map: sections and lone elements, small. */
.map-label {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 1.2;
  text-transform: uppercase;
}
</style>
