<script setup lang="ts">
import { VueDraggable } from "vue-draggable-plus";

import type { ItemScreens, ManagedScreen } from "~/composables/use-culto-screens";

import { itemLook } from "~/utils/culto/moment";

// The screens of one element, as in SúperBiblia's screen manager (drag to
// change their order, hide one, join it to the previous one, or start a new
// screen inside it), laid out as its study tour stage (Arqueología del NT):
// one card with the chosen screen large, its actions under it, and a strip
// of all the element's screens below, with the count and the next element
// on its right, so the whole service can be gone through from here. Changes
// are kept with the element and survive re-flows.
const props = defineProps<{
  entry: ItemScreens;
  /** The element after this one, for «Siguiente». */
  next?: ItemScreens | null;
}>();
const emit = defineEmits<{
  /** Choose the next element. */
  next: [];
  /** Choose the previous element (← on its first screen). */
  prev: [];
  /** Go to the field that gives it its screens (a reading's passage). */
  complete: [];
}>();

const culto = useCultoStore();
const itemId = computed(() => props.entry.item.id);
const look = computed(() => itemLook(props.entry.item));

// The screen on the stage, by its stable key; the first one when the
// element changes or the chosen one is gone (re-flowed away).
const activeKey = ref<string | null>(null);
const active = computed<ManagedScreen | null>(() =>
  props.entry.all.find(s => s.key === activeKey.value) ?? props.entry.all[0] ?? null,
);
// ← from the first screen goes to the previous element, on its last one.
let landOnLast = false;
watch(itemId, () => {
  activeKey.value = landOnLast
    ? props.entry.all.at(-1)?.key ?? null
    : null;
  landOnLast = false;
});

// A hymn's verses keep the songbook's order: they can be hidden, never
// dragged, so it is not changed by accident.
const canReorder = computed(() => props.entry.item.kind !== "hymn" && props.entry.all.length > 1);

const visible = computed(() => props.entry.all.filter(s => !s.hidden));
const hiddenCount = computed(() => props.entry.all.length - visible.value.length);
const changed = computed(() => {
  const item = props.entry.item;
  return !!(item.screenOrder?.length || item.hidden?.length || (item.breaks && Object.keys(item.breaks).length));
});

/** Number among the projected screens (hidden ones have none). */
function projectedNumber(screen: ManagedScreen) {
  return visible.value.indexOf(screen) + 1;
}

function saveOrder(list: ManagedScreen[]) {
  culto.setScreenOrder(itemId.value, list.map(s => s.key));
}

function cutItems(screen: ManagedScreen) {
  return [
    [
      { label: "Empezar una pantalla nueva en:", type: "label" as const },
    ],
    (screen.cuts ?? []).map(cut => ({
      label: cut.label,
      onSelect: () => culto.setBreak(itemId.value, cut.id, true),
    })),
  ];
}

const stripRef = useTemplateRef<HTMLElement>("strip");
function choose(screen: ManagedScreen) {
  activeKey.value = screen.key;
}

/** ← → on the strip go through the screens. */
function step(delta: number) {
  const list = props.entry.all;
  const at = active.value
    ? list.indexOf(active.value)
    : 0;
  const target = list[Math.max(0, Math.min(list.length - 1, at + delta))];
  if (!target)
    return;
  activeKey.value = target.key;
  nextTick(() => stripRef.value?.querySelector<HTMLElement>(`[data-screen="${CSS.escape(target.key)}"]`)?.focus());
}

