<script setup lang="ts">
import type { MessageKind, ScreenMessage } from "~~/lib/culto";

import { PROJECTION_FONTS } from "~~/lib/culto";

// A message laid over the projected screen (an alert, a notice, a
// congratulation…), drawn in the screen's own units so the operator's
// preview and the projector show it alike. It enters with its animation;
// leaving is the parent's <Transition>. A countdown counts its seconds down
// from `startedAt`.
const props = withDefaults(defineProps<{
  message: ScreenMessage;
  /** When it went on air (Date.now()); for a countdown. */
  startedAt?: number;
  /** CSS font-family of the church's theme, for font "theme". */
  themeFont?: string;
}>(), {
  startedAt: 0,
  themeFont: "\"Inter\", sans-serif",
});

const ICONS: Record<MessageKind, string> = {
  alert: "i-tabler-alert-triangle",
  notice: "i-tabler-speakerphone",
  notification: "i-tabler-bell",
  congrats: "i-tabler-confetti",
  welcome: "i-tabler-heart-handshake",
  prayer: "i-tabler-pray",
  countdown: "i-tabler-clock",
  ticker: "i-tabler-news",
};

const band = computed(() => props.message.position.startsWith("band-"));

/** Which way it slides in: from the edge it is nearest to. */
const from = computed(() => {
  const p = props.message.position;
  if (p === "band-top" || p.startsWith("top"))
    return "top";
  if (p === "band-bottom" || p.startsWith("bottom"))
    return "bottom";
  return p === "end"
    ? "end"
    : "start";
});

const font = computed(() => {
  const f = props.message.font;
  if (f === "theme")
    return props.themeFont;
  return PROJECTION_FONTS.find(p => p.id === f)?.css ?? props.themeFont;
});

const countdown = computed(() => props.message.kind === "countdown");
const now = useNow({ interval: 250 });
const remaining = computed(() => {
  const total = props.message.duration;
  const gone = props.startedAt
    ? Math.floor((now.value.getTime() - props.startedAt) / 1000)
    : 0;
  const left = Math.max(0, total - gone);
  const m = Math.floor(left / 60);
  const s = left % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
});
</script>

<template>
  <div class="cmsg" :class="`cmsg--${message.position}`">
    <div
      class="cmsg__box"
      :class="[
        `cmsg--${message.kind}`,
        `cmsg--size-${message.size}`,
        `cmsg--anim-${message.animation}`,
        `cmsg--from-${from}`,
        { 'cmsg--band': band },
      ]"
      :style="{ fontFamily: font }"
      role="status"
    >
      <span v-if="message.title" class="cmsg__title">
        <UIcon :name="ICONS[message.kind]" class="cmsg__icon" />
        {{ message.title }}
      </span>
      <span class="cmsg__text">
        <span class="cmsg__run">{{ countdown ? remaining : message.text }}</span>
      </span>
      <span v-if="countdown && message.text" class="cmsg__sub">{{ message.text }}</span>
    </div>
  </div>
</template>

<style>
/* The layer over the screen: a container, so sizes follow the screen. */
.cmsg {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  padding: 2.5% 5%;
  box-sizing: border-box;
  pointer-events: none;
  container-type: size;
}
.cmsg--top-start {
  justify-content: flex-start;
  align-items: flex-start;
}
.cmsg--top {
  justify-content: center;
  align-items: flex-start;
}
.cmsg--top-end {
  justify-content: flex-end;
  align-items: flex-start;
}
.cmsg--start {
  justify-content: flex-start;
  align-items: center;
}
.cmsg--center {
  justify-content: center;
  align-items: center;
}
.cmsg--end {
  justify-content: flex-end;
  align-items: center;
}
.cmsg--bottom-start {
  justify-content: flex-start;
  align-items: flex-end;
}
.cmsg--bottom {
  justify-content: center;
  align-items: flex-end;
}
.cmsg--bottom-end {
  justify-content: flex-end;
  align-items: flex-end;
}
.cmsg--band-top {
  padding: 0;
  align-items: flex-start;
}
.cmsg--band-bottom {
  padding: 0;
  align-items: flex-end;
}

