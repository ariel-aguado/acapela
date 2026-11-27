<script lang="ts" setup>
const emit = defineEmits(["update:open"]);

const route = useRoute();
const songStore = useSongStore();
const { songs, songId } = storeToRefs(songStore);
const { toggle, isFavorite } = useFavoriteToggle();
const { show: showGoTo } = useGoToHymn();
const { projectHymn } = useProjectHymn();
// Culto has its own way to project ("Iniciar culto"), and a second
// projection button there would compete with it.
const showProject = computed(() => !route.path.startsWith("/culto"));

const isReading = computed(() => route.path === "/cantar");

// ------------------------------------------------------------ desktop bar
// Not fixed on a computer: it goes up with the page. Each page scrolls in
// its own full-height box (the layout is as tall as the window), so the bar
// moves up as far as that box has scrolled, until it is out of sight, and
// comes back with it. Lists inside a page (results, panels) do not move it:
// only a box that starts at the top of the window and fills most of it.
const desktopBar = useTemplateRef<HTMLElement>("desktopBar");
const isDesktop = useMediaQuery("(min-width: 64rem)");
const barShift = ref(0);
function onPageScroll(event: Event) {
  const el = event.target;
  if (!isDesktop.value || !(el instanceof HTMLElement))
    return;
  const box = el.getBoundingClientRect();
  if (box.top > 1 || box.height < window.innerHeight * 0.6)
    return;
  const bar = desktopBar.value;
  const away = bar
    ? bar.offsetTop + bar.offsetHeight + 8
    : 96;
  barShift.value = Math.min(el.scrollTop, away);
}
useEventListener(document, "scroll", onPageScroll, { capture: true, passive: true });
// A new page starts at its top.
watch(() => route.path, () => {
  barShift.value = 0;
});

// Section name for screen readers outside the reading view.
const titles: Record<string, string> = {
  "/": "Inicio",
  "/search": "Buscar",
  "/fully-search": "Buscar",
  "/himno": "Himno de otro himnario",
  "/favorites": "Favoritos",
  "/settings": "Ajustes",
  "/about": "Acerca de",
  "/culto": "Culto",
};
const title = computed(() => titles[route.path] ?? "Acapela");

// ------------------------------------------------------------ hymn capsule
// While reading, the brand comes with the open hymn's number; tapping it
// opens "Ir al himno". The title is at the top of the lyric. Changing hymn:
// swipe, the # button, or ← → on a keyboard.
const current = computed(() => songStore.currentSong);
const total = computed(() => songs.value.length);
const number = computed(() => Number(songId.value) || 1);

const currentIsFavorite = computed(() => (current.value
  ? isFavorite(current.value.songId)
  : false));

// ------------------------------------------------------------ desktop nav
// On large screens everything lives in one top bar (Diaconeo's Boltshift
// header): the brand on the left, the sections as a segmented control in
// the middle (active in black; lime in dark mode) and the actions on the
// right. The bottom navigation is only for the phone. Culto is a desktop
// task, so it only appears here.
const sections = [
  {
    to: "/cantar",
    label: "Cantar",
    icon: "i-tabler-music",
    match: ["/cantar"],
  },
  {
    to: "/search",
    label: "Buscar",
    icon: "i-tabler-search",
    match: ["/search", "/fully-search", "/himno"],
  },
  {
    to: "/favorites",
    label: "Favoritos",
    icon: "i-tabler-heart",
    match: ["/favorites"],
  },
  {
    to: "/culto",
    label: "Culto",
    icon: "i-tabler-list-details",
    match: ["/culto"],
  },
  {
    to: "/settings",
    label: "Ajustes",
    icon: "i-tabler-settings",
    match: ["/settings", "/about"],
  },
];
function isActive(match: string[]) {
  return match.includes(route.path);
}
</script>

