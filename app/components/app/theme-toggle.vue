<script lang="ts" setup>
const colorMode = useColorMode();

const isDark = computed({
  get() {
    return colorMode.value === "dark";
  },
  set(value) {
    colorMode.preference = value ? "dark" : "light";
  },
});
</script>

<template>
  <label class="swap swap-rotate w-12 h-12">
    <!-- this hidden checkbox controls the state -->
    <input v-model="isDark" type="checkbox" aria-label="Modo oscuro">

    <!-- sun icon -->
    <Icon
      name="tabler:sun"
      class="swap-on"
      size="28"
      aria-hidden="true"
    />

    <!-- moon icon -->
    <Icon
      name="tabler:moon-filled"
      class="swap-off"
      size="28"
      aria-hidden="true"
    />
  </label>
</template>
