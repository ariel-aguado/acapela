<script setup lang="ts">
// Three states: an explicit choice, or follow the phone (which may switch to
// dark at night).
const colorMode = useColorMode();

const options = [
  { value: "light", label: "Claro", icon: "tabler:sun" },
  { value: "dark", label: "Oscuro", icon: "tabler:moon" },
  { value: "system", label: "Sistema", icon: "tabler:device-mobile" },
] as const;
</script>

<template>
  <fieldset class="flex flex-col gap-2">
    <legend class="font-medium mb-2">
      Tema
    </legend>
    <div class="grid grid-cols-3 gap-1 rounded-box bg-base-200 p-1" role="radiogroup">
      <label
        v-for="opt in options"
        :key="opt.value"
        class="flex flex-col items-center justify-center gap-1 h-14 rounded-field cursor-pointer text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
        :class="colorMode.preference === opt.value ? 'bg-base-100 shadow-sm font-semibold' : 'opacity-75'"
      >
        <input
          v-model="colorMode.preference"
          type="radio"
          name="theme"
          :value="opt.value"
          class="sr-only"
        >
        <Icon :name="opt.icon" size="20" aria-hidden="true" />
        {{ opt.label }}
      </label>
    </div>
  </fieldset>
</template>
