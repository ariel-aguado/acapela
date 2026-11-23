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

    <button
      type="button"
      class="flex-1 my-1 rounded-full flex flex-col items-center justify-center gap-0.5 text-[11px] leading-none font-semibold text-primary"
      @click="showGoTo"
    >
      <span class="grid place-items-center h-8 w-12 rounded-full bg-primary text-inverted shadow-[0_6px_16px_-6px_var(--brand-shadow)]">
        <Icon name="tabler:hash" size="22" aria-hidden="true" />
      </span>
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
  color: color-mix(in oklab, var(--ui-text) 70%, transparent);
  transition:
    background-color 0.15s,
    color 0.15s;
}
.nav-item:hover {
  color: var(--ui-text);
  background: color-mix(in oklab, var(--ui-text) 5%, transparent);
}
.nav-item--on,
.nav-item--on:hover {
  color: var(--ui-primary);
  font-weight: 700;
  background: color-mix(in oklab, var(--ui-primary) 15%, transparent);
}
</style>
