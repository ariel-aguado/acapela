<script setup lang="ts">
// Acapela's mark: an A drawn as two beamed eighth notes. The legs are the
// stems, the crossbar is the beam and the note heads sit at the feet, so the
// letter and ♫ are one figure: two notes sung together. One colour
// (currentColor); public/logo.svg and the install icons are drawn from the
// same paths (scripts/brand-assets.mjs).
</script>

<template>
  <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <g fill="currentColor" stroke="currentColor" transform="translate(5 -0.4)">
      <path
        d="M21 48 32 12 43 48"
        fill="none"
        stroke-width="6.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path d="M23.6 34.5h16.8" fill="none" stroke-width="7" />
      <ellipse
        cx="15.2"
        cy="50.5"
        rx="7.6"
        ry="5.6"
        transform="rotate(-24 15.2 50.5)"
        stroke="none"
      />
      <ellipse
        cx="37.4"
        cy="50.5"
        rx="7.6"
        ry="5.6"
        transform="rotate(-24 37.4 50.5)"
        stroke="none"
      />
    </g>
  </svg>
</template>
