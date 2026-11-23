<script lang="ts" setup>
const songStore = useSongStore();
const { filteredSongIdsByNumber, filteredSongsByNumber } = storeToRefs(songStore);
</script>

<template>
  <div class="flex-1">
    <div
      v-for="song in filteredSongsByNumber"
      :key="`song-by-number-${song.songId}`"
      class="song-item [&:not(:first-child)]:border-t [&:not(:first-child)]:border-base-300"
      :data-song-index="song.songId"
    >
      <SongItem :song />
    </div>
  </div>
  <!-- Sidebar of anchors -->
  <div
    v-if="filteredSongsByNumber.length > 15"
    class="sticky top-2 self-start h-[calc(100dvh-64px-52px-9rem)] shrink-0 mr-1"
  >
    <SidebarAnchors
      :ids="filteredSongIdsByNumber"
      :sections="15"
      @jump="songStore.jumpToSong"
    />
  </div>
</template>
