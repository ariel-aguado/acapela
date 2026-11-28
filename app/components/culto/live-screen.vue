<script lang="ts" setup>
import type { ProjectorMessage, ProjectorQr } from "~/composables/use-projector-channel";
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
  /** A message over the screen (hidden while the screen is black). */
  message?: ProjectorMessage | null;
  /** The room's QR, in a corner (hidden while the screen is black). */
  qr?: ProjectorQr | null;
}>(), {
  message: null,
  qr: null,
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
    <Transition name="cmsg">
      <CultoScreenMessage
        v-if="message && !black"
        :key="message.key"
        :message="message.message"
        :started-at="message.startedAt"
        :theme-font="message.themeFont"
      />
    </Transition>
    <Transition name="cmsg">
      <div v-if="qr && !black" class="live-qr-layer" data-live-qr>
        <div class="live-qr">
          <div class="live-qr__code" v-html="qr.svg" />
          <div class="live-qr__text">
            <strong>Sigue el culto en tu teléfono</strong>
            <span>{{ qr.url }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style>
/* Both screens in the same cell while the change lasts. */
.live-screen {
  position: relative;
  display: grid;
  overflow: hidden;
  background: #000;
}
.live-screen__layer {
  grid-area: 1 / 1;
  min-width: 0;
}
/* The room's QR: a white card in the bottom right corner, sized to the
   screen (container units), large enough to scan from the pews. */
.live-qr-layer {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  container-type: size;
}
.live-qr {
  position: absolute;
  right: 3cqw;
  bottom: 4cqw;
  display: flex;
  align-items: center;
  gap: 1.6cqw;
  padding: 1.2cqw 2cqw 1.2cqw 1.2cqw;
  border-radius: 1.6cqw;
  background: #fff;
  color: #17142b;
  box-shadow: 0 1cqw 3cqw rgb(0 0 0 / 0.35);
  font-family: Inter, sans-serif;
}
.live-qr__code {
  width: 15cqw;
  aspect-ratio: 1;
}
.live-qr__code svg {
  width: 100%;
  height: 100%;
  display: block;
}
.live-qr__text {
  display: flex;
  flex-direction: column;
  gap: 0.5cqw;
  max-width: 24cqw;
}
.live-qr__text strong {
  font-size: 2.1cqw;
  line-height: 1.15;
}
.live-qr__text span {
  font-size: 1.3cqw;
  color: #4b36c4;
  font-weight: 600;
  overflow-wrap: anywhere;
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
