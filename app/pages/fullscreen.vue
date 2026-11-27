<script lang="ts" setup>
// The old projection console's address. Projection now has one console
// (/culto/vivo): this projects the open hymn there, for links and bookmarks
// that still point here.
definePageMeta({ bare: true });

const { projectHymn } = useProjectHymn();

onMounted(() => {
  projectHymn(undefined, true);
});
</script>

<template>
  <div class="min-h-dvh grid place-items-center">
    <UIcon name="i-tabler-loader-2" class="size-10 animate-spin text-primary" aria-label="Abriendo la proyección" />
  </div>
</template>
