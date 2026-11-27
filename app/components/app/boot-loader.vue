<script setup lang="ts">
const props = defineProps<{
  status: "idle" | "loading" | "ready" | "error";
  error?: unknown;
}>();

// The songbook being prepared, by name (the manifest loads before it).
const { currentSongbook } = storeToRefs(useSongbookStore());

const message = computed(() => {
  switch (props.status) {
    case "loading":
      return "Preparando el himnario";
    case "error":
      return "No se pudo cargar el himnario";
    case "idle":
    case "ready":
    default:
      return "";
  }
});

const shouldRender = computed(() => props.status === "loading" || props.status === "error");
</script>

<template>
  <Transition name="boot-fade">
    <div
      v-if="shouldRender"
      class="boot-loader"
      role="status"
      aria-live="polite"
    >
      <div class="boot-loader__inner">
        <AppBrandMark class="boot-loader__mark" :class="{ 'boot-loader__mark--pulse': status === 'loading' }" />
        <p class="boot-loader__text">
          {{ message }}
          <b v-if="status === 'loading' && currentSongbook" class="boot-loader__name">{{ currentSongbook.name }}</b>
        </p>
        <p v-if="status === 'error'" class="boot-loader__hint">
          Revisa tu conexión y vuelve a cargar la página.
        </p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.boot-loader {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  background: var(--app-canvas, #fafafa);
  color: var(--ui-primary, #715de3);
}

.boot-loader__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  padding: 2rem;
  text-align: center;
}

.boot-loader__mark {
  width: 4.5rem;
  height: 4.5rem;
}

/* A soft breath while loading; still when the user asks for less motion. */
.boot-loader__mark--pulse {
  animation: boot-breathe 1.6s ease-in-out infinite;
}

.boot-loader__text {
  font-size: 1rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: var(--ui-text, #3f3f46);
  opacity: 0.8;
  margin: 0;
}

.boot-loader__name {
  display: block;
  font-weight: 700;
  opacity: 1;
}

.boot-loader__hint {
  font-size: 0.875rem;
  color: var(--ui-text, #3f3f46);
  opacity: 0.7;
  margin: 0;
}

@keyframes boot-breathe {
  50% {
    opacity: 0.55;
    transform: scale(0.94);
  }
}

@media (prefers-reduced-motion: reduce) {
  .boot-loader__mark--pulse {
    animation: none;
  }
}

.boot-fade-leave-active {
  transition: opacity 280ms ease;
}
.boot-fade-leave-to {
  opacity: 0;
}
</style>