<template>
  <h1 class="sr-only">
    {{ isReading ? 'Acapela' : `${title} · Acapela` }}
  </h1>

  <!-- Phone and tablet: floating capsules over the content. -->
  <header class="lg:hidden float-top fixed inset-x-2 sm:inset-x-3 z-30 h-12 flex items-center justify-between gap-2 pointer-events-none">
    <!-- Reading: the open hymn -->
    <div
      v-if="isReading && current"
      class="glass pointer-events-auto h-12 inline-flex items-center rounded-full px-1"
    >
      <!-- The brand goes home (as in Superbiblia); the hymn number opens
        "Ir al himno". -->
      <NuxtLink
        to="/"
        class="h-10 pl-0.5 pr-2 inline-flex items-center gap-2 rounded-full hover:bg-(--control-bg)"
        aria-label="Acapela, ir al inicio"
      >
        <span class="brand-dot size-9" aria-hidden="true"><AppBrandMark class="size-6" /></span>
        <span class="wordmark text-[1.2rem] leading-none text-highlighted">Acapela</span>
      </NuxtLink>
      <button
        type="button"
        class="ml-0.5 min-w-10 h-10 px-1 inline-flex items-center justify-center rounded-full hover:bg-(--control-bg)"
        :aria-label="`Himno ${number} de ${total}: ${current.title}. Ir a otro himno`"
        @click="showGoTo"
      >
        <span class="min-w-8 h-7 px-2 inline-flex items-center justify-center rounded-full bg-(--well-bg) text-highlighted text-base font-bold tabular-nums">
          {{ number }}
        </span>
      </button>
    </div>

    <!-- Other screens: the brand -->
    <NuxtLink
      v-else
      to="/"
      class="glass pointer-events-auto h-12 inline-flex items-center gap-2 rounded-full pl-1.5 pr-4"
      aria-label="Acapela, ir al inicio"
    >
      <span class="brand-dot size-9" aria-hidden="true"><AppBrandMark class="size-6" /></span>
      <span class="wordmark text-[1.2rem] leading-none text-highlighted">Acapela</span>
    </NuxtLink>

    <!-- Actions: each its own button, no hidden "⋯" menu. -->
    <div class="glass pointer-events-auto shrink-0 h-12 inline-flex items-center gap-0.5 rounded-full px-1">
      <UButton
        v-if="isReading && current"
        :color="currentIsFavorite ? 'secondary' : 'neutral'"
        variant="ghost"
        square
        class="size-10 justify-center"
        :icon="currentIsFavorite ? 'i-tabler-heart-filled' : 'i-tabler-heart'"
        :ui="{ leadingIcon: 'size-6' }"
        :aria-label="currentIsFavorite ? `Quitar «${current.title}» de favoritos` : `Agregar «${current.title}» a favoritos`"
        :aria-pressed="currentIsFavorite"
        @click="toggle(current)"
      />
      <UButton
        color="neutral"
        variant="ghost"
        square
        class="size-10 justify-center"
        icon="i-tabler-letter-case"
        :ui="{ leadingIcon: 'size-6.5' }"
        aria-label="Apariencia: tamaño de letra y tema"
        title="Apariencia"
        aria-haspopup="dialog"
        @click="emit('update:open')"
      />
    </div>
  </header>

  <!-- Desktop: one top bar with everything. -->
  <header
    ref="desktopBar"
    class="hidden lg:block float-top fixed inset-x-4 z-30"
    :style="barShift ? { transform: `translateY(${-barShift}px)` } : undefined"
  >
    <!-- As wide as the pages' content: max-w-7xl less its px-4. -->
    <div class="mx-auto max-w-[78rem] h-16 flex items-center gap-3 rounded-full bg-default shadow-card ring ring-(--ui-border-muted) px-2">
      <!-- Brand (home) and, while reading, the open hymn -->
      <div class="flex-1 min-w-0 flex items-center gap-1">
        <NuxtLink
          to="/"
          class="h-12 pl-1 pr-3 inline-flex items-center gap-2.5 rounded-full hover:bg-(--control-bg)"
          aria-label="Acapela, ir al inicio"
        >
          <span class="brand-dot size-10" aria-hidden="true"><AppBrandMark class="size-7" /></span>
          <span class="wordmark text-[1.3rem] leading-none text-highlighted">Acapela</span>
        </NuxtLink>
        <button
          v-if="isReading && current"
          type="button"
          class="min-w-0 h-12 pl-1.5 pr-3 inline-flex items-center gap-2 rounded-full hover:bg-(--control-bg)"
          :aria-label="`Himno ${number} de ${total}: ${current.title}. Ir a otro himno`"
          @click="showGoTo"
        >
          <span class="min-w-9 h-8 px-2 inline-flex items-center justify-center rounded-full bg-(--well-bg) text-highlighted text-base font-bold tabular-nums">
            {{ number }}
          </span>
          <span class="hidden xl:block truncate text-sm text-muted max-w-56">{{ current.title }}</span>
        </button>
      </div>

      <!-- Sections: segmented control -->
      <nav aria-label="Navegación principal">
        <ul class="flex items-center gap-1 rounded-full bg-(--well-bg) p-1">
          <li v-for="item in sections" :key="item.to">
            <NuxtLink
              :to="item.to"
              :title="item.label"
              class="flex h-10 items-center gap-2 rounded-full px-3 xl:px-4 text-sm font-medium transition-colors"
              :class="isActive(item.match)
                ? 'bg-neutral-950 text-white dark:bg-lime-300 dark:text-neutral-950'
                : 'text-toned hover:bg-default hover:text-highlighted'"
              :aria-current="isActive(item.match) ? 'page' : undefined"
            >
              <UIcon :name="item.icon" class="size-4.5" />
              <span class="sr-only xl:not-sr-only">{{ item.label }}</span>
            </NuxtLink>
          </li>
        </ul>
      </nav>

      <!-- Actions -->
      <div class="flex-1 min-w-0 flex items-center justify-end gap-2">
        <div class="flex items-center gap-1 rounded-full bg-(--well-bg) p-1">
          <UButton
            v-if="isReading && current"
            :color="currentIsFavorite ? 'secondary' : 'neutral'"
            variant="ghost"
            square
            class="size-10 justify-center bg-default hover:bg-default/70"
            :icon="currentIsFavorite ? 'i-tabler-heart-filled' : 'i-tabler-heart'"
            :ui="{ leadingIcon: 'size-5.5' }"
            :aria-label="currentIsFavorite ? `Quitar «${current.title}» de favoritos` : `Agregar «${current.title}» a favoritos`"
            :aria-pressed="currentIsFavorite"
            @click="toggle(current)"
          />
          <UButton
            color="neutral"
            variant="ghost"
            square
            class="size-10 justify-center bg-default hover:bg-default/70"
            icon="i-tabler-hash"
            :ui="{ leadingIcon: 'size-5.5' }"
            aria-label="Ir al himno"
            title="Ir al himno (G)"
            @click="showGoTo"
          />
          <UButton
            color="neutral"
            variant="ghost"
            square
            class="size-10 justify-center bg-default hover:bg-default/70"
            icon="i-tabler-letter-case"
            :ui="{ leadingIcon: 'size-6' }"
            aria-label="Apariencia: tamaño de letra y tema"
            title="Apariencia"
            aria-haspopup="dialog"
            @click="emit('update:open')"
          />
        </div>
        <!-- The primary action: a violet pill with its icon in a white
          circle (Boltshift). It projects the open hymn on the one
          projection console, as a free projection. -->
        <button
          v-if="showProject"
          type="button"
          class="h-12 pl-1.5 pr-5 inline-flex items-center gap-2.5 rounded-full bg-(--color-iris-500) text-white text-sm font-semibold hover:bg-(--color-iris-600) transition-colors"
          @click="projectHymn()"
        >
          <span class="size-9 grid place-items-center rounded-full bg-white text-(--color-iris-500)" aria-hidden="true">
            <UIcon name="i-tabler-presentation" class="size-5" />
          </span>
          Proyectar himno
        </button>
      </div>
    </div>
  </header>
</template>
