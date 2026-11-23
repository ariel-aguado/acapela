<script setup lang="ts">
import type { Songbook } from "~~/lib/types";

type Mode = "badge" | "overlay";

const props = withDefaults(defineProps<{
  /** "badge" renders the compact button + dropdown used in the header.
   *  "overlay" renders a full-screen modal used on first run before the user
   *  has picked a songbook. */
  mode?: Mode;
}>(), {
  mode: "badge",
});

const songbookStore = useSongbookStore();
const { status } = useSongbookWorker();
const { manifest, currentSongbook, currentId } = storeToRefs(songbookStore);
const { selectSongbook } = songbookStore;

const isOpen = ref(false);
const detailsRef = ref<HTMLDetailsElement | null>(null);

// Close the dropdown when the user clicks (or taps) outside the menu.
// The <details> element only toggles on its own summary click, so this
// listener fills the gap for clicks anywhere else on the page.
onClickOutside(detailsRef, () => {
  if (detailsRef.value?.open) {
    detailsRef.value.open = false;
    isOpen.value = false;
  }
});

async function onSelect(sb: Songbook) {
  // Close the dropdown immediately for snappy feedback; the worker keeps
  // loading in the background and the watch in songs.ts will update the UI.
  isOpen.value = false;
  if (detailsRef.value)
    detailsRef.value.open = false;
  if (sb.id === currentId.value)
    return;

  // No reset of songId: the last opened hymn is kept per songbook, and the
  // song store clamps it if it is out of range for the new songbook.
  await selectSongbook(sb.id);
}

function truncate(name: string, max = 12) {
  if (!name)
    return "";
  return name.length > max
    ? `${name.slice(0, max - 1)}…`
    : name;
}

function onDetailsToggle() {
  isOpen.value = detailsRef.value?.open ?? false;
}

// Close dropdown when the worker finishes loading (after a switch).
watch(status, (s) => {
  if (s === "ready") {
    isOpen.value = false;
    if (detailsRef.value)
      detailsRef.value.open = false;
  }
});
</script>

<template>
  <!-- Badge mode: compact button + dropdown for the navbar. -->
  <details
    v-if="props.mode === 'badge'"
    ref="detailsRef"
    class="dropdown dropdown-end"
    @toggle="onDetailsToggle"
  >
    <summary
      class="btn btn-sm rounded-full px-3 gap-1 bg-primary-content text-primary border-0"
      :class="{ 'menu-active': isOpen, 'opacity-70': status === 'loading' }"
      :aria-label="`Cambiar himnario. Actual: ${currentSongbook?.name ?? 'ninguno'}`"
    >
      <span class="font-semibold text-sm truncate max-w-20">
        {{ currentSongbook ? truncate(currentSongbook.name) : "…" }}
      </span>
      <Icon
        :name="isOpen ? 'tabler:chevron-up' : 'tabler:chevron-down'"
        size="16"
      />
    </summary>
    <ul class="dropdown-content menu menu-sm bg-base-100 text-base-content rounded-box shadow-xl z-9999 mt-2 w-56 p-2">
      <li class="menu-title">
        <span>Himnarios</span>
      </li>
      <li v-for="sb in manifest" :key="sb.id">
        <button
          type="button"
          class="flex items-center gap-2 py-3 px-4"
          :class="{ 'menu-active': sb.id === currentId }"
          :disabled="status === 'loading'"
          @click="onSelect(sb)"
        >
          <Icon
            v-if="sb.id === currentId"
            name="tabler:check"
            size="18"
            class="text-primary"
          />
          <span v-else class="w-4" />
          <span class="flex-1 text-left">{{ sb.name }}</span>
          <Icon
            v-if="status === 'loading' && sb.id === currentId"
            name="tabler:loader-2"
            size="18"
            class="animate-spin"
          />
        </button>
      </li>
    </ul>
  </details>

  <!-- Overlay mode: full-screen first-run picker. -->
  <div
    v-else
    class="songbook-overlay fixed inset-0 z-[60] flex items-center justify-center bg-base-100/95 backdrop-blur-sm p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="songbook-overlay-title"
  >
    <div class="songbook-overlay__box w-full max-w-md rounded-3xl bg-base-100 shadow-2xl border border-base-300 overflow-hidden flex flex-col">
      <!-- Brand header: the first thing a new person sees. -->
      <div class="bg-primary text-primary-content px-6 pt-6 pb-5 flex flex-col gap-2">
        <AppBrandMark class="size-11" />
        <h2 id="songbook-overlay-title" class="wordmark text-2xl leading-tight">
          Te damos la bienvenida a Acapela
        </h2>
        <p class="text-sm opacity-85">
          Elige el himnario de tu iglesia.
        </p>
      </div>

      <ul class="p-4 flex flex-col gap-2">
        <li v-for="sb in manifest" :key="sb.id">
          <button
            type="button"
            class="w-full flex items-center gap-3 rounded-2xl border border-base-300 px-4 min-h-16 text-start hover:bg-base-200 disabled:opacity-60"
            :class="{ 'border-primary bg-primary/5': sb.id === currentId }"
            :disabled="status === 'loading'"
            @click="onSelect(sb)"
          >
            <Icon
              :name="sb.id === currentId ? 'tabler:circle-check-filled' : 'tabler:book'"
              size="22"
              class="shrink-0"
              :class="sb.id === currentId ? 'text-primary' : 'opacity-60'"
            />
            <span class="flex-1 flex flex-col">
              <span class="font-semibold">{{ sb.name }}</span>
              <span v-if="sb.count" class="text-sm opacity-70">{{ sb.count }} himnos</span>
            </span>
            <Icon
              v-if="status === 'loading' && sb.id === currentId"
              name="tabler:loader-2"
              size="20"
              class="animate-spin"
            />
          </button>
        </li>
      </ul>

      <p class="px-6 pb-5 text-sm opacity-70 text-center">
        Lo puedes cambiar cuando quieras en Ajustes.
      </p>
    </div>
  </div>
</template>

<style scoped>
.songbook-overlay__box {
  animation: songbook-overlay-pop 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

@keyframes songbook-overlay-pop {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Remove the default disclosure triangle on the badge summary */
.dropdown > summary::-webkit-details-marker {
  display: none;
}
.dropdown > summary {
  list-style: none;
}
</style>
