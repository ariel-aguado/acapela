<script lang="ts" setup>
// The screen width never decides the task: reading stays available on
// laptops and tablets, and presentation is opened on purpose from the
// header ("Proyectar") instead of by an automatic redirect.
const route = useRoute();

const showFontSidebar = ref(false);
// Projection screens (console and projector window) have no app chrome.
const bare = computed(() => route.meta.bare === true);
</script>

<template>
  <div class="relative" :class="bare ? 'min-h-dvh' : 'flex flex-col h-dvh overflow-hidden'">
    <AppOptionsBar v-if="!bare" @update:open="showFontSidebar = !showFontSidebar" />
    <main class="flex-1 flex flex-col min-h-0">
      <slot />
    </main>
    <AppNavBar v-if="!bare" />
    <AppFontSidebar v-if="!bare" :open="showFontSidebar" @update:open="showFontSidebar = $event" />
  </div>
</template>
