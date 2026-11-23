<script setup lang="ts">
// "Ir al himno": shared by the reading view (index) and the presentation
// view (fullscreen). Shows the valid range up front and a live preview of
// the hymn title while typing, so the user recognizes the hymn before
// jumping instead of discovering a mistake afterwards.
const props = withDefaults(defineProps<{
  open: boolean;
  /** Dialog title. */
  heading?: string;
  /** Submit button label. */
  actionLabel?: string;
}>(), {
  heading: "Ir al himno",
  actionLabel: "Ir al himno",
});
const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "go", songId: number): void;
}>();

const songStore = useSongStore();
const songbookStore = useSongbookStore();
const { songs } = storeToRefs(songStore);
const { currentSongbook } = storeToRefs(songbookStore);

const inputComp = useTemplateRef<{ inputRef: HTMLInputElement | null }>("inputComp");
const value = ref("");

const total = computed(() => songs.value.length);
const songbookName = computed(() => currentSongbook.value?.name ?? "este himnario");
const number = computed(() => (value.value
  ? Number(value.value)
  : null));

const error = computed(() => {
  const n = number.value;
  if (n === null)
    return "";
  if (n < 1)
    return `Escribe un número del 1 al ${total.value}`;
  if (n > total.value)
    return `${songbookName.value} tiene ${total.value} himnos`;
  return "";
});

const preview = computed(() => {
  const n = number.value;
  if (n === null || error.value)
    return null;
  return songs.value[n - 1] ?? null;
});

const canGo = computed(() => preview.value !== null);

function onInput(e: Event) {
  // Digits only; type="text" + inputmode="numeric" avoids the iOS number
  // keyboard with signs and the desktop spinner arrows.
  const el = e.target as HTMLInputElement;
  const digits = el.value.replace(/\D/g, "").slice(0, 4);
  value.value = digits;
  if (el.value !== digits)
    el.value = digits;
}

// When the dialog closes, focus goes back to the button that opened it (the
// # in the bottom bar, the hymn capsule), which then shows a focus ring on
// touch screens. Skip that when the dialog was used with a finger or mouse;
// keep it for keyboard users, who need to see where they are.
let lastInput: "pointer" | "keyboard" = "pointer";
function onPointer() {
  lastInput = "pointer";
}
function onKey(e: KeyboardEvent) {
  // Only Tab: phones send Enter from the on-screen "Ir" key.
  if (e.key === "Tab")
    lastInput = "keyboard";
}
onMounted(() => {
  document.addEventListener("pointerdown", onPointer, { capture: true, passive: true });
  document.addEventListener("keydown", onKey, { capture: true });
});
onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onPointer, { capture: true });
  document.removeEventListener("keydown", onKey, { capture: true });
});

const content = {
  // Focus the number field (not the close button) so phones raise the keyboard.
  onOpenAutoFocus(e: Event) {
    e.preventDefault();
    requestAnimationFrame(() => inputComp.value?.inputRef?.focus());
  },
  onCloseAutoFocus(e: Event) {
    if (lastInput === "pointer")
      e.preventDefault();
  },
};

const open = computed({
  get: () => props.open,
  set: v => emit("update:open", v),
});

// A bottom sheet on phones (near the thumb and the keyboard), a centred
// dialog on larger screens.
const isPhone = useMediaQuery("(max-width: 639px)");
const UDrawer = resolveComponent("UDrawer");
const UModal = resolveComponent("UModal");

function close() {
  open.value = false;
}

function submit() {
  if (!canGo.value || number.value === null)
    return;
  emit("go", number.value);
  close();
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen)
      value.value = "";
  },
);
</script>

<template>
  <component
    :is="isPhone ? UDrawer : UModal"
    v-model:open="open"
    :title="heading"
    description="Escribe el número del himno"
    :content="content"
    :ui="{ description: 'sr-only' }"
  >
    <template #body>
      <form id="go-to-hymn-form" class="flex flex-col gap-3" @submit.prevent="submit">
        <label for="go-to-hymn-input" class="text-sm">
          Número del himno
        </label>
        <UInput
          id="go-to-hymn-input"
          ref="inputComp"
          :model-value="value"
          name="songId"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          enterkeyhint="go"
          autocomplete="off"
          size="xl"
          class="w-full"
          :color="error ? 'error' : 'primary'"
          :highlight="!!error"
          :ui="{ base: 'h-14 text-2xl font-bold tabular-nums' }"
          :aria-invalid="!!error"
          aria-describedby="go-to-hymn-hint"
          @input="onInput"
        />
        <p
          id="go-to-hymn-hint"
          class="text-sm -mt-1"
          :class="error ? 'text-error' : 'text-muted'"
          aria-live="polite"
        >
          {{ error || `Del 1 al ${total} en ${songbookName}` }}
        </p>

        <!-- Live preview: recognize the hymn before jumping -->
        <div
          class="min-h-16 rounded-2xl bg-muted px-4 py-3 flex items-center gap-3"
          aria-live="polite"
        >
          <template v-if="preview">
            <span class="text-2xl font-bold text-primary tabular-nums min-w-10">{{ preview.songId }}</span>
            <span class="flex flex-col min-w-0">
              <span class="font-semibold truncate">{{ preview.title }}</span>
            </span>
          </template>
          <span v-else class="text-sm text-muted">
            Aquí verás el título del himno
          </span>
        </div>
      </form>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          color="neutral"
          variant="ghost"
          size="lg"
          label="Cancelar"
          @click="close"
        />
        <UButton
          type="submit"
          form="go-to-hymn-form"
          size="lg"
          :label="actionLabel"
          :disabled="!canGo"
        />
      </div>
    </template>
  </component>
</template>
