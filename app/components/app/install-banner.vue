<script setup lang="ts">
const { showBanner, install, dismiss } = usePwaInstall();
// One notice at a time: the update notice wins because it affects the
// content the user is reading right now.
const { show: updatePending } = useUpdateNotification();
const route = useRoute();
// Never over the projected slides; the install option stays available
// from every other view.
const visible = computed(() =>
  showBanner.value && !updatePending.value && route.name !== "fullscreen",
);
// Sit above the bottom navigation bar (52px) and, on the reading view,
// above the hymn pager (64px) instead of covering them.
const bottomOffset = computed(() => {
  if (route.name === "fullscreen")
    return "0.75rem";
  const bars = route.name === "index" ? 52 + 64 : 52;
  return `calc(${bars}px + 0.75rem + env(safe-area-inset-bottom, 0px))`;
});
</script>

<template>
  <Transition name="banner-slide">
    <div
      v-if="visible"
      class="install-banner"
      :style="{ bottom: bottomOffset }"
      role="region"
      aria-label="Instalar aplicación"
    >
      <div class="install-banner__icon">
        <Icon name="tabler:download" size="24" />
      </div>
      <div class="install-banner__text">
        <p class="install-banner__title">
          Instala Acapela
        </p>
        <p class="install-banner__subtitle">
          Accede al himnario sin conexión a internet
        </p>
      </div>
      <div class="install-banner__actions">
        <button class="btn btn-primary btn-sm" @click="install">
          Instalar
        </button>
        <button
          class="btn btn-ghost btn-sm btn-circle"
          aria-label="Más tarde"
          @click="dismiss"
        >
          <Icon name="tabler:x" size="18" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.install-banner {
  position: fixed;
  bottom: 0.75rem;
  left: 0.75rem;
  right: 0.75rem;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: var(--color-base-100, #fff);
  color: var(--color-base-content, #1f2937);
  border-radius: 1rem;
  box-shadow:
    0 -4px 24px rgba(0, 0, 0, 0.15),
    0 0 0 1px rgba(0, 0, 0, 0.05);
  max-width: 32rem;
  margin: 0 auto;
}

.install-banner__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.625rem;
  background: var(--color-primary, #422ad5);
  color: var(--color-primary-content, #fff);
}

.install-banner__text {
  flex: 1;
  min-width: 0;
}

.install-banner__title {
  font-weight: 600;
  line-height: 1.2;
  margin: 0;
}

.install-banner__subtitle {
  font-size: 0.8125rem;
  opacity: 0.7;
  line-height: 1.25;
  margin: 0;
}

.install-banner__actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.banner-slide-enter-active,
.banner-slide-leave-active {
  transition:
    transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 200ms ease;
}

.banner-slide-enter-from,
.banner-slide-leave-to {
  transform: translateY(120%);
  opacity: 0;
}
</style>
