<script lang="ts" setup>
const emit = defineEmits(["update:open"]);

const route = useRoute();
const songStore = useSongStore();
const { toggle, isFavorite } = useFavoriteToggle();
const presentation = usePresentationStore();
const { show: toast } = useUndoToast();

const isReading = computed(() => route.path === "/");

// Section title outside the reading view, where the songbook chip and the
// hymn actions are what matters.
const titles: Record<string, string> = {
  "/search": "Buscar",
  "/fully-search": "Buscar",
  "/favorites": "Favoritos",
  "/settings": "Ajustes",
  "/about": "Acerca de",
  "/list": "Lista compartida",
};
const title = computed(() => titles[route.path] ?? "Acapela");

const current = computed(() => songStore.currentSong);
const currentIsFavorite = computed(() => (current.value ? isFavorite(current.value.songId) : false));
const inSetlist = computed(() => (current.value ? presentation.has(current.value.songId) : false));

function toggleSetlist() {
  const song = current.value;
  if (!song)
    return;
  if (presentation.has(song.songId)) {
    const before = presentation.items.slice();
    presentation.remove(song.songId);
    toast("Quitado de la lista del culto", {
      label: "Deshacer",
      run: () => presentation.replace({ title: presentation.title, items: before }),
    });
  }
  else {
    presentation.add(song.songId);
    toast(`Agregado a «${presentation.title}»`, {
      label: "Deshacer",
      run: () => presentation.remove(song.songId),
    });
  }
}
</script>

<template>
  <!-- Floating capsules over the content (no full-width bar): the brand on
       the left and, while reading, the hymn actions on the right. -->
  <header class="float-top fixed inset-x-2 sm:inset-x-3 z-30 h-12 flex items-center justify-between gap-2 pointer-events-none">
    <h1 class="sr-only">
      {{ isReading ? 'Acapela' : `${title} · Acapela` }}
    </h1>
    <NuxtLink
      to="/"
      class="pointer-events-auto h-12 inline-flex items-center gap-2 rounded-full bg-primary text-primary-content pl-2.5 pr-4 shadow-[0_10px_28px_-10px_rgb(40_20_150/0.65)]"
      aria-label="Acapela, ir a la lectura"
    >
      <Icon name="tabler:brand-netease-music" size="30" aria-hidden="true" />
      <span class="text-lg font-bold leading-none">Acapela</span>
    </NuxtLink>

    <div
      v-if="isReading"
      class="glass pointer-events-auto h-12 inline-flex items-center gap-0.5 rounded-full px-1"
    >
      <!-- Presentation is opened on purpose, only on large screens. -->
      <NuxtLink
        to="/fullscreen"
        class="btn btn-primary btn-sm h-9 rounded-full hidden lg:inline-flex mr-1"
      >
        <Icon name="tabler:presentation" size="18" />
        Proyectar
      </NuxtLink>
      <button
        v-if="current"
        type="button"
        class="btn btn-ghost btn-circle h-10 w-10"
        :class="{ 'text-secondary': currentIsFavorite }"
        :aria-label="currentIsFavorite ? `Quitar «${current.title}» de favoritos` : `Agregar «${current.title}» a favoritos`"
        :aria-pressed="currentIsFavorite"
        @click="toggle(current)"
      >
        <Icon :name="currentIsFavorite ? 'tabler:heart-filled' : 'tabler:heart'" size="24" />
      </button>
      <button
        v-if="current"
        type="button"
        class="btn btn-ghost btn-circle h-10 w-10"
        :class="{ 'text-primary': inSetlist }"
        :aria-label="inSetlist ? 'Quitar de la lista del culto' : 'Agregar a la lista del culto'"
        :title="inSetlist ? 'Quitar de la lista del culto' : 'Agregar a la lista del culto'"
        :aria-pressed="inSetlist"
        @click="toggleSetlist"
      >
        <Icon :name="inSetlist ? 'tabler:playlist-x' : 'tabler:playlist-add'" size="24" />
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-circle h-10 w-10"
        aria-label="Tamaño de letra"
        @click="emit('update:open')"
      >
        <Icon name="tabler:text-size" size="24" />
      </button>
    </div>
  </header>
</template>
