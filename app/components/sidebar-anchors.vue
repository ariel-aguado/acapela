<script setup lang="ts">
// Side index of "Todos los himnos" (numbers or A–Z), drawn like the book
// index of Superbiblia (BookIndexRail): no capsule, a thin line on the right
// edge with the anchors floating to its left, faint at rest and stronger
// while the list scrolls or the index is used, and a handle on the anchor
// where the list is. Drag to scrub (like the iOS Contacts index), with a
// bubble next to the finger; arrows / Home / End from the keyboard.
type Props = {
  ids: number[] | string[];
  sections?: number;
};

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "jump", id: number | string): void;
}>();

const songStore = useSongStore();
const { currentTab } = storeToRefs(songStore);

const railEl = ref<HTMLElement | null>(null);
const anchors = ref<Array<number | string>>([]);
const dragging = ref(false);
const activeIndex = ref<number | null>(null);
// Keyboard position, separate from activeIndex (only alive while dragging).
const keyboardIndex = ref(0);
const focused = ref(false);
// Anchor of the first row visible at the top of the list.
const currentIndex = ref<number | null>(null);
// The list that scrolls (found on mount); read by updateCurrent().
let scrollParent: HTMLElement | null = null;

watch(
  () => [props.ids, props.sections, currentTab.value] as const,
  () => {
    anchors.value = currentTab.value === "byTitle"
      ? songStore.generateAnchorFromInitials(props.ids as string[])
      : songStore.generateAnchorsFromSongIds(props.ids as number[], props.sections ?? 15);
    updateCurrent();
  },
  { immediate: true, deep: true },
);

// ------------------------------------------------------ faint / active
const scrolling = ref(false);
let scrollIdleTimer: ReturnType<typeof setTimeout> | undefined;
const active = computed(() => dragging.value || focused.value || scrolling.value);

// ------------------------------------------------------ where the list is

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll")
      return node;
    node = node.parentElement;
  }
  return null;
}

function updateCurrent() {
  if (!scrollParent || anchors.value.length === 0) {
    currentIndex.value = null;
    return;
  }
  const top = scrollParent.getBoundingClientRect().top;
  const rows = scrollParent.querySelectorAll<HTMLElement>("[data-song-index]");
  let key: string | null = null;
  for (const row of rows) {
    if (row.getBoundingClientRect().bottom > top + 4) {
      key = row.dataset.songIndex ?? null;
      break;
    }
  }
  if (key === null) {
    currentIndex.value = null;
    return;
  }
  if (currentTab.value === "byTitle") {
    const i = (anchors.value as string[]).indexOf(key);
    currentIndex.value = i >= 0 ? i : null;
    return;
  }
  // Numbers: the last anchor at or before the first visible hymn.
  const n = Number(key);
  let found = 0;
  (anchors.value as number[]).forEach((a, i) => {
    if (a <= n)
      found = i;
  });
  currentIndex.value = found;
}

function onListScroll() {
  scrolling.value = true;
  clearTimeout(scrollIdleTimer);
  scrollIdleTimer = setTimeout(() => (scrolling.value = false), 1200);
  updateCurrent();
}

/** Where the handle goes: the anchor being dragged, or where the list is. */
const handleIndex = computed(() => activeIndex.value ?? currentIndex.value);
watch(handleIndex, (i) => {
  if (i !== null && !dragging.value)
    keyboardIndex.value = i;
});

// ------------------------------------------------------ dragging
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// Bubble to the left of the rail, at the finger's height; moved with
// transform so pointermove does not trigger layout.
const bubble = ref<{ top: number; right: number } | null>(null);

function handleAt(clientY: number) {
  const el = railEl.value;
  if (!el || anchors.value.length === 0)
    return;
  const rect = el.getBoundingClientRect();
  bubble.value = {
    top: clamp(clientY, rect.top, rect.bottom),
    right: window.innerWidth - rect.left + 24,
  };
  const ratio = clamp((clientY - rect.top) / rect.height, 0, 1);
  const i = clamp(Math.floor(ratio * anchors.value.length), 0, anchors.value.length - 1);
  if (i !== activeIndex.value) {
    activeIndex.value = i;
    keyboardIndex.value = i;
    const id = anchors.value[i];
    if (id != null)
      emit("jump", id);
  }
}

