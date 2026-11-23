<script lang="ts" setup>
// Lyric search is now part of the single search (Buscar). Kept as a route so
// old links, installed-app shortcuts and bookmarks keep working.
definePageMeta({
  redirect: to => ({ path: "/search", query: to.query }),
});
</script>

<template>
  <div />
</template>
