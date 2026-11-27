<script setup lang="ts">
import type { Screen } from "~/utils/culto/screens";

import { renderPage } from "~/utils/culto/screens";

// A designed screen (welcome, Lord's supper, a reading…) on the same fixed
// 1920×1080 stage as the hymn slides, scaled to its box. The markup comes
// from renderPage(), the same one used to measure while paginating. Title
// and quote layouts fit their title to the screen (largest that fits).
const props = withDefaults(defineProps<{
  screen: Extract<Screen, { type: "page" }>;
  black?: boolean;
  badge?: string;
}>(), {
  black: false,
  badge: "",
});

const STAGE_W = 1920;
const STAGE_H = 1080;
const TITLE_PX: Record<string, [number, number]> = {
  title: [56, 150],
  quote: [48, 120],
};

const frameRef = shallowRef<HTMLElement | null>(null);
const stageRef = shallowRef<HTMLElement | null>(null);
const k = ref(0.25);

const html = computed(() => renderPage(props.screen));

function fitTitle() {
  const range = TITLE_PX[props.screen.layout];
  const stage = stageRef.value;
  const title = stage?.querySelector<HTMLElement>(".page-title");
  const main = stage?.querySelector<HTMLElement>(".page-main");
  if (!range || !title || !main)
    return;
  const fits = (px: number) => {
    title.style.fontSize = `${px}px`;
    return main.scrollHeight <= main.clientHeight + 1 && title.scrollWidth <= title.clientWidth + 1;
  };
  let [lo, hi] = range;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (fits(mid))
      lo = mid;
    else
      hi = mid;
  }
  const fitted = fits(hi)
    ? hi
    : lo;
  title.style.fontSize = `${Math.round(fitted * props.screen.scale)}px`;
}

function measureFrame() {
  const el = frameRef.value;
  if (el)
    k.value = el.clientWidth / STAGE_W;
}

useResizeObserver(frameRef, measureFrame);

watch(html, async () => {
  await nextTick();
  fitTitle();
}, { flush: "post" });

onMounted(async () => {
  measureFrame();
  fitTitle();
  if (document.fonts?.ready) {
    await document.fonts.ready;
    fitTitle();
  }
});
</script>

<template>
  <div ref="frameRef" class="projection-frame">
    <div
      ref="stageRef"
      class="projection-stage"
      :style="{ width: `${STAGE_W}px`, height: `${STAGE_H}px`, transform: `scale(${k})` }"
    >
      <template v-if="!black">
        <div class="projection-bg" aria-hidden="true" />
        <!-- eslint-disable-next-line vue/no-v-html -- built by renderPage from escaped text -->
        <div class="page-host" v-html="html" />
      </template>
    </div>
    <span v-if="badge" class="projection-badge">{{ badge }}</span>
  </div>
</template>

<style>
/* Shared by the measuring screen in use-culto-screens.ts: keep in sync
   through renderPage(), never with page-specific tweaks here. */
.page {
  position: absolute;
  inset: 0;
  padding: 90px 130px 60px;
  display: flex;
  flex-direction: column;
  color: #fff;
  font-family: "Inter", sans-serif;
  text-shadow:
    0 3px 0 rgba(0, 0, 0, 0.6),
    0 0 14px rgba(0, 0, 0, 0.6);
}
.page-eyebrow {
  margin: 0;
  font-size: 34px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  opacity: 0.88;
}
.page-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 28px;
}
.page-title {
  margin: 0;
  font-weight: 800;
  line-height: 1.12;
  overflow-wrap: break-word;
}
.page-reference {
  margin: 0;
  font-size: 46px;
  font-weight: 600;
  opacity: 0.85;
}
.page--title .page-main {
  align-items: center;
  text-align: center;
}
.page--title .page-title {
  font-size: 140px;
}
.page--quote .page-title {
  font-family: "Literata", Georgia, serif;
  font-weight: 600;
  font-size: 110px;
}
.page--text .page-main {
  justify-content: flex-start;
  padding-top: 24px;
  gap: 18px;
}
.page--text .page-title {
  font-size: 72px;
}
.page--text .page-reference {
  font-size: 40px;
}
.page-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  font-size: var(--page-body, 62px);
  font-weight: 600;
  line-height: 1.36;
}
/* Short text sits in the middle; auto margins drop to 0 when it fills the
   screen, so the measured overflow is the same either way. */
.page-body {
  display: flex;
  flex-direction: column;
}
.page-body > :first-child {
  margin-top: auto;
}
.page-body > :last-child {
  margin-bottom: auto;
}
.page-body p {
  margin: 0 0 0.42em;
}
.page-body sup {
  font-size: 0.55em;
  font-weight: 700;
  opacity: 0.75;
  margin-right: 0.2em;
  vertical-align: 0.6em;
}
.page-footer {
  display: flex;
  justify-content: space-between;
  gap: 40px;
  margin: 24px 0 0;
  font-size: 32px;
  font-weight: 600;
  opacity: 0.8;
}
</style>
