<script setup lang="ts">
const { showBanner, install, dismiss } = usePwaInstall();
// One notice at a time: the update notice wins because it affects the
// content the user is reading right now.
const { show: updatePending } = useUpdateNotification();
const route = useRoute();
// Never over the projected slides; the install option stays available
// from every other view.
// Invite only after the app proved useful (three hymns opened): asking on the
// first visit interrupts before the user knows what Acapela is. The option
// is always available in Ajustes.
const songStore = useSongStore();
const engaged = computed(() => songStore.recentSongIds.length >= 3);
const visible = computed(() =>
  showBanner.value && engaged.value && !updatePending.value && route.meta.bare !== true,
);
const bottomOffset = computed(() => {
  if (route.meta.bare === true)
    return "0.75rem";
  // Above the floating bottom navigation.
  return "var(--bar-bottom)";
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
      <!-- The real app icon: what will appear on the home screen. -->
      <AppIcon class="size-11" />
      <div class="install-banner__text">
        <p class="install-banner__title">
          Instala Acapela
        </p>
        <p class="install-banner__subtitle">
          Ábrela desde tu pantalla de inicio, también sin conexión
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
