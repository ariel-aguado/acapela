<script lang="ts" setup>
import type { DropdownMenuItem } from "@nuxt/ui";

// A «+» under a row of the order, to insert right after it: shown while the
// mouse is over the row (a wide zone, not only the gap), and always under
// the chosen row, which is the way on a touch screen and from the keyboard
// (NN/g: hover is not there for everyone; what is hidden is not found).
defineProps<{
  items: DropdownMenuItem[][];
  /** "Insertar después de «Oremos»". */
  label: string;
  /** Always shown: the row is the chosen one. */
  on?: boolean;
}>();
</script>

<template>
  <div class="insert-line pointer-events-none absolute inset-x-8 -bottom-[0.55rem] z-10 flex h-[0.85rem] items-center gap-1.5 opacity-0 transition-opacity" :class="{ 'insert-line--on': on }">
    <span class="h-0.5 flex-1 rounded-full bg-primary" aria-hidden="true" />
    <UDropdownMenu :items="items">
      <UButton
        size="xs"
        square
        icon="i-tabler-plus"
        class="pointer-events-auto rounded-full"
        :tabindex="on ? 0 : -1"
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
.insert-line--on,
.insert-line:has([data-state="open"]) {
  opacity: 1;
}
@media (hover: none) {
  .insert-line:not(.insert-line--on) {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .insert-line {
    transition: none;
  }
}
</style>
