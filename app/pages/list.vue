<script lang="ts" setup>
// Opening a shared "Lista del culto" link: /list?b=<songbook>&h=4,12,7&t=Domingo
const route = useRoute();
const songbookStore = useSongbookStore();
const presentation = usePresentationStore();
const { manifest, currentId } = storeToRefs(songbookStore);
const { songs } = storeToRefs(useSongStore());
const { status } = useSongbookWorker();

const bookId = computed(() => (typeof route.query.b === "string" ? route.query.b : ""));
const title = computed(() => (typeof route.query.t === "string" && route.query.t.trim()) || "Lista del culto");
const ids = computed(() =>
  (typeof route.query.h === "string" ? route.query.h : "")
    .split(",")
    .map(n => Number.parseInt(n, 10))
    .filter(n => Number.isInteger(n) && n > 0)
    .slice(0, 60),
);
const book = computed(() => manifest.value.find(b => b.id === bookId.value) ?? null);
const sameBook = computed(() => !bookId.value || bookId.value === currentId.value);
const busy = ref(false);

function titleOf(id: number) {
  return sameBook.value ? songs.value[id - 1]?.title ?? "" : "";
}

async function useList() {
  busy.value = true;
  try {
    if (!sameBook.value && book.value)
      await songbookStore.selectSongbook(book.value.id);
    presentation.replaceFor(book.value?.id ?? currentId.value, { title: title.value, items: ids.value });
    await navigateTo({ path: "/favorites", query: { tab: "lista" } });
  }
  finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="h-[calc(100dvh-64px-52px)] overflow-y-auto">
    <div class="w-full max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4">
      <template v-if="ids.length && (book || !bookId)">
        <div>
          <p class="text-xs font-bold uppercase tracking-wider opacity-70">
            Te compartieron una lista
          </p>
          <h2 class="text-2xl font-bold mt-1">
            {{ title }}
          </h2>
          <p class="opacity-80 mt-1">
            {{ ids.length }} {{ ids.length === 1 ? 'himno' : 'himnos' }}<template v-if="book">
              del himnario {{ book.name }}
            </template>
          </p>
        </div>

        <ol class="rounded-box border border-base-300 divide-y divide-base-300">
          <li v-for="(id, i) in ids" :key="`${id}-${i}`" class="flex items-center gap-3 px-4 py-2.5">
            <span class="w-6 text-xs opacity-60 tabular-nums">{{ i + 1 }}.</span>
            <span class="w-9 text-end text-lg font-semibold text-primary tabular-nums">{{ id }}</span>
            <span class="flex-1 truncate font-semibold">{{ titleOf(id) }}</span>
          </li>
        </ol>

        <p v-if="!sameBook && book" class="text-sm rounded-box bg-warning/15 px-4 py-3">
          Esta lista es del himnario <strong>{{ book.name }}</strong>. Al usarla, Acapela cambiará a ese himnario.
          Tus favoritos de cada himnario se conservan.
        </p>
        <p v-if="presentation.items.length && sameBook" class="text-sm opacity-80">
          Reemplazará tu lista actual ({{ presentation.items.length }} {{ presentation.items.length === 1 ? 'himno' : 'himnos' }}).
        </p>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="btn btn-primary h-11"
            :disabled="busy || status === 'loading'"
            @click="useList"
          >
            <span v-if="busy" class="loading loading-spinner loading-sm" />
            {{ !sameBook && book ? `Cambiar a ${book.name} y usar la lista` : 'Usar esta lista' }}
          </button>
          <NuxtLink to="/" class="btn btn-ghost h-11">
            Ahora no
          </NuxtLink>
        </div>
      </template>

      <div v-else class="flex flex-col items-center text-center gap-3 py-10">
        <Icon
          name="tabler:alert-triangle"
          size="40"
          class="text-warning"
          aria-hidden="true"
        />
        <p class="text-lg font-bold">
          Este enlace de lista no es válido
        </p>
        <p class="opacity-80 max-w-sm">
          Puede que se haya copiado incompleto. Pide que te lo envíen de nuevo.
        </p>
        <NuxtLink to="/" class="btn btn-primary">
          Volver al himno
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
