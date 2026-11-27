<script lang="ts" setup>
// One block of the element's panel: its own tinted box and a heading with
// an icon (NN/g: common region and visual hierarchy), so the eye goes from
// block to block at a glance.
defineProps<{
  icon: string;
  title: string;
}>();
</script>

<template>
  <section class="editor-block flex flex-col gap-4 rounded-2xl bg-elevated/50 p-4 ring-1 ring-default" :aria-label="title">
    <h3 class="flex items-center gap-2 text-sm font-bold text-highlighted">
      <UIcon :name="icon" class="size-4.5 text-primary" />
      {{ title }}
    </h3>
    <slot />
  </section>
</template>
