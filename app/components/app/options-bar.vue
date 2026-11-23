<script lang="ts" setup>
const emit = defineEmits(["update:open"]);

const route = useRoute();
const songStore = useSongStore();
const { songs, songId } = storeToRefs(songStore);
const { toggle, isFavorite } = useFavoriteToggle();
const presentation = usePresentationStore();
const { show: toast } = useUndoToast();
const { show: showGoTo } = useGoToHymn();

const isReading = computed(() => route.path === "/");

// Section name for screen readers outside the reading view.
const titles: Record<string, string> = {
  "/search": "Buscar",
  "/fully-search": "Buscar",
  "/favorites": "Favoritos",
  "/settings": "Ajustes",
  "/about": "Acerca de",
  "/list": "Lista compartida",
};
const title = computed(() => titles[route.path] ?? "Acapela");

// ------------------------------------------------------------ hymn capsule
// While reading, the top-left capsule shows the brand and the open hymn's
// number; tapping it opens "Ir al himno". The title is at the top of the
// lyric. Changing hymn: swipe, the # button, or ← → on a keyboard.
const current = computed(() => songStore.currentSong);
const total = computed(() => songs.value.length);
const number = computed(() => Number(songId.value) || 1);

// ------------------------------------------------------------ actions
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

// "⋯" menu: less frequent actions, each with its name written out.
const menuOpen = ref(false);
const menuRef = shallowRef<HTMLElement | null>(null);
const isLarge = useMediaQuery("(min-width: 1024px)");
onClickOutside(menuRef, () => (menuOpen.value = false));
onKeyStroke("Escape", () => (menuOpen.value = false));
watch(() => route.fullPath, () => (menuOpen.value = false));

function run(action: () => void) {
  menuOpen.value = false;
  action();
}
</script>

<template>
  <!-- Floating capsules over the content (no full-width bar). -->
  <header class="float-top fixed inset-x-2 sm:inset-x-3 z-30 h-12 flex items-center justify-between gap-2 pointer-events-none">
    <h1 class="sr-only">
      {{ isReading ? 'Acapela' : `${title} · Acapela` }}
    </h1>

    <!-- Reading: the open hymn -->
    <div
      v-if="isReading && current"
      class="pointer-events-auto h-12 inline-flex items-center rounded-full bg-primary text-primary-content px-1 shadow-[0_10px_28px_-10px_rgb(40_20_150/0.65)]"
    >
      <!-- Brand + hymn number; the title is already at the top of the lyric. -->
      <button
        type="button"
        class="h-10 pl-1.5 pr-1.5 inline-flex items-center gap-1.5 rounded-full hover:bg-white/10"
        :aria-label="`Acapela, himno ${number} de ${total}: ${current.title}. Ir a otro himno`"
        @click="showGoTo"
      >
        <Icon name="tabler:brand-netease-music" size="26" aria-hidden="true" />
        <span class="text-lg font-bold leading-none">Acapela</span>
        <span class="ml-0.5 min-w-8 h-7 px-2 inline-flex items-center justify-center rounded-full bg-white/20 text-base font-bold tabular-nums">
          {{ number }}
        </span>
      </button>
    </div>

    <!-- Other screens: the brand -->
    <NuxtLink
      v-else
      to="/"
      class="pointer-events-auto h-12 inline-flex items-center gap-2 rounded-full bg-primary text-primary-content pl-2.5 pr-4 shadow-[0_10px_28px_-10px_rgb(40_20_150/0.65)]"
      aria-label="Acapela, ir a la lectura"
    >
      <Icon name="tabler:brand-netease-music" size="30" aria-hidden="true" />
      <span class="text-lg font-bold leading-none">Acapela</span>
    </NuxtLink>

    <!-- Actions -->
    <div ref="menuRef" class="relative pointer-events-auto shrink-0">
      <div class="glass h-12 inline-flex items-center gap-0.5 rounded-full px-1">
        <button
          v-if="isReading && current"
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
          type="button"
          class="btn btn-ghost btn-circle h-10 w-10"
          aria-label="Más opciones"
          aria-haspopup="menu"
          :aria-expanded="menuOpen"
          @click="menuOpen = !menuOpen"
        >
          <Icon name="tabler:dots" size="24" />
        </button>
      </div>

      <Transition name="menu">
        <ul
          v-if="menuOpen"
          class="absolute right-0 top-[calc(100%+0.5rem)] w-64 rounded-2xl bg-base-100 text-base-content shadow-2xl border border-base-300 p-1.5 z-40"
          role="menu"
        >
          <li v-if="isReading && current" role="none">
            <button
              type="button"
              role="menuitem"
              class="menu-row"
              @click="run(toggleSetlist)"
            >
              <Icon :name="inSetlist ? 'tabler:playlist-x' : 'tabler:playlist-add'" size="22" aria-hidden="true" />
              {{ inSetlist ? 'Quitar de la lista del culto' : 'Agregar a la lista del culto' }}
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              class="menu-row"
              @click="run(() => emit('update:open'))"
            >
              <Icon name="tabler:letter-case" size="22" aria-hidden="true" />
              Apariencia
            </button>
          </li>
          <li v-if="isLarge" role="none">
            <NuxtLink
              to="/fullscreen"
              role="menuitem"
              class="menu-row"
              @click="menuOpen = false"
            >
              <Icon name="tabler:presentation" size="22" aria-hidden="true" />
              Proyectar
            </NuxtLink>
          </li>
          <li role="none">
            <NuxtLink
              to="/favorites?tab=lista"
              role="menuitem"
              class="menu-row"
              @click="menuOpen = false"
            >
              <Icon name="tabler:playlist" size="22" aria-hidden="true" />
              Ver la lista del culto
            </NuxtLink>
          </li>
        </ul>
      </Transition>
    </div>
  </header>
</template>

<style scoped>
.menu-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 2.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.75rem;
  text-align: start;
  font-size: 0.95rem;
}
.menu-row:hover,
.menu-row:focus-visible {
  background: var(--color-base-200);
  outline: none;
}
.menu-enter-active,
.menu-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
@media (prefers-reduced-motion: reduce) {
  .menu-enter-active,
  .menu-leave-active {
    transition: none;
  }
}
</style>
