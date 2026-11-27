<script lang="ts" setup>
import type { DropdownMenuItem } from "@nuxt/ui";

// A «+» between two rows of the order, shown while the mouse is over the
// gap: a shortcut to insert right there. Not the only way (NN/g: hover is
// not there on a touch screen or from the keyboard): the chosen element's
// «+» does the same.
defineProps<{
  items: DropdownMenuItem[][];
  /** "Insertar después de «Oremos»". */
  label: string;
}>();
</script>

<template>
  <div class="insert-line pointer-events-none absolute inset-x-8 -bottom-[0.55rem] z-10 flex h-[0.85rem] items-center gap-1.5 opacity-0 transition-opacity">
    <span class="h-0.5 flex-1 rounded-full bg-primary" aria-hidden="true" />
    <UDropdownMenu :items="items">
      <UButton
        size="xs"
        square
        icon="i-tabler-plus"
        class="pointer-events-auto rounded-full"
        tabindex="-1"
        :aria-label="label"
        :title="label"
      />
    </UDropdownMenu>
    <span class="h-0.5 flex-1 rounded-full bg-primary" aria-hidden="true" />
  </div>
</template>

<style scoped>
/* Shown while the pointer is over the gap (the parent row's bottom edge) or
   its menu is open; never on touch screens, where it would only get in the
   way: there the chosen element's «+» is the way. */
.insert-line {
  pointer-events: auto;
}
.insert-line:hover,
.insert-line:has([data-state="open"]) {
  opacity: 1;
}
@media (hover: none) {
  .insert-line {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .insert-line {
    transition: none;
  }
}
</style>
