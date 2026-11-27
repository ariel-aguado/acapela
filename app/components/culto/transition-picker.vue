<script lang="ts" setup>
import type { Screen } from "~/utils/culto/screens";
import type { ScreenTransition, TransitionKind, TransitionSpeed } from "~~/lib/culto";

import { TRANSITION_LABELS, TRANSITION_SPEED_LABELS } from "~~/lib/culto";

// Choosing a transition by seeing it (NN/g: recognition over recall): each
// option is a thumbnail that plays its animation on hover or focus, and
// «Probar» plays it on a sample screen. With `inherit`, «Predeterminado»
// leaves the element on the theme's, shown with its own animation.
const props = defineProps<{
  inherit?: boolean;
  /** What «Predeterminado» stands for, to show and try it. */
  inherited?: ScreenTransition;
  /** Read aloud: "Transición entre pantallas". */
  label: string;
}>();
const model = defineModel<ScreenTransition | undefined>();

const KINDS = Object.keys(TRANSITION_LABELS) as TransitionKind[];
const speedItems = (Object.keys(TRANSITION_SPEED_LABELS) as TransitionSpeed[])
  .map(value => ({ label: TRANSITION_SPEED_LABELS[value], value }));

/** What plays: the chosen one, or the theme's. */
const effective = computed(() => model.value ?? props.inherited);

function pick(kind: TransitionKind | "inherit") {
  model.value = kind === "inherit"
    ? undefined
    : { kind, speed: model.value?.speed ?? effective.value?.speed ?? "normal" };
}

const speed = computed({
  get: () => model.value?.speed ?? "normal",
  set: (value: TransitionSpeed) => {
    if (model.value)
      model.value = { ...model.value, speed: value };
  },
});

// «Probar»: two sample screens, one giving way to the other.
const SAMPLES: Screen[] = [
  {
    type: "page",
    layout: "title",
    eyebrow: "Bienvenidos",
    title: "Nos alegra verte hoy",
    reference: "",
    html: "",
    footer: "",
    counter: "",
    scale: 1,
  },
  {
    type: "page",
    layout: "title",
    eyebrow: "",
    title: "Oremos",
    reference: "",
    html: "",
    footer: "",
    counter: "",
    scale: 1,
  },
];
const sample = ref(0);
function play() {
  sample.value = 1 - sample.value;
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2" role="radiogroup" :aria-label="label">
      <button
        v-if="inherit"
        type="button"
        role="radio"
        class="tp-tile"
        :aria-checked="!model"
        @click="pick('inherit')"
      >
        <span class="tp-mini" aria-hidden="true">
          <span class="tp-a" />
          <span v-if="inherited" class="tp-b" :class="`tp-b--${inherited.kind}`" />
        </span>
        <span class="tp-name">Predeterminado</span>
        <span v-if="inherited" class="tp-sub">{{ TRANSITION_LABELS[inherited.kind] }}</span>
      </button>
      <button
        v-for="k in KINDS"
        :key="k"
        type="button"
        role="radio"
        class="tp-tile"
        :aria-checked="model?.kind === k"
        @click="pick(k)"
      >
        <span class="tp-mini" aria-hidden="true">
          <span class="tp-a" />
          <span class="tp-b" :class="`tp-b--${k}`" />
        </span>
        <span class="tp-name">{{ TRANSITION_LABELS[k] }}</span>
      </button>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <UTabs
        v-if="model && model.kind !== 'cut'"
        v-model="speed"
        :items="speedItems"
        :content="false"
        size="sm"
        class="w-full sm:w-72"
        :aria-label="`Velocidad de la ${label.toLowerCase()}`"
      />
      <UButton
        v-if="effective"
        color="neutral"
        variant="soft"
        size="sm"
        icon="i-tabler-player-play"
        label="Probar"
        @click="play"
      />
    </div>
    <div v-if="effective" class="w-full max-w-72 overflow-hidden rounded-lg ring-1 ring-default">
      <CultoLiveScreen
        :screen="SAMPLES[sample]!"
        :screen-key="String(sample)"
        :transition="effective"
      />
    </div>
  </div>
</template>

<style scoped>
.tp-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem;
  border-radius: 0.75rem;
  outline: 1px solid var(--ui-border);
  text-align: center;
}
.tp-tile[aria-checked="true"] {
  outline: 2px solid var(--ui-primary);
  background: color-mix(in oklab, var(--ui-primary) 8%, transparent);
}
.tp-name {
  font-size: 0.75rem;
  font-weight: 600;
}
.tp-sub {
  margin-top: -0.25rem;
  font-size: 0.6875rem;
  color: var(--ui-text-muted);
}
/* A tiny before and after that plays its transition on hover or focus. */
.tp-mini {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 0.375rem;
  background: var(--color-iris-500);
}
.tp-a,
.tp-b {
  position: absolute;
  inset: 0;
}
.tp-a {
  background: linear-gradient(135deg, var(--color-iris-500), var(--color-iris-700));
}
.tp-b {
  background: linear-gradient(135deg, var(--color-aqua-400), var(--color-aqua-600));
  opacity: 0;
  animation: 1.8s ease-in-out infinite paused;
}
.tp-tile:hover .tp-b,
.tp-tile:focus-visible .tp-b {
  animation-play-state: running;
}
.tp-b--cut {
  animation-name: tp-cut;
  animation-timing-function: step-end;
}
.tp-b--fade {
  animation-name: tp-fade;
}
.tp-b--slide {
  animation-name: tp-slide;
}
.tp-b--rise {
  animation-name: tp-rise;
}
.tp-b--zoom {
  animation-name: tp-zoom;
}
@keyframes tp-cut {
  0%,
  45% {
    opacity: 0;
  }
  50%,
  95% {
    opacity: 1;
  }
}
@keyframes tp-fade {
  0%,
  20% {
    opacity: 0;
  }
  50%,
  80% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
@keyframes tp-slide {
  0%,
  20% {
    opacity: 1;
    transform: translateX(100%);
  }
  50%,
  85% {
    opacity: 1;
    transform: translateX(0);
  }
  100% {
    opacity: 0;
    transform: translateX(0);
  }
}
@keyframes tp-rise {
  0%,
  20% {
    opacity: 0;
    transform: translateY(30%);
  }
  50%,
  85% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
  }
}
@keyframes tp-zoom {
  0%,
  20% {
    opacity: 0;
    transform: scale(1.35);
  }
  50%,
  85% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .tp-b {
    animation: none;
  }
}
</style>
