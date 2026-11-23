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
// The songbook matters wherever hymns are listed.
const showSongbook = computed(() => ["/", "/search", "/favorites"].includes(route.path));

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
  <header
    class="navbar w-full min-h-16 h-16 bg-primary shadow-[0_4px_20px_0_rgba(0,0,0,0.35)] text-primary-content py-0 px-2 relative z-30"
  >
    <div class="navbar-start gap-2 min-w-0 flex-1">
      <Icon
        v-if="isReading"
        name="tabler:brand-netease-music"
        size="36"
        class="shrink-0"
        aria-hidden="true"
      />
      <h1 v-if="!isReading" class="text-xl font-bold pl-2 truncate">
        {{ title }}
      </h1>
      <span v-else class="sr-only">Acapela</span>
      <AppSongbookSelector v-if="showSongbook" mode="badge" />
    </div>
    <div class="navbar-end flex items-center gap-1 w-auto">
      <template v-if="isReading">
        <!-- Presentation is opened on purpose, only on large screens. -->
        <NuxtLink
          to="/fullscreen"
          class="btn btn-sm rounded-full bg-primary-content text-primary border-0 hidden lg:inline-flex mr-1"
        >
          <Icon name="tabler:presentation" size="18" />
          Proyectar
        </NuxtLink>
        <button
          v-if="current"
          type="button"
          class="btn btn-circle btn-ghost h-12 w-12"
          :aria-label="currentIsFavorite ? `Quitar «${current.title}» de favoritos` : `Agregar «${current.title}» a favoritos`"
          :aria-pressed="currentIsFavorite"
          @click="toggle(current)"
        >
          <Icon :name="currentIsFavorite ? 'tabler:heart-filled' : 'tabler:heart'" size="26" />
        </button>
        <button
          v-if="current"
          type="button"
          class="btn btn-circle btn-ghost h-12 w-12"
          :aria-label="inSetlist ? 'Quitar de la lista del culto' : 'Agregar a la lista del culto'"
          :title="inSetlist ? 'Quitar de la lista del culto' : 'Agregar a la lista del culto'"
          :aria-pressed="inSetlist"
          @click="toggleSetlist"
        >
          <Icon :name="inSetlist ? 'tabler:playlist-x' : 'tabler:playlist-add'" size="26" />
        </button>
        <button
          type="button"
          class="btn btn-circle btn-ghost h-12 w-12"
          aria-label="Tamaño de letra"
          @click="emit('update:open')"
        >
          <Icon name="tabler:text-size" size="26" />
        </button>
      </template>
    </div>
  </header>
</template>
