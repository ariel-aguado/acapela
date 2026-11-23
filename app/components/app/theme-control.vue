<script setup lang="ts">
// Three states: an explicit choice, or follow the phone (which may switch to
// dark at night). "Sistema" says what it resolves to right now, so a dark
// app that nobody set to dark makes sense.
const colorMode = useColorMode();
// Own radio group per instance (Ajustes and the reading panel can coexist).
const groupName = `theme-${useId()}`;

const options = [
  { value: "light", label: "Claro", icon: "tabler:sun" },
  { value: "dark", label: "Oscuro", icon: "tabler:moon" },
  { value: "system", label: "Sistema", icon: "tabler:device-mobile" },
] as const;

// What the phone uses, whatever the app is set to.
const systemDark = usePreferredDark();
const systemNow = computed(() => (systemDark.value ? "ahora oscuro" : "ahora claro"));
</script>

<template>
  <fieldset class="flex flex-col gap-3">
    <legend class="font-medium mb-3">
      Tema
    </legend>
    <div class="grid grid-cols-3 gap-1 rounded-box bg-base-200 p-1" role="radiogroup">
      <label
        v-for="opt in options"
        :key="opt.value"
        class="flex flex-col items-center justify-center gap-0.5 min-h-16 py-1.5 rounded-field cursor-pointer text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
        :class="colorMode.preference === opt.value ? 'bg-base-100 shadow-sm font-semibold' : 'opacity-75'"
      >
        <input
          v-model="colorMode.preference"
          type="radio"
          :name="groupName"
          :value="opt.value"
          class="sr-only"
        >
        <Icon :name="opt.icon" size="20" aria-hidden="true" />
        {{ opt.label }}
        <ClientOnly v-if="opt.value === 'system'">
          <span class="text-xs font-normal opacity-70 leading-none">{{ systemNow }}</span>
        </ClientOnly>
      </label>
    </div>
  </fieldset>
</template>
