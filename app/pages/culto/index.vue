<script lang="ts" setup>
import { VueDraggable } from "vue-draggable-plus";

import type { ItemScreens } from "~/composables/use-culto-screens";
import type { CultoItem } from "~~/lib/culto";

import { formatCultoDate, SCREEN_TEMPLATES } from "~/stores/culto";
import { ITEM_KIND_LABELS } from "~~/lib/culto";

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

const cultoMenu = computed(() => [
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

function addReading() {
  add(culto.newReading("", bible.currentId));
}

const screenMenu = [
  SCREEN_TEMPLATES.map(t => ({
    label: t.label,
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

function reorder(list: ItemScreens[]) {
  culto.setOrder(list.map(e => e.item.id));
}

function move(id: string, delta: number) {
  const index = items.value.findIndex(i => i.id === id);
  culto.moveItem(id, index + delta);
}

const KIND_DOT: Record<string, string> = {
  hymn: "bg-primary",
  screen: "bg-amber-500",
  reading: "bg-emerald-500",
};

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
          <h2 id="c-order" class="text-xs font-bold uppercase tracking-wider opacity-70">
            Orden del culto
          </h2>
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
            @update:model-value="reorder"
          >
            <li v-for="(entry, i) in entries" :key="entry.item.id">
              <div
                class="flex items-center gap-1 rounded-2xl border transition-colors"
                :class="entry.item.id === selectedId ? 'border-primary bg-primary/10' : 'border-default bg-default hover:bg-muted'"
              >
                <span
                  class="drag-handle self-stretch flex items-center ps-2 cursor-grab touch-none opacity-50 hover:opacity-100"
                  :aria-label="`Arrastrar para mover «${entry.label}»`"
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
                  <span class="w-5 text-xs tabular-nums opacity-60">{{ i + 1 }}</span>
                  <span class="size-2 rounded-full shrink-0" :class="KIND_DOT[entry.item.kind]" aria-hidden="true" />
                  <span class="flex-1 min-w-0 flex flex-col">
                    <span class="font-medium truncate">{{ entry.label || ITEM_KIND_LABELS[entry.item.kind] }}</span>
                    <span class="text-xs opacity-70 truncate">
                      {{ ITEM_KIND_LABELS[entry.item.kind] }}
                      <template v-if="entry.status === 'ready'">· {{ entry.screens.length }} {{ entry.screens.length === 1 ? 'pantalla' : 'pantallas' }}</template>
                      <template v-if="entry.item.inserted">· insertado en vivo</template>
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
                    size="xs"
                    icon="i-tabler-chevron-up"
                    :disabled="i === 0"
                    aria-label="Subir"
                    @click="move(entry.item.id, -1)"
                  />
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    icon="i-tabler-chevron-down"
                    :disabled="i === entries.length - 1"
                    aria-label="Bajar"
                    @click="move(entry.item.id, 1)"
                  />
                </div>
              </div>
            </li>
          </VueDraggable>
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
          </div>
          <p class="text-xs opacity-60">
            Lo nuevo se agrega debajo del elemento elegido.
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
            <div class="rounded-2xl border border-default p-4 bg-default">
              <CultoItemEditor :key="selected.item.id" :entry="selected" @remove="removeItem(selected.item.id)" />
            </div>
          </div>
        </section>
      </div>
    </div>

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
