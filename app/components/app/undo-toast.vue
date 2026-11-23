<script setup lang="ts">
const { toast, runAction, hide } = useUndoToast();
const route = useRoute();

const bottomOffset = computed(() => {
  if (route.meta.bare === true)
    return "1rem";
  // Above the floating bottom navigation.
  return "var(--bar-bottom)";
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
        class="pointer-events-auto flex items-center gap-3 w-full max-w-md rounded-xl bg-inverted text-inverted shadow-xl pl-4 pr-2 py-2"
      >
        <span class="flex-1 text-sm">{{ toast.message }}</span>
        <UButton
          v-if="toast.actionLabel"
          variant="ghost"
          class="h-10 text-inverted font-bold hover:bg-(--ui-text-inverted)/10"
          :label="toast.actionLabel"
          @click="runAction"
        />
        <UButton
          variant="ghost"
          square
          class="size-10 justify-center text-inverted hover:bg-(--ui-text-inverted)/10"
          icon="i-tabler-x"
          aria-label="Cerrar aviso"
          @click="hide"
        />
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
