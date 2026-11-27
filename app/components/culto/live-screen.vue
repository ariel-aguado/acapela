<script lang="ts" setup>
import type { Screen } from "~/utils/culto/screens";
import type { ScreenTransition } from "~~/lib/culto";

import { TRANSITION_MS } from "~~/lib/culto";

// A projected screen that gives way to the next one with its transition:
// the leaving and the entering one stacked while it lasts. Used by the
// projector window, the console's live screen and the transition previews.
// Changes quicker than the transition (→ → →) are cut, so nothing piles up
// and the congregation never sees what is on air late.
const props = withDefaults(defineProps<{
  screen: Screen | null;
  black?: boolean;
  /** Identity of what is on air: a new key is a change of screen. */
  screenKey?: string;
  transition?: ScreenTransition;
  /** False: always a cut (the operator asked for less motion). */
  animate?: boolean;
}>(), {
  black: false,
  screenKey: "",
  transition: undefined,
  animate: true,
});

const shownKey = computed(() => `${props.screenKey}|${props.black ? "black" : ""}`);

const kind = ref("cut");
const ms = ref(0);
let lastChange = 0;
let lastScreenKey = props.screenKey;
// Before rendering, once all the props are in (the key and its transition
// change together).
watch(shownKey, () => {
  const now = performance.now();
  // Only black on or off: always a short fade.
  const t = props.screenKey === lastScreenKey
    ? { kind: "fade" as const, speed: "fast" as const }
    : props.transition;
  lastScreenKey = props.screenKey;
  const duration = t
    ? TRANSITION_MS[t.speed]
    : 0;
  const tooSoon = now - lastChange < duration;
  lastChange = now;
  kind.value = props.animate && t && !tooSoon
    ? t.kind
    : "cut";
  ms.value = kind.value === "cut"
    ? 0
    : duration;
});
</script>

<template>
  <div class="live-screen" :style="{ '--t-dur': `${ms}ms` }">
    <Transition :name="`t-${kind}`" :duration="ms">
      <div :key="shownKey" class="live-screen__layer">
        <CultoScreen :screen="screen" :black="black" />
      </div>
    </Transition>
  </div>
</template>

<style>
/* Both screens in the same cell while the change lasts. */
.live-screen {
  display: grid;
  overflow: hidden;
  background: #000;
}
.live-screen__layer {
  grid-area: 1 / 1;
  min-width: 0;
}

.t-fade-enter-active,
.t-fade-leave-active,
.t-rise-enter-active,
.t-rise-leave-active,
.t-zoom-enter-active,
.t-zoom-leave-active {
  transition:
    opacity var(--t-dur) ease,
    transform var(--t-dur) cubic-bezier(0.2, 0.7, 0.2, 1);
}
.t-slide-enter-active,
.t-slide-leave-active {
  transition:
    transform var(--t-dur) cubic-bezier(0.3, 0.7, 0.2, 1),
    opacity var(--t-dur) ease;
}
.t-fade-enter-from,
.t-fade-leave-to,
.t-rise-leave-to,
.t-zoom-leave-to {
  opacity: 0;
}
.t-slide-enter-from {
  transform: translateX(100%);
}
.t-slide-leave-to {
  transform: translateX(-35%);
  opacity: 0;
}
.t-rise-enter-from {
  transform: translateY(6%);
  opacity: 0;
}
.t-zoom-enter-from {
  transform: scale(1.06);
  opacity: 0;
}
/* The one entering goes over the one leaving. */
.t-fade-enter-active,
.t-slide-enter-active,
.t-rise-enter-active,
.t-zoom-enter-active {
  z-index: 1;
}
</style>