function onPointerDown(ev: PointerEvent) {
  dragging.value = true;
  // Jump first: setPointerCapture can throw in some environments.
  handleAt(ev.clientY);
  try {
    (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
  }
  catch {}
  ev.preventDefault();
}

function onPointerMove(ev: PointerEvent) {
  if (dragging.value)
    handleAt(ev.clientY);
}

function onPointerUp(ev: PointerEvent) {
  if (!dragging.value)
    return;
  dragging.value = false;
  activeIndex.value = null;
  try {
    (ev.currentTarget as HTMLElement).releasePointerCapture?.(ev.pointerId);
  }
  catch {}
  requestAnimationFrame(updateCurrent);
}

// ------------------------------------------------------ keyboard
function jumpTo(i: number) {
  const index = clamp(i, 0, anchors.value.length - 1);
  keyboardIndex.value = index;
  const id = anchors.value[index];
  if (id != null)
    emit("jump", id);
}

function onKeydown(e: KeyboardEvent) {
  if (anchors.value.length === 0)
    return;
  const map: Record<string, () => void> = {
    ArrowUp: () => jumpTo(keyboardIndex.value - 1),
    ArrowDown: () => jumpTo(keyboardIndex.value + 1),
    Home: () => jumpTo(0),
    End: () => jumpTo(anchors.value.length - 1),
  };
  const run = map[e.key];
  if (run) {
    e.preventDefault();
    run();
  }
}

onMounted(() => {
  const el = railEl.value;
  if (!el)
    return;
  scrollParent = findScrollParent(el);
  scrollParent?.addEventListener("scroll", onListScroll, { passive: true });
  el.addEventListener("pointerdown", onPointerDown);
  el.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
  updateCurrent();
});

onBeforeUnmount(() => {
  clearTimeout(scrollIdleTimer);
  scrollParent?.removeEventListener("scroll", onListScroll);
  const el = railEl.value;
  if (!el)
    return;
  el.removeEventListener("pointerdown", onPointerDown);
  el.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", onPointerUp);
});
</script>

<template>
  <div
    ref="railEl"
    class="anchor-rail relative flex h-full w-9 shrink-0 flex-col items-center py-2 outline-none"
    :class="{ 'anchor-rail--active': active, 'anchor-rail--dragging': dragging }"
    style="touch-action: none;"
    tabindex="0"
    role="slider"
    :aria-label="currentTab === 'byTitle' ? 'Ir a una letra' : 'Ir a un número'"
    :aria-valuemin="1"
    :aria-valuemax="anchors.length"
    :aria-valuenow="keyboardIndex + 1"
    :aria-valuetext="String(anchors[keyboardIndex] ?? '')"
    @keydown="onKeydown"
    @focus="focused = true"
    @blur="focused = false"
  >
    <span aria-hidden="true" class="anchor-rail__line" />
    <div
      v-for="a in anchors"
      :key="a"
      class="flex w-full flex-1 select-none items-center justify-end pr-2.5 text-[10px] font-semibold leading-none tabular-nums"
    >
      <span class="anchor-rail__label">{{ a }}</span>
    </div>
    <span
      v-if="handleIndex !== null"
      aria-hidden="true"
      class="anchor-rail__handle"
      :style="{ top: `calc(0.5rem + (100% - 1rem) * ${(handleIndex + 0.5) / Math.max(1, anchors.length)})` }"
    >{{ anchors[handleIndex] }}</span>
  </div>

  <Transition name="rail-bubble">
    <div
      v-if="dragging && activeIndex !== null && bubble"
      class="pointer-events-none fixed top-0 z-100 min-w-14 rounded-xl bg-primary px-3.5 py-1.5 text-center text-3xl font-bold text-primary-content shadow-lg will-change-transform"
      :style="{ right: `${bubble.right}px`, transform: `translate3d(0, calc(${bubble.top}px - 50%), 0)` }"
      aria-hidden="true"
    >
      {{ anchors[activeIndex] }}
    </div>
  </Transition>
</template>

<style scoped>
/* The line: the rail, against the right edge. */
.anchor-rail__line {
  position: absolute;
  top: 0;
  right: 2px;
  bottom: 0;
  width: 1px;
  border-radius: 999px;
  background: color-mix(in oklab, var(--color-base-content) 22%, transparent);
  opacity: 0.6;
  transition:
    opacity 0.3s ease,
    background-color 0.3s ease;
}
.anchor-rail__label {
  color: var(--color-primary);
  opacity: 0.4;
  transition: opacity 0.3s ease;
}
.anchor-rail__handle {
  position: absolute;
  right: 3px;
  display: flex;
  min-width: 1.25rem;
  height: 1.25rem;
  align-items: center;
  justify-content: center;
  padding-inline: 0.3rem;
  border-radius: 999px;
  background: var(--color-primary);
  color: var(--color-primary-content);
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  box-shadow: 0 1px 4px rgb(30 15 90 / 0.3);
  transform: translateY(-50%);
  opacity: 0.8;
  pointer-events: none;
  transition:
    opacity 0.3s ease,
    top 0.15s ease-out;
}
.anchor-rail--active .anchor-rail__handle,
.anchor-rail--active .anchor-rail__line {
  opacity: 1;
}
.anchor-rail--active .anchor-rail__label {
  opacity: 0.9;
}
.anchor-rail--dragging .anchor-rail__handle {
  transition: opacity 0.3s ease;
}
.anchor-rail--dragging .anchor-rail__line,
.anchor-rail:focus-visible .anchor-rail__line {
  background: var(--color-primary);
  width: 2px;
}
.rail-bubble-enter-active,
.rail-bubble-leave-active {
  transition: opacity 0.12s ease;
}
.rail-bubble-enter-from,
.rail-bubble-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .anchor-rail__handle,
  .anchor-rail__line,
  .anchor-rail__label {
    transition: none;
  }
}
</style>