// ← → anywhere in the editor, as in the presenter: through the screens of
// the element, and on to the next or back to the previous element at its
// ends. Not while typing, nor where the arrows already mean something (a
// choice of options, a list, a menu, an open dialog), nor on the strip,
// which moves its own focus.
const ARROWS_TAKEN = "input, textarea, select, [contenteditable=''], [contenteditable='true'], [role=radiogroup], [role=radio], [role=listbox], [role=option], [role=menu], [role=menuitem], [role=tablist], [role=slider], [role=spinbutton], [role=dialog]";
function stepAcross(delta: number) {
  const list = props.entry.all;
  const at = active.value
    ? list.indexOf(active.value)
    : 0;
  if (delta > 0 && at >= list.length - 1) {
    if (props.next)
      emit("next");
    return;
  }
  if (delta < 0 && at <= 0) {
    landOnLast = true;
    emit("prev");
    // No element before: nothing changed, forget it.
    nextTick(() => {
      landOnLast = false;
    });
    return;
  }
  activeKey.value = list[at + delta]!.key;
}
useEventListener(window, "keydown", (event: KeyboardEvent) => {
  if ((event.key !== "ArrowLeft" && event.key !== "ArrowRight") || event.defaultPrevented
    || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return;
  }
  const target = event.target as HTMLElement | null;
  if (target?.closest(ARROWS_TAKEN) || stripRef.value?.contains(target)
    || document.querySelector("[role=dialog][data-state=open], [role=dialog]:not([data-state])")) {
    return;
  }
  event.preventDefault();
  stepAcross(event.key === "ArrowRight"
    ? 1
    : -1);
});

