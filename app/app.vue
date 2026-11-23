<script lang="ts" setup>
setupPageHeader();

const { status, error } = useSongbookWorker();
const songbookStore = useSongbookStore();
// The projector window shows only slides: no loader, pickers or dialogs.
const route = useRoute();
const isProjector = computed(() => route.name === "projector");

// Show the first-run picker only after the manifest is loaded (so we know
// what songbooks to offer) AND while no songbook is currently selected.
const showFirstRunOverlay = computed(
  () => songbookStore.manifest.length > 0 && !songbookStore.currentId && !isProjector.value,
);
</script>

<template>
  <UApp>
    <NuxtPwaManifest />
    <AppBootLoader v-if="!isProjector" :status="status" :error="error" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <AppSongbookSelector v-if="showFirstRunOverlay" />
    <AppInstallBanner />
    <AppUpdateToast />
    <AppUndoToast />
    <AppMovedDialog v-if="!isProjector" />
  </UApp>
</template>
