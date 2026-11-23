<script lang="ts" setup>
const songStore = useSongStore();
const { filteredSongIdsByTitle, filteredSongsByTitle } = storeToRefs(songStore);
</script>

<template>
  <div class="flex-1">
    <div
      v-for="song in filteredSongsByTitle"
      :key="`song-by-title-${song.songId}`"
      class="song-item [&:not(:first-child)]:border-t [&:not(:first-child)]:border-base-300"
      :data-song-index="titleInitial(song.title)"
    >
      <SongItem :song />
    </div>
  </div>
  <!-- Sidebar of anchors -->
  <div
    v-if="filteredSongsByTitle.length > 15"
    class="sticky top-2 self-start h-[calc(100dvh-64px-52px-9rem)] shrink-0 mr-1"
  >
    <SidebarAnchors
      :ids="filteredSongIdsByTitle"
      :sections="15"
      @jump="songStore.jumpToSong"
    />
  </div>
</template>
