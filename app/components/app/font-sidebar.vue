<script setup lang="ts">
// "Apariencia" bottom sheet for the reading view (like the Aa panel of
// reading apps): letter size and theme together, the same controls as in
// Ajustes, with a scrim that makes it clearly modal and a visible "Listo".
const props = defineProps<{ open: boolean }>();
const emit = defineEmits(["update:open"]);

function close() {
  emit("update:open", false);
}

onKeyStroke("Escape", () => {
  if (props.open)
    close();
});
</script>

<template>
  <div>
    <Transition name="fade">
      <div
        v-if="props.open"
        class="fixed inset-0 z-40 bg-black/40"
        aria-hidden="true"
        @click="close"
      />
    </Transition>
    <Transition name="slide-up">
      <div
        v-if="props.open"
        class="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-lg rounded-t-2xl bg-default shadow-2xl px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="font-sheet-title"
      >
        <div class="mx-auto mb-3 h-1.5 w-10 rounded-full bg-accented" aria-hidden="true" />
        <div class="flex items-center justify-between mb-3">
          <h2 id="font-sheet-title" class="text-lg font-bold">
            Apariencia
          </h2>
          <UButton
            size="lg"
            class="px-5"
            label="Listo"
            @click="close"
          />
        </div>
        <div class="flex flex-col gap-6">
          <AppFontSizeControl />
          <AppThemeControl />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .slide-up-enter-active,
  .slide-up-leave-active,
  .fade-enter-active,
  .fade-leave-active {
    transition: none;
  }
}
</style>
