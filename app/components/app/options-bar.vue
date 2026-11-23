<script lang="ts" setup>
const emit = defineEmits(["update:open"]);

const route = useRoute();
const songStore = useSongStore();
const { songs, songId } = storeToRefs(songStore);
const { toggle, isFavorite } = useFavoriteToggle();
const { show: showGoTo } = useGoToHymn();

const isReading = computed(() => route.path === "/");

// Section name for screen readers outside the reading view.
const titles: Record<string, string> = {
  "/search": "Buscar",
  "/fully-search": "Buscar",
  "/favorites": "Favoritos",
  "/settings": "Ajustes",
  "/about": "Acerca de",
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
// Only two actions, so each is its own button instead of a "⋯" menu (no
// hidden options): Apariencia (Aa) everywhere and, on large screens where
// a projector is plugged in, Proyectar with its label.
const currentIsFavorite = computed(() => (current.value ? isFavorite(current.value.songId) : false));
const isLarge = useMediaQuery("(min-width: 1024px)");
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
      class="pointer-events-auto h-12 inline-flex items-center rounded-full bg-primary text-primary-content px-1 shadow-[0_10px_28px_-10px_var(--brand-shadow)]"
    >
      <!-- Brand + hymn number; the title is already at the top of the lyric. -->
      <button
        type="button"
        class="h-10 pl-1.5 pr-1.5 inline-flex items-center gap-1.5 rounded-full hover:bg-primary-content/10"
        :aria-label="`Acapela, himno ${number} de ${total}: ${current.title}. Ir a otro himno`"
        @click="showGoTo"
      >
        <AppBrandMark class="size-7" />
        <span class="wordmark text-[1.2rem] leading-none">Acapela</span>
        <span class="ml-0.5 min-w-8 h-7 px-2 inline-flex items-center justify-center rounded-full bg-primary-content/15 text-base font-bold tabular-nums">
          {{ number }}
        </span>
      </button>
    </div>

    <!-- Other screens: the brand -->
    <NuxtLink
      v-else
      to="/"
      class="pointer-events-auto h-12 inline-flex items-center gap-2 rounded-full bg-primary text-primary-content pl-2.5 pr-4 shadow-[0_10px_28px_-10px_var(--brand-shadow)]"
      aria-label="Acapela, ir a la lectura"
    >
      <AppBrandMark class="size-8" />
      <span class="wordmark text-[1.2rem] leading-none">Acapela</span>
    </NuxtLink>

    <!-- Actions -->
    <div class="glass pointer-events-auto shrink-0 h-12 inline-flex items-center gap-0.5 rounded-full px-1">
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
        aria-label="Apariencia: tamaño de letra y tema"
        title="Apariencia"
        aria-haspopup="dialog"
        @click="emit('update:open')"
      >
        <Icon name="tabler:letter-case" size="26" />
      </button>
      <NuxtLink
        v-if="isLarge"
        to="/fullscreen"
        class="btn btn-ghost h-10 rounded-full px-3 gap-1.5 font-semibold"
      >
        <Icon name="tabler:presentation" size="22" aria-hidden="true" />
        Proyectar
      </NuxtLink>
    </div>
  </header>
</template>
