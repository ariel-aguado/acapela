<script lang="ts" setup>
// Audience window: only the slide. Opened from the console ("Abrir ventana
// del proyector"), dragged to the projector, double-click for full screen.
definePageMeta({ bare: true });
useHead({ title: "Proyector" });

const { state } = useProjectorReceiver();
const rootRef = shallowRef<HTMLElement | null>(null);
const { isFullscreen, toggle } = useFullscreen(rootRef);

// Hint for the operator, gone after a few seconds and while full screen.
const showHint = ref(true);
let hintTimer: ReturnType<typeof setTimeout> | null = null;
function pokeHint() {
  showHint.value = true;
  if (hintTimer)
    clearTimeout(hintTimer);
  hintTimer = setTimeout(() => (showHint.value = false), 4000);
}

onKeyStroke(["f", "F"], () => toggle());
onMounted(pokeHint);
</script>

<template>
  <div
    ref="rootRef"
    class="projector fixed inset-0 bg-black flex items-center justify-center"
    :class="{ 'cursor-none': !showHint }"
    @dblclick="toggle()"
    @mousemove="pokeHint"
  >
    <div class="projector__frame">
      <CultoLiveScreen
        v-if="state"
        :screen="state.screen"
        :black="state.black"
        :screen-key="state.key"
        :transition="state.transition"
      />
      <div v-else class="aspect-video grid place-items-center text-white/80 text-center px-6">
        <div class="flex flex-col items-center gap-3">
          <AppBrandMark class="size-16 text-[#a9a6fa]" />
          <p class="text-xl font-semibold">
            Esperando a la consola de Acapela…
          </p>
          <p class="text-sm opacity-80">
            Deja esta ventana abierta y elige un himno en la consola.
          </p>
        </div>
      </div>
    </div>
    <Transition name="fade">
      <p
        v-if="showHint && !isFullscreen"
        class="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/15 text-white text-sm px-4 py-2 backdrop-blur"
      >
        Arrastra esta ventana al proyector y haz doble clic (o pulsa F) para pantalla completa
      </p>
    </Transition>
  </div>
</template>

<style scoped>
.projector__frame {
  width: min(100vw, calc(100vh * 16 / 9));
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
