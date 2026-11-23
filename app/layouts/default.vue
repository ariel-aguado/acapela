<script lang="ts" setup>
// The screen width never decides the task: reading stays available on
// laptops and tablets, and presentation is opened on purpose from the
// header ("Proyectar") instead of by an automatic redirect.
const route = useRoute();

const showFontSidebar = ref(false);
</script>

<template>
  <div class="flex flex-col h-screen max-h-screen relative">
    <AppOptionsBar v-if="route.name !== 'fullscreen'" @update:open="showFontSidebar = !showFontSidebar" />
    <main class="flex-1 flex flex-col">
      <slot />
    </main>
    <AppNavBar v-if="route.name !== 'fullscreen'" />
    <AppFontSidebar v-if="route.name !== 'fullscreen'" :open="showFontSidebar" @update:open="showFontSidebar = $event" />
  </div>
</template>
