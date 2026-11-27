<script setup lang="ts">
// "Apariencia" sheet of the reading view (the Aa of reading apps): the
// reading settings and the theme, the same controls as in Ajustes. A
// drawer, so it can also be dragged down to close; "Listo" stays visible.
const open = defineModel<boolean>("open", { default: false });
</script>

<template>
  <UDrawer
    v-model:open="open"
    title="Apariencia"
    description="Tamaño, interlineado, margen, letra y tema"
    :ui="{
      content: 'max-w-lg mx-auto max-h-[88dvh]',
      description: 'sr-only',
      body: 'overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom,0px))]',
    }"
  >
    <template #actions>
      <UButton
        size="lg"
        class="px-5"
        label="Listo"
        @click="open = false"
      />
    </template>
    <template #body>
      <div v-scroll-fade.parent class="flex flex-col gap-6">
        <AppReadingSettings />
        <AppThemeControl />
      </div>
    </template>
  </UDrawer>
</template>