.cmsg__box {
  display: flex;
  flex-direction: column;
  gap: 0.2em;
  max-width: 62cqw;
  padding: 0.55em 0.9em 0.6em;
  border-radius: 0.55em;
  box-shadow: 0 0.4em 1.4em rgb(0 0 0 / 0.45);
  line-height: 1.2;
  text-align: start;
  color: #fff;
  background: #17142b;
}
.cmsg__box.cmsg--band {
  width: 100%;
  max-width: none;
  border-radius: 0;
  flex-direction: row;
  align-items: center;
  gap: 0.8em;
  padding: 0.6em 1.2em;
}
.cmsg__title {
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
  font-size: 0.6em;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;
}
.cmsg__icon {
  width: 1.3em;
  height: 1.3em;
  flex: none;
}
.cmsg__text {
  font-weight: 700;
  min-width: 0;
}
.cmsg__sub {
  font-size: 0.55em;
  opacity: 0.85;
}

.cmsg--size-s {
  font-size: 2.4cqw;
}
.cmsg--size-m {
  font-size: 3.2cqw;
}
.cmsg--size-l {
  font-size: 4.3cqw;
}
.cmsg--size-xl {
  font-size: 6cqw;
}

/* Each kind's colours (white text passes 4.5:1 on every dark one). */
.cmsg--alert {
  background: #c62828;
}
.cmsg--notice {
  background: #fff;
  color: #17142b;
}
.cmsg--notice .cmsg__title {
  color: #4b36c4;
}
.cmsg--notification .cmsg__title {
  color: #f4b740;
}
.cmsg--congrats {
  background: #f4b740;
  color: #17142b;
  align-items: center;
  text-align: center;
}
.cmsg--welcome {
  background: #4b36c4;
}
.cmsg--prayer {
  background: rgb(10 8 20 / 0.74);
}
.cmsg--prayer .cmsg__text {
  font-style: italic;
  font-weight: 600;
}
.cmsg--countdown {
  background: rgb(10 8 20 / 0.78);
  align-items: center;
  text-align: center;
}
.cmsg--countdown .cmsg__text {
  font-variant-numeric: tabular-nums;
}
.cmsg--ticker .cmsg__title {
  color: #17142b;
  background: #f4b740;
  padding: 0.25em 0.6em;
  border-radius: 0.3em;
}

/* Entering. */
@keyframes cmsg-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes cmsg-top {
  from {
    opacity: 0;
    transform: translateY(-130%);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes cmsg-bottom {
  from {
    opacity: 0;
    transform: translateY(130%);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes cmsg-start {
  from {
    opacity: 0;
    transform: translateX(-40%);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes cmsg-end {
  from {
    opacity: 0;
    transform: translateX(40%);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes cmsg-bounce {
  0% {
    opacity: 0;
    transform: scale(0.3);
  }
  55% {
    opacity: 1;
    transform: scale(1.08);
  }
  75% {
    transform: scale(0.96);
  }
  100% {
    transform: scale(1);
  }
}
@keyframes cmsg-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}
@keyframes cmsg-run {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-100%);
  }
}

.cmsg--anim-fade {
  animation: cmsg-fade 0.7s ease both;
}
.cmsg--anim-slide.cmsg--from-top {
  animation: cmsg-top 0.65s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.cmsg--anim-slide.cmsg--from-bottom {
  animation: cmsg-bottom 0.65s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.cmsg--anim-slide.cmsg--from-start {
  animation: cmsg-start 0.65s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.cmsg--anim-slide.cmsg--from-end {
  animation: cmsg-end 0.65s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.cmsg--anim-bounce {
  animation: cmsg-bounce 0.8s ease-out both;
}
.cmsg--anim-pulse {
  animation:
    cmsg-fade 0.5s both,
    cmsg-pulse 1.6s ease-in-out 0.5s infinite;
}
.cmsg--anim-marquee {
  animation: cmsg-fade 0.5s both;
  overflow: hidden;
}
.cmsg--anim-marquee .cmsg__text {
  flex: 1;
  overflow: hidden;
}
.cmsg--anim-marquee .cmsg__run {
  display: inline-block;
  white-space: nowrap;
  padding-inline-start: 100%;
  animation: cmsg-run 16s linear infinite;
}

/* Leaving (the parent's <Transition name="cmsg">). */
.cmsg-leave-active {
  transition: opacity 0.4s ease;
}
.cmsg-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .cmsg__box,
  .cmsg__run {
    animation: none !important;
  }
  .cmsg--anim-marquee .cmsg__run {
    padding-inline-start: 0;
    white-space: normal;
  }
}
</style>
