<script setup lang="ts">
import type { Slide } from "~/utils/slides";

// A projected slide drawn on a fixed 1920×1080 stage and scaled to its box,
// so the operator's preview and the projector window show exactly the same
// layout. The lyric size is fitted to the stage (largest size that fits) and
// then multiplied by the per-hymn scale the operator chose.
const props = withDefaults(defineProps<{
  slide: Slide | null;
  number?: number | null;
  title?: string;
  black?: boolean;
  scale?: number;
  /** Small text in the corner for the operator's previews ("Siguiente"…). */
  badge?: string;
}>(), {
  number: null,
  title: "",
  black: false,
  scale: 1,
  badge: "",
});

const emit = defineEmits<{ (e: "overflow", value: boolean): void }>();

const STAGE_W = 1920;
const STAGE_H = 1080;
const MIN_PX = 28;
const MAX_PX = 112;

const frameRef = shallowRef<HTMLElement | null>(null);
const areaRef = shallowRef<HTMLElement | null>(null);
const lyricRef = shallowRef<HTMLElement | null>(null);
const k = ref(0.25);
const fontPx = ref(64);

function fits(px: number) {
  const area = areaRef.value;
  const lyric = lyricRef.value;
  if (!area || !lyric)
    return true;
  lyric.style.fontSize = `${px}px`;
  return lyric.offsetWidth <= area.clientWidth && lyric.offsetHeight <= area.clientHeight;
}

async function fit() {
  await nextTick();
  if (!lyricRef.value || !areaRef.value)
    return;
  let lo = MIN_PX;
  let hi = MAX_PX;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (fits(mid))
      lo = mid;
    else
      hi = mid;
  }
  const fitted = fits(hi) ? hi : lo;
  const final = Math.round(fitted * props.scale);
  fontPx.value = final;
  lyricRef.value.style.fontSize = `${final}px`;
  emit("overflow", final > fitted && !fits(final));
  lyricRef.value.style.fontSize = `${final}px`;
}

function measureFrame() {
  const el = frameRef.value;
  if (el)
    k.value = el.clientWidth / STAGE_W;
}

useResizeObserver(frameRef, measureFrame);

watch(() => [props.slide?.html, props.scale, props.black], () => fit());

onMounted(async () => {
  measureFrame();
  await fit();
  // Re-fit once web fonts are in, since metrics change.
  if (document.fonts?.ready) {
    await document.fonts.ready;
    fit();
  }
});
</script>

<template>
  <div ref="frameRef" class="projection-frame">
    <div
      class="projection-stage"
      :style="{ width: `${STAGE_W}px`, height: `${STAGE_H}px`, transform: `scale(${k})` }"
    >
      <template v-if="!black">
        <div class="projection-bg" aria-hidden="true" />
        <div v-if="slide" ref="areaRef" class="projection-area">
          <span v-if="slide.kind === 'chorus'" class="projection-tag">Coro</span>
          <div
            ref="lyricRef"
            class="projection-lyric"
            :class="{ 'projection-lyric--chorus': slide.kind === 'chorus' }"
            :style="{ fontSize: `${fontPx}px` }"
            v-html="slide.html"
          />
        </div>
        <p v-if="number && title" class="projection-footer">
          {{ number }}. {{ title }}
        </p>
      </template>
    </div>
    <span v-if="badge" class="projection-badge">{{ badge }}</span>
  </div>
</template>

<style>
.projection-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #000;
  color: #fff;
  container-type: inline-size;
}
.projection-stage {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
  font-family: var(--font-display);
}
.projection-bg {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.45)),
    url("/img/background-fullscreen.webp") center / cover no-repeat;
}
.projection-area {
  position: absolute;
  inset: 90px 120px 170px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.projection-lyric {
  width: max-content;
  max-width: none;
  font-weight: 700;
  line-height: 1.3;
  text-align: center;
  text-shadow:
    0 3px 0 rgba(0, 0, 0, 0.85),
    0 0 14px rgba(0, 0, 0, 0.7),
    0 6px 20px rgba(0, 0, 0, 0.5);
}
.projection-lyric p {
  margin: 0;
  white-space: nowrap;
}
.projection-lyric table {
  border-collapse: collapse;
}
.projection-lyric td,
.projection-lyric th {
  padding: 0 0.6em;
  white-space: nowrap;
  text-align: center;
  vertical-align: top;
}
.projection-lyric--chorus {
  font-style: italic;
}
.projection-tag {
  position: absolute;
  top: -50px;
  left: 0;
  font-size: 34px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.85;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.8);
}
.projection-footer {
  position: absolute;
  left: 120px;
  right: 120px;
  bottom: 56px;
  margin: 0;
  font-size: 40px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
  opacity: 0.92;
}
.projection-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
}
</style>