// The chosen thumbnail stays in view inside the strip.
watch(() => active.value?.key, (key) => {
  nextTick(() => stripRef.value?.querySelector(`[data-screen="${CSS.escape(key ?? "")}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" }));
});

/** What the stage waits for when the element has no screens yet. */
const waiting = computed(() => {
  const { item, status, error } = props.entry;
  if (status === "loading") {
    return {
      icon: "i-tabler-loader-2",
      spin: true,
      title: "Preparando las pantallas…",
      text: "Se reparten a la medida del proyector.",
    };
  }
  if (item.kind === "reading" && !item.reference.trim()) {
    return {
      icon: "i-tabler-book-2",
      title: "Elige la cita",
      text: "Escríbela en «Cita», en el panel de al lado (Juan 3:16, sal23 1-6, 1co 13…), o búscala con «Elegir».",
      action: "Elegir la cita",
      actionIcon: "i-tabler-pencil",
    };
  }
  if (item.kind === "reading" && status === "error") {
    return {
      icon: "i-tabler-alert-triangle",
      title: "No reconozco esa cita",
      text: `«${item.reference}»: revisa el libro, el capítulo y los versículos.`,
      action: "Corregir la cita",
      actionIcon: "i-tabler-pencil",
    };
  }
  if (status === "error")
    return { icon: "i-tabler-alert-triangle", title: "No se pudo preparar", text: error ?? "" };
  if (item.kind === "slides")
    return { icon: "i-tabler-presentation", title: "Todavía no hay diapositivas", text: "Agrégalas con «Agregar PDF o imágenes», en el panel de al lado." };
  return { icon: "i-tabler-layout-cards", title: "Todavía no hay pantallas", text: "Completa el contenido en el panel de al lado." };
});

const nextLook = computed(() => (props.next
  ? itemLook(props.next.item)
  : null));
const nextTitle = computed(() => {
  const n = props.next;
  if (!n)
    return "";
  return n.item.kind === "hymn"
    ? n.label.replace(`${n.item.songId} · `, "")
    : n.label;
});
</script>

<template>
  <section class="stage flex flex-col overflow-hidden rounded-2xl text-white" aria-label="Pantallas del elemento">
    <!-- The chosen screen, large -->
    <div v-if="active" class="relative">
      <div :class="{ 'opacity-35 grayscale': active.hidden }">
        <CultoScreen :screen="active.screen" />
      </div>
      <p class="pointer-events-none absolute top-3 left-3 inline-flex max-w-[85%] items-center gap-2 rounded-full bg-black/60 py-1 ps-1 pe-3.5 text-sm font-semibold backdrop-blur-sm">
        <CultoMomentTile :item="entry.item" size="sm" />
        <span class="truncate">{{ look.label }}</span>
        <span class="shrink-0 font-normal text-white/75 tabular-nums">
          · {{ active.hidden ? 'oculta' : `pantalla ${projectedNumber(active)} de ${visible.length}` }}
        </span>
      </p>
      <span v-if="active.hidden" class="pointer-events-none absolute inset-0 grid place-items-center text-base font-bold">
        Oculta · no se proyecta
      </span>
    </div>

    <!-- No screens yet: the stage keeps its size and says what it waits
      for (NN/g: visibility of system status, empty states that guide). -->
    <div v-else class="relative grid aspect-video place-items-center p-6 text-center">
      <div class="pointer-events-none absolute inset-3 rounded-xl border-2 border-dashed border-white/15" aria-hidden="true" />
      <p class="absolute top-3 left-3 inline-flex max-w-[85%] items-center gap-2 rounded-full bg-black/60 py-1 ps-1 pe-3.5 text-sm font-semibold">
        <CultoMomentTile :item="entry.item" size="sm" />
        <span class="truncate">{{ look.label }}</span>
      </p>
      <div class="relative flex max-w-sm flex-col items-center gap-3" aria-live="polite">
        <span class="grid size-14 place-items-center rounded-2xl bg-white/10">
          <UIcon :name="waiting.icon" class="size-7" :class="{ 'animate-spin': waiting.spin }" />
        </span>
        <p class="text-lg font-semibold">
          {{ waiting.title }}
        </p>
        <p class="text-sm text-white/70">
          {{ waiting.text }}
        </p>
        <UButton
          v-if="waiting.action"
          size="md"
          class="mt-1 bg-(--color-tangerine-400) text-(--color-tangerine-950) hover:bg-(--color-tangerine-300)"
          :icon="waiting.actionIcon"
          :label="waiting.action"
          @click="emit('complete')"
        />
      </div>
    </div>

    <!-- What can be done with it -->
    <div v-if="active" class="flex flex-wrap items-center gap-1.5 px-3 pt-3">
      <UButton
        size="sm"
        color="neutral"
        variant="soft"
        class="bg-white/10 text-white hover:bg-white/18"
        :icon="active.hidden ? 'i-tabler-eye' : 'i-tabler-eye-off'"
        :label="active.hidden ? 'Mostrar' : 'Ocultar'"
        @click="culto.toggleHidden(itemId, active.key)"
      />
      <UButton
        v-if="active.joinId"
        size="sm"
        color="neutral"
        variant="soft"
        class="bg-white/10 text-white hover:bg-white/18"
        icon="i-tabler-arrow-merge-left"
        label="Unir con la anterior"
        @click="culto.setBreak(itemId, active.joinId, false)"
      />
      <UDropdownMenu v-if="active.cuts?.length" :items="cutItems(active)">
        <UButton
          size="sm"
          color="neutral"
          variant="soft"
          class="bg-white/10 text-white hover:bg-white/18"
          icon="i-tabler-separator"
          label="Partir…"
        />
      </UDropdownMenu>
      <span class="flex-1" />
      <span class="text-xs text-white/60">
        <template v-if="hiddenCount">{{ hiddenCount }} {{ hiddenCount === 1 ? 'oculta' : 'ocultas' }}</template>
        <template v-if="hiddenCount && canReorder"> · </template>
        <template v-if="canReorder">arrastra para ordenar</template>
      </span>
      <UButton
        v-if="changed"
        size="sm"
        color="neutral"
        variant="ghost"
        class="text-white/80 hover:bg-white/10 hover:text-white"
        icon="i-tabler-restore"
        label="Restablecer"
        title="Restablecer orden, cortes y ocultas"
        @click="culto.resetScreens(itemId)"
      />
    </div>

    <!-- The strip and the count; under them, the next element. -->
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 ps-1.5 pe-3">
      <div
        v-if="entry.all.length"
        ref="strip"
        v-scroll-fade-x
        class="no-bar flex-[1_1_16rem] min-w-0 overflow-x-auto"
        role="group"
        :aria-label="canReorder ? 'Pantallas: ← → para recorrerlas, arrastra para cambiar el orden' : 'Pantallas: ← → para recorrerlas'"
        @keydown.left.prevent="step(-1)"
        @keydown.right.prevent="step(1)"
      >
        <VueDraggable
          :model-value="[...entry.all]"
          :disabled="!canReorder"
          class="flex gap-2.5 px-1.5 py-2"
          :animation="150"
          :force-fallback="true"
          :delay="150"
          :delay-on-touch-only="true"
          ghost-class="drag-ghost"
          chosen-class="drag-chosen"
          @update:model-value="saveOrder"
        >
          <button
            v-for="screen in entry.all"
            :key="screen.key"
            type="button"
            class="relative w-28 shrink-0 overflow-hidden rounded-lg transition-opacity"
            :class="[
              screen.key === active?.key ? 'outline-3 outline-offset-2 outline-(--color-tangerine-400)' : 'opacity-60 hover:opacity-95',
              { grayscale: screen.hidden },
            ]"
            :data-screen="screen.key"
            :aria-current="screen.key === active?.key ? 'true' : undefined"
            :aria-label="screen.hidden ? 'Pantalla oculta' : `Pantalla ${projectedNumber(screen)}`"
            @click="choose(screen)"
          >
            <span class="pointer-events-none block">
              <CultoScreen :screen="screen.screen" />
            </span>
            <span
              class="absolute bottom-1 left-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[0.68rem] font-bold tabular-nums"
              :class="screen.key === active?.key ? 'bg-(--color-tangerine-400) text-(--color-tangerine-950)' : 'bg-black/70 text-white'"
              aria-hidden="true"
            >
              <UIcon v-if="screen.hidden" name="i-tabler-eye-off" class="size-3" />
              <template v-else>{{ projectedNumber(screen) }}</template>
            </span>
          </button>
        </VueDraggable>
      </div>

      <span v-if="entry.all.length" class="shrink-0 text-sm font-semibold tabular-nums text-white/80" aria-live="polite">
        <template v-if="active && !active.hidden">{{ projectedNumber(active) }} / {{ visible.length }}</template>
        <template v-else>{{ visible.length }} {{ visible.length === 1 ? 'pantalla' : 'pantallas' }}</template>
      </span>

      <!-- The next element, as in the presenter: its own row across the
        whole width, with its first screen large enough to read. -->
      <button
        v-if="next"
        type="button"
        class="group mt-1 mb-1 flex basis-full items-stretch gap-3 rounded-2xl bg-white/8 p-2 text-start ring-1 ring-white/10 transition-colors hover:bg-white/14 hover:ring-white/25"
        :aria-label="`Siguiente: ${nextLook?.label} · ${nextTitle}`"
        @click="emit('next')"
      >
        <span class="flex min-w-0 flex-1 flex-col justify-between gap-2 py-1 ps-1.5">
          <span class="min-w-0">
            <span class="block text-[0.68rem] font-semibold uppercase tracking-wider text-white/60">{{ nextLook?.label }}</span>
            <span class="mt-1 flex min-w-0 items-start gap-2">
              <CultoMomentTile :item="next.item" size="sm" class="mt-0.5 shrink-0" />
              <span class="line-clamp-2 text-[0.95rem] font-semibold leading-snug">{{ nextTitle }}</span>
            </span>
          </span>
          <!-- «Siguiente», as in the presenter (NN/g: consistency; the name
            and the screen beside it say where it goes). -->
          <span class="inline-flex items-center gap-1.5 self-start rounded-full bg-(--color-tangerine-400) px-3 py-1 text-xs font-bold text-(--color-tangerine-950)" aria-hidden="true">
            Siguiente <UIcon name="i-tabler-arrow-right" class="size-3.5" />
            <kbd class="ms-0.5 rounded border border-(--color-tangerine-950)/30 px-1 font-sans text-[0.65rem]">→</kbd>
          </span>
        </span>
        <span class="w-[55%] max-w-80 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/15">
          <CultoScreen v-if="next.screens[0]" :screen="next.screens[0]" />
          <span v-else class="grid aspect-video place-items-center bg-white/10">
            <CultoMomentTile :item="next.item" />
          </span>
        </span>
      </button>
    </div>
  </section>
</template>

<style scoped>
/* A dark stage, like the projector's surroundings, in both themes. */
.stage {
  background: #17151d;
}
.no-bar {
  scrollbar-width: none;
}
.no-bar::-webkit-scrollbar {
  display: none;
}
</style>
