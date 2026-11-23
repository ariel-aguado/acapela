<script lang="ts" setup>
const emit = defineEmits(["update:open"]);
</script>

<template>
  <div
    class="navbar w-full bg-primary shadow-[0_4px_20px_0_rgba(0,0,0,0.5)] text-primary-content py-0 px-2 relative z-40"
    style="backdrop-filter: blur(6px);"
  >
    <div class="navbar-start">
      <div class="text-xl flex items-center gap-1 px-0">
        <Icon name="tabler:brand-netease-music" size="44" />
        <div class="flex flex-col items-start">
          <span class="leading-6 font-bold">
            Acapela
          </span>
          <span class="text-xs font-normal whitespace-nowrap">Cánticos Espirituales</span>
        </div>
        <AppSongbookSelector mode="badge" />
      </div>
    </div>
    <div class="navbar-end flex items-center gap-2">
      <!-- Presentation is opened on purpose, only where it makes sense
           (large screens), instead of an automatic redirect. -->
      <NuxtLink
        v-if="$route.path === '/'"
        to="/fullscreen"
        class="btn btn-sm rounded-full bg-primary-content text-primary border-0 hidden lg:inline-flex"
      >
        <Icon name="tabler:presentation" size="18" />
        Proyectar
      </NuxtLink>
      <button
        v-if="$route.path === '/'"
        class="btn btn-circle btn-ghost"
        aria-label="Tamaño de letra"
        @click="emit('update:open')"
      >
        <Icon name="tabler:text-size" size="28" class="text-white" />
      </button>
      <AppThemeToggle />
    </div>
  </div>
</template>
