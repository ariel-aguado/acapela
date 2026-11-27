<script setup lang="ts">
import type { Songbook } from "~~/lib/types";

// First run: pick the songbook before anything else (no songbook chosen
// yet). Changing it later is done in Ajustes.
const songbookStore = useSongbookStore();
const { status } = useSongbookWorker();
const { manifest, currentId } = storeToRefs(songbookStore);
const { selectSongbook } = songbookStore;

async function onSelect(sb: Songbook) {
  if (sb.id === currentId.value)
    return;
  await selectSongbook(sb.id);
}
</script>

<template>
  <!-- Full-screen first-run picker. -->
  <div
    class="songbook-overlay fixed inset-0 z-[60] flex items-center justify-center bg-default/95 backdrop-blur-sm p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="songbook-overlay-title"
  >
    <div class="songbook-overlay__box w-full max-w-md rounded-3xl bg-default shadow-float overflow-hidden flex flex-col">
      <!-- Brand header: the first thing a new person sees. -->
      <div class="bg-primary text-inverted px-6 pt-6 pb-5 flex flex-col gap-2">
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
            class="w-full flex items-center gap-3 rounded-2xl border border-default px-4 min-h-16 text-start hover:bg-muted disabled:opacity-60"
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
</style>
