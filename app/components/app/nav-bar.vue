<script lang="ts" setup>
const route = useRoute();
const songStore = useSongStore();
const { open: goToOpen, show: showGoTo } = useGoToHymn();

// Icon + visible text label for every destination. "Ir al himno", the most
// frequent task of a service, sits in the middle, in the thumb zone, on
// every screen.
const left = [
  {
    to: "/cantar",
    label: "Cantar",
    icon: "tabler:music",
    match: ["/cantar", "/fullscreen"],
  },
  {
    to: "/search",
    label: "Buscar",
    icon: "tabler:search",
    match: ["/search", "/fully-search"],
  },
];
const right = [
  {
    to: "/favorites",
    label: "Favoritos",
    icon: "tabler:heart",
    match: ["/favorites"],
  },
  {
    to: "/settings",
    label: "Ajustes",
    icon: "tabler:settings",
    match: ["/settings", "/about"],
  },
];

function isActive(match: string[]) {
  return match.includes(route.path);
}

function goTo(id: number) {
  songStore.navigateToSong(id);
}
</script>

<template>
  <nav
    class="glass float-bottom fixed left-1/2 -translate-x-1/2 z-30 w-[calc(100%-1.5rem)] max-w-md h-[60px] rounded-full flex items-stretch px-1.5"
    aria-label="Navegación principal"
  >
    <NuxtLink
      v-for="item in left"
      :key="item.to"
      :to="item.to"
      class="nav-item"
      :class="isActive(item.match) ? 'nav-item--on' : ''"
      :aria-current="isActive(item.match) ? 'page' : undefined"
    >
      <Icon :name="item.icon" size="22" />
      <span>{{ item.label }}</span>
    </NuxtLink>

    <!-- "Ir al himno": same layout as its neighbours (an icon-high slot,
      then the label), so the labels line up; the round # button is larger
      and rises above the bar on purpose. -->
    <button
      type="button"
      class="nav-item nav-item--center"
      @click="showGoTo"
    >
      <span class="nav-fab" aria-hidden="true">
        <Icon name="tabler:hash" size="28" />
      </span>
      <span class="nav-fab__slot" aria-hidden="true" />
      <span>Ir al himno</span>
    </button>

    <NuxtLink
      v-for="item in right"
      :key="item.to"
      :to="item.to"
      class="nav-item"
      :class="isActive(item.match) ? 'nav-item--on' : ''"
      :aria-current="isActive(item.match) ? 'page' : undefined"
    >
      <Icon :name="item.icon" size="22" />
      <span>{{ item.label }}</span>
    </NuxtLink>
  </nav>
  <AppGoToHymn v-model:open="goToOpen" @go="goTo" />
</template>

<style scoped>
.nav-item {
  flex: 1;
  margin-block: 0.375rem;
  border-radius: 9999px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.125rem;
  font-size: 11px;
  line-height: 1;
  font-weight: 500;
  color: var(--ui-text-muted);
  transition:
    background-color 0.15s,
    color 0.15s;
}
.nav-item:hover {
  color: var(--ui-text-highlighted);
  background: var(--control-bg);
}
/* The raised "Ir al himno" button. */
.nav-item--center {
  position: relative;
  color: var(--ui-primary);
  font-weight: 700;
}
.nav-item--center:hover {
  background: transparent;
  color: var(--ui-primary);
}
.nav-fab__slot {
  height: 22px;
}
.nav-fab {
  position: absolute;
  left: 50%;
  top: -1.75rem;
  translate: -50% 0;
  display: grid;
  place-items: center;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 9999px;
  background: var(--ui-primary);
  color: var(--ui-text-inverted);
  /* A ring of the canvas colour detaches it from the bar. */
  border: 4px solid var(--app-canvas);
  box-shadow: 0 10px 22px -8px var(--brand-shadow);
  transition: scale 0.15s ease;
}
.nav-item--center:hover .nav-fab {
  scale: 1.04;
}
.nav-item--center:active .nav-fab {
  scale: 0.96;
}
.nav-item--center:focus-visible {
  outline: none;
}
.nav-item--center:focus-visible .nav-fab {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .nav-fab {
    transition: none;
  }
}
/* Active: a soft violet pill (Diaconeo's tab bar); lime in dark mode. */
.nav-item--on,
.nav-item--on:hover {
  color: var(--ui-primary);
  font-weight: 700;
  background: color-mix(in oklab, var(--ui-primary) 12%, transparent);
}
.dark .nav-item--on,
.dark .nav-item--on:hover {
  color: var(--color-lime-300);
  background: color-mix(in oklab, var(--color-lime-300) 15%, transparent);
}
</style>
