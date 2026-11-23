<script setup lang="ts">
// "Ir al himno": shared by the reading view (index) and the presentation
// view (fullscreen). Shows the valid range up front and a live preview of
// the hymn title while typing, so the user recognizes the hymn before
// jumping instead of discovering a mistake afterwards.
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "go", songId: number): void;
}>();

const songStore = useSongStore();
const songbookStore = useSongbookStore();
const { songs } = storeToRefs(songStore);
const { currentSongbook } = storeToRefs(songbookStore);

const dialogRef = shallowRef<HTMLDialogElement | null>(null);
const inputRef = shallowRef<HTMLInputElement | null>(null);
const value = ref("");

const total = computed(() => songs.value.length);
const songbookName = computed(() => currentSongbook.value?.name ?? "este himnario");
const number = computed(() => (value.value ? Number(value.value) : null));

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

function close() {
  emit("update:open", false);
}

function submit() {
  if (!canGo.value || number.value === null)
    return;
  emit("go", number.value);
  close();
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      value.value = "";
      await nextTick();
      if (!dialogRef.value?.open)
        dialogRef.value?.showModal();
      // Focus after the dialog is shown so mobile browsers raise the keyboard.
      requestAnimationFrame(() => inputRef.value?.focus());
    }
    else if (dialogRef.value?.open) {
      dialogRef.value.close();
    }
  },
);
</script>

<template>
  <dialog
    ref="dialogRef"
    class="modal modal-bottom sm:modal-middle"
    aria-labelledby="go-to-hymn-title"
    @close="close"
  >
    <div class="modal-box">
      <form class="flex flex-col gap-3" @submit.prevent="submit">
        <div class="flex justify-between items-center">
          <h3 id="go-to-hymn-title" class="text-lg font-bold">
            Ir al himno
          </h3>
          <button
            type="button"
            class="btn btn-ghost btn-circle"
            aria-label="Cerrar"
            @click="close"
          >
            <Icon name="tabler:x" size="22" />
          </button>
        </div>

        <label for="go-to-hymn-input" class="text-sm">
          Número del himno
        </label>
        <input
          id="go-to-hymn-input"
          ref="inputRef"
          :value="value"
          name="songId"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          enterkeyhint="go"
          autocomplete="off"
          class="input input-lg w-full text-2xl font-bold tabular-nums"
          :class="{ 'input-error': !!error }"
          :aria-invalid="!!error"
          aria-describedby="go-to-hymn-hint"
          @input="onInput"
        >
        <p
          id="go-to-hymn-hint"
          class="text-sm -mt-1"
          :class="error ? 'text-error' : 'opacity-70'"
          aria-live="polite"
        >
          {{ error || `Del 1 al ${total} en ${songbookName}` }}
        </p>

        <!-- Live preview: recognize the hymn before jumping -->
        <div
          class="min-h-16 rounded-box bg-base-200 px-4 py-3 flex items-center gap-3"
          aria-live="polite"
        >
          <template v-if="preview">
            <span class="text-2xl font-bold text-primary tabular-nums min-w-10">{{ preview.songId }}</span>
            <span class="flex flex-col min-w-0">
              <span class="font-semibold truncate">{{ preview.title }}</span>
            </span>
          </template>
          <span v-else class="text-sm opacity-60">
            Aquí verás el título del himno
          </span>
        </div>

        <div class="flex justify-end gap-2 mt-1">
          <button type="button" class="btn btn-ghost" @click="close">
            Cancelar
          </button>
          <button type="submit" class="btn btn-primary" :disabled="!canGo">
            Ir al himno
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button type="submit" aria-label="Cerrar">
        Cerrar
      </button>
    </form>
  </dialog>
</template>
