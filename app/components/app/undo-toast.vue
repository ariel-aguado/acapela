<script setup lang="ts">
const { toast, runAction, hide } = useUndoToast();
const route = useRoute();

// Above the bottom navigation (52px) and, on the reading view, above the
// hymn pager (64px).
const bottomOffset = computed(() => {
  if (route.meta.bare === true)
    return "1rem";
  const bars = route.name === "index" ? 52 + 64 : 52;
  return `calc(${bars}px + 0.75rem + env(safe-area-inset-bottom, 0px))`;
});
</script>

<template>
  <div
    class="fixed inset-x-3 z-[60] flex justify-center pointer-events-none"
    :style="{ bottom: bottomOffset }"
    role="status"
    aria-live="polite"
  >
    <Transition name="undo-toast">
      <div
        v-if="toast"
        :key="toast.id"
        class="pointer-events-auto flex items-center gap-3 w-full max-w-md rounded-xl bg-neutral text-neutral-content shadow-xl pl-4 pr-2 py-2"
      >
        <span class="flex-1 text-sm">{{ toast.message }}</span>
        <button
          v-if="toast.actionLabel"
          type="button"
          class="btn btn-ghost btn-sm h-10 text-primary-content font-bold"
          @click="runAction"
        >
          {{ toast.actionLabel }}
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-sm btn-square h-10 w-10 text-neutral-content"
          aria-label="Cerrar aviso"
          @click="hide"
        >
          <Icon name="tabler:x" size="18" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.undo-toast-enter-active,
.undo-toast-leave-active {
  transition:
    transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 160ms ease;
}
.undo-toast-enter-from,
.undo-toast-leave-to {
  transform: translateY(12px);
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .undo-toast-enter-active,
  .undo-toast-leave-active {
    transition: none;
  }
}
</style>
