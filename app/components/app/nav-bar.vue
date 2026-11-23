<script lang="ts" setup>
const route = useRoute();

// Icon + visible text label for every destination: icons alone were four
// near-identical music glyphs that users had to learn by trial.
const items = [
  { to: "/", label: "Cantar", icon: "tabler:music", match: ["/", "/fullscreen"] },
  { to: "/search", label: "Buscar", icon: "tabler:search", match: ["/search", "/fully-search"] },
  { to: "/favorites", label: "Favoritos", icon: "tabler:heart", match: ["/favorites"] },
  { to: "/settings", label: "Ajustes", icon: "tabler:settings", match: ["/settings", "/about"] },
];

function isActive(match: string[]) {
  return match.includes(route.path);
}
</script>

<template>
  <nav
    class="h-[52px] flex items-stretch bg-base-100 border-t border-base-300 z-10"
    aria-label="Navegación principal"
  >
    <NuxtLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] leading-none transition-colors"
      :class="isActive(item.match)
        ? 'text-primary font-bold'
        : 'text-base-content/70 font-medium hover:text-base-content'"
      :aria-current="isActive(item.match) ? 'page' : undefined"
    >
      <span
        class="flex items-center justify-center h-7 w-14 rounded-full"
        :class="isActive(item.match) ? 'bg-primary/15' : ''"
      >
        <Icon :name="item.icon" size="22" />
      </span>
      <span>{{ item.label }}</span>
    </NuxtLink>
  </nav>
</template>
