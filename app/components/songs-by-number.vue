<script lang="ts" setup>
const songStore = useSongStore();
const { filteredSongIdsByNumber, filteredSongsByNumber } = storeToRefs(songStore);
// Every hymn of the list: the side index moves through them one by one.
const allIds = computed(() => filteredSongsByNumber.value.map(s => s.songId));
</script>

<template>
  <div class="flex-1">
    <div
      v-for="song in filteredSongsByNumber"
      :key="`song-by-number-${song.songId}`"
      class="song-item [&:not(:first-child)]:border-t [&:not(:first-child)]:border-default"
      :data-song-index="song.songId"
    >
      <SongItem :song />
    </div>
  </div>
  <!-- Sidebar of anchors -->
  <div
    v-if="filteredSongsByNumber.length > 15"
    class="sticky top-2 self-start rail-height shrink-0"
  >
    <SidebarAnchors
      :ids="filteredSongIdsByNumber"
      :sections="15"
      :steps="allIds"
      @jump="songStore.jumpToSong"
    />
  </div>
</template>
