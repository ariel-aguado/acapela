<script setup lang="ts">
import type { Screen } from "~/utils/culto/screens";
import type { Background, ProjectionFont } from "~~/lib/culto";

import { resolveLook } from "~/utils/culto/look";
import { importImage, mediaUrl } from "~/utils/culto/media";
import { PROJECTION_FONTS } from "~~/lib/culto";

// The church's look on the projector: name, logo, background, accent and
// letter, for every service on this device. The preview shows it on a
// designed screen and on a hymn verse.
const open = defineModel<boolean>("open", { required: true });

const culto = useCultoStore();
const { theme } = storeToRefs(culto);

const ACCENTS = [
  "#ffffff",
  "#e2c48a",
  "#a9a6fa",
  "#8fd3b6",
  "#f2a7a0",
  "#9cc7f0",
];

const churchName = computed({
  get: () => theme.value.churchName,
  set: (churchName: string) => culto.setTheme({ churchName }),
});
const background = computed({
  get: () => theme.value.background,
  set: (value: Background | undefined) => culto.setTheme({ background: value ?? { kind: "acapela" } }),
});
const fontItems = PROJECTION_FONTS.map(f => ({ label: f.label, value: f.id }));

const logoInput = useTemplateRef<HTMLInputElement>("logo");
const logoUrl = ref<string | null>(null);
watchEffect(async () => {
  logoUrl.value = theme.value.logoId
    ? await mediaUrl(theme.value.logoId)
    : null;
});
async function onLogo(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = "";
  if (file)
    culto.setTheme({ logoId: await importImage(file, file.name) });
}

const look = computed(() => resolveLook(theme.value));
const sample = computed<Screen>(() => ({
  type: "page",
  layout: "quote",
  eyebrow: "Santa Cena",
  title: "«Haced esto en memoria de mí».",
  reference: "1 Corintios 11:24",
  html: "",
  footer: theme.value.churchName,
  counter: "",
  scale: 1,
  look: look.value,
}));
const logoSample = computed<Screen>(() => ({
  type: "page",
  layout: "logo",
  eyebrow: "",
  title: theme.value.churchName || "Nombre de la iglesia",
  reference: "",
  html: "",
  footer: "",
  counter: "",
  scale: 1,
  mediaId: theme.value.logoId,
  look: look.value,
}));
</script>

<template>
  <UModal
    v-model:open="open"
    title="Tema de la iglesia"
    description="Cómo se ven en el proyector todas las pantallas de los cultos de este dispositivo."
    :ui="{ content: 'sm:max-w-4xl' }"
  >
    <template #body>
      <div class="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div class="flex flex-col gap-5">
          <UFormField label="Nombre de la iglesia" help="Abajo en las pantallas, y en la pantalla del logo.">
            <UInput v-model="churchName" size="lg" class="w-full" />
          </UFormField>

          <UFormField label="Logo">
            <div class="flex items-center gap-3">
              <img
                v-if="logoUrl"
                :src="logoUrl"
                alt=""
                class="size-16 object-contain rounded-lg ring-1 ring-default bg-muted"
              >
              <UButton
                color="neutral"
                variant="outline"
                icon="i-tabler-upload"
                :label="theme.logoId ? 'Cambiar' : 'Subir logo'"
                @click="logoInput?.click()"
              />
              <UButton
                v-if="theme.logoId"
                color="neutral"
                variant="ghost"
                icon="i-tabler-x"
                label="Quitar"
                @click="culto.setTheme({ logoId: undefined })"
              />
            </div>
            <input
              ref="logo"
              type="file"
              accept="image/*"
              class="hidden"
              @change="onLogo"
            >
          </UFormField>

          <UFormField label="Fondo">
            <CultoBackgroundPicker v-model="background" />
          </UFormField>

          <UFormField label="Color de las etiquetas">
            <div class="flex flex-wrap gap-2">
              <button
                v-for="c in ACCENTS"
                :key="c"
                type="button"
                class="size-9 rounded-full ring-1 ring-default"
                :class="{ 'ring-2 ring-primary ring-offset-2 ring-offset-default': theme.accent === c }"
                :style="{ background: c }"
                :aria-label="`Color ${c}`"
                :aria-pressed="theme.accent === c"
                @click="culto.setTheme({ accent: c })"
              />
            </div>
          </UFormField>

          <UFormField label="Letra">
            <USelect
              :model-value="theme.font"
              :items="fontItems"
              size="lg"
              class="w-64"
              @update:model-value="v => culto.setTheme({ font: v as ProjectionFont })"
            />
          </UFormField>
        </div>

        <div class="flex flex-col gap-3">
          <span class="text-xs font-bold uppercase tracking-wider opacity-70">Así se ve</span>
          <div class="rounded-xl overflow-hidden ring-1 ring-default">
            <CultoScreen :screen="sample" />
          </div>
          <div class="rounded-xl overflow-hidden ring-1 ring-default">
            <CultoScreen :screen="logoSample" />
          </div>
          <p class="text-xs opacity-70">
            La pantalla del logo se proyecta con <UKbd value="L" /> en la consola en vivo.
          </p>
        </div>
      </div>
    </template>
  </UModal>
</template>
