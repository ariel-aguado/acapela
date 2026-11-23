<script lang="ts" setup>
const route = useRoute();

// Icon + visible text label for every destination: icons alone were four
// near-identical music glyphs that users had to learn by trial.
const items = [
  { to: "/", label: "Cantar", icon: "tabler:music", match: ["/", "/fullscreen"] },
  { to: "/search", label: "Buscar", icon: "tabler:search", match: ["/search", "/fully-search"] },
  { to: "/favorites", label: "Favoritos", icon: "tabler:heart", match: ["/favorites", "/list"] },
  { to: "/settings", label: "Ajustes", icon: "tabler:settings", match: ["/settings", "/about"] },
];

function isActive(match: string[]) {
  return match.includes(route.path);
}
</script>

<template>
  <nav
    class="glass float-bottom fixed left-1/2 -translate-x-1/2 z-30 w-[calc(100%-1.5rem)] max-w-md h-[60px] rounded-full flex items-stretch px-1.5"
    aria-label="Navegación principal"
  >
    <NuxtLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="flex-1 my-1.5 rounded-full flex flex-col items-center justify-center gap-0.5 text-[11px] leading-none transition-colors"
      :class="isActive(item.match)
        ? 'bg-primary/15 text-primary font-bold'
        : 'text-base-content/70 font-medium hover:text-base-content hover:bg-base-content/5'"
      :aria-current="isActive(item.match) ? 'page' : undefined"
    >
      <Icon :name="item.icon" size="22" />
      <span>{{ item.label }}</span>
    </NuxtLink>
  </nav>
</template>
