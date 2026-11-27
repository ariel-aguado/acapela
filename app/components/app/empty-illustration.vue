<script lang="ts" setup>
// "Las notas se escaparon": an open hymnal, a staff rising from its spine
// with the notes floating away, and a magnifier over the blank page. The
// empty state of the search. Decorative: the text beside it says what
// happened. Light and dark come from the palette in main.css; the notes
// drift gently unless the person asked for less motion.
</script>

<template>
  <svg
    class="empty-ill"
    viewBox="0 0 400 320"
    aria-hidden="true"
    focusable="false"
  >
    <circle
      cx="200"
      cy="168"
      r="138"
      class="fill-(--ill-glow)"
    />
    <circle
      cx="318"
      cy="78"
      r="44"
      class="fill-(--ill-glow-2)"
    />
    <g
      fill="none"
      stroke-width="3"
      stroke-linecap="round"
      class="stroke-(--ill-staff)"
    >
      <path d="M196 212 C176 160 250 150 262 112 S300 50 360 58" />
      <path d="M196 212 C176 160 250 150 262 112 S300 50 360 58" transform="translate(10 -4)" opacity=".7" />
      <path d="M196 212 C176 160 250 150 262 112 S300 50 360 58" transform="translate(20 -8)" opacity=".45" />
    </g>
    <g class="empty-ill__note">
      <ellipse
        cx="236"
        cy="146"
        rx="11"
        ry="8"
        transform="rotate(-22 236 146)"
        class="fill-(--ill-orange)"
      />
      <path
        d="M245 142 L245 112"
        stroke-width="4"
        stroke-linecap="round"
        class="stroke-(--ill-orange-ink)"
      />
    </g>
    <g class="empty-ill__note" style="animation-delay: -1.4s">
      <ellipse
        cx="280"
        cy="98"
        rx="11"
        ry="8"
        transform="rotate(-22 280 98)"
        class="fill-(--ill-cyan)"
      />
      <path
        d="M289 94 L289 64"
        stroke-width="4"
        stroke-linecap="round"
        class="stroke-(--ill-cyan-ink)"
      />
    </g>
    <g class="empty-ill__away">
      <ellipse
        cx="330"
        cy="68"
        rx="10"
        ry="7"
        transform="rotate(-22 330 68)"
        class="fill-(--ill-lime)"
      />
    </g>
    <path d="M82 214 L82 262 C128 248 170 250 200 266 C230 250 272 248 318 262 L318 214 Z" class="fill-(--ill-cover)" />
    <path
      d="M90 206 C130 192 170 194 200 210 L200 258 C170 242 130 240 90 254 Z"
      stroke-width="4"
      stroke-linejoin="round"
      class="fill-(--ill-page) stroke-(--ill-ink)"
    />
    <path
      d="M310 206 C270 192 230 194 200 210 L200 258 C230 242 270 240 310 254 Z"
      stroke-width="4"
      stroke-linejoin="round"
      class="fill-(--ill-page) stroke-(--ill-ink)"
    />
    <g
      fill="none"
      stroke-width="4"
      stroke-linecap="round"
      class="stroke-(--ill-lines)"
    >
      <path d="M104 218 C132 210 160 210 186 220" />
      <path d="M104 234 C132 226 160 226 186 236" />
    </g>
    <g class="empty-ill__lens">
      <path
        d="M282 246 L304 268"
        stroke-width="14"
        stroke-linecap="round"
        class="stroke-(--ill-ink)"
      />
      <path
        d="M296 260 L304 268"
        stroke-width="14"
        stroke-linecap="round"
        class="stroke-(--ill-orange)"
      />
      <circle
        cx="262"
        cy="226"
        r="27"
        stroke-width="10"
        class="fill-(--ill-page) stroke-(--ill-ink)"
      />
    </g>
    <path
      class="empty-ill__spark fill-(--ill-lime)"
      d="M110 88 C111 94 112 95 118 96 C112 97 111 98 110 104 C109 98 108 97 102 96 C108 95 109 94 110 88 Z"
      transform="translate(-55 -48) scale(1.5)"
    />
  </svg>
</template>

<style scoped>
.empty-ill {
  --ill-glow: var(--color-iris-50);
  --ill-glow-2: var(--color-lime-100);
  --ill-staff: var(--color-iris-400);
  --ill-cover: var(--color-iris-500);
  --ill-page: #ffffff;
  --ill-ink: var(--color-iris-950);
  --ill-lines: var(--color-iris-200);
  --ill-orange: var(--color-tangerine-500);
  --ill-orange-ink: var(--color-tangerine-700);
  --ill-cyan: var(--color-aqua-400);
  --ill-cyan-ink: var(--color-aqua-700);
  --ill-lime: var(--color-lime-400);
  height: auto;
}
.empty-ill__note,
.empty-ill__away,
.empty-ill__spark,
.empty-ill__lens {
  transform-box: fill-box;
  transform-origin: center;
}
.empty-ill__note {
  animation: ill-float 5s ease-in-out infinite;
}
.empty-ill__away {
  animation: ill-away 6s ease-in-out infinite;
}
.empty-ill__spark {
  animation: ill-twinkle 3.2s ease-in-out infinite;
}
.empty-ill__lens {
  animation: ill-scan 7s ease-in-out infinite;
}
@keyframes ill-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}
@keyframes ill-away {
  0% {
    transform: translate(0, 0);
    opacity: 1;
  }
  80% {
    opacity: 0;
  }
  100% {
    transform: translate(18px, -22px);
    opacity: 0;
  }
}
@keyframes ill-twinkle {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}
@keyframes ill-scan {
  0%,
  100% {
    transform: translate(0, 0) rotate(0);
  }
  50% {
    transform: translate(-12px, 4px) rotate(-6deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .empty-ill__note,
  .empty-ill__away,
  .empty-ill__spark,
  .empty-ill__lens {
    animation: none;
  }
}
</style>

<style>
/* Dark mode, unscoped (`:global(.dark) .x` compiles to `.dark` alone);
   `html` outranks the scoped light values. */
html.dark .empty-ill {
  --ill-glow: var(--color-iris-950);
  --ill-glow-2: var(--color-lime-950);
  --ill-staff: var(--color-iris-300);
  --ill-cover: var(--color-iris-400);
  --ill-page: var(--color-iris-100);
  --ill-lines: var(--color-iris-300);
  --ill-orange: var(--color-tangerine-400);
  --ill-orange-ink: var(--color-tangerine-300);
  --ill-cyan: var(--color-aqua-300);
  --ill-cyan-ink: var(--color-aqua-200);
  --ill-lime: var(--color-lime-300);
}
</style>
