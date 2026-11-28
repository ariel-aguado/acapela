<script setup lang="ts">
import { qrSvg } from "~/utils/culto/relay";

// «Mando»: pairs the presenter's phone as a remote control of this console.
// The QR carries a key: whoever has it can change the screens, so it is
// shown here and never on the projector. A new code unpairs the phone.
const props = defineProps<{
  /** The pairing link (with its key), or empty while it is prepared. */
  url: string;
  /** A paired phone was heard from recently. */
  connected: boolean;
  /** The relay could not be reached. */
  failed: boolean;
}>();
const emit = defineEmits<{ rotate: [] }>();
const open = defineModel<boolean>("open", { required: true });

const svg = computed(() => props.url
  ? qrSvg(props.url)
  : "");
</script>

<template>
  <UModal
    v-model:open="open"
    title="Mando en el teléfono"
    description="Pasa las pantallas, pon negro o el logo y lee tus notas desde el teléfono de quien dirige."
    :ui="{ content: 'sm:max-w-xl' }"
  >
    <template #body>
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          class="remote-qr mx-auto size-48 shrink-0 overflow-hidden rounded-xl bg-white p-1"
          role="img"
          aria-label="Código QR para emparejar el teléfono"
          data-remote-qr
          :data-remote-link="url || undefined"
        >
          <div v-if="svg" class="size-full" v-html="svg" />
          <div v-else class="grid size-full place-items-center">
            <UIcon name="i-tabler-loader-2" class="size-8 animate-spin text-primary" />
          </div>
        </div>
        <div class="flex min-w-0 flex-col gap-3 text-sm">
          <ol class="list-decimal space-y-1 ps-5">
            <li>Abre la cámara del teléfono y escanea el código.</li>
            <li>Toca el enlace: se abre el mando, sin instalar nada.</li>
            <li>Deja el teléfono a mano: la pantalla no se apaga mientras lo usas.</li>
          </ol>
          <p
            class="inline-flex items-center gap-2 font-semibold"
            :class="connected ? 'text-success' : failed ? 'text-warning' : 'text-muted'"
            role="status"
            data-remote-status
          >
            <span class="size-2.5 rounded-full" :class="connected ? 'bg-success' : failed ? 'bg-warning' : 'bg-inverted/30'" />
            {{ connected ? "Teléfono conectado" : failed ? "Sin conexión con el servidor de salas" : "Esperando el teléfono…" }}
          </p>
          <p class="rounded-lg bg-warning/10 px-3 py-2 text-xs">
            Quien tenga este código puede pasar las pantallas: no lo muestres en el proyector.
          </p>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-between gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-tabler-refresh"
          label="Código nuevo (desconecta el teléfono)"
          @click="emit('rotate')"
        />
        <UButton label="Listo" @click="open = false" />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.remote-qr :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
