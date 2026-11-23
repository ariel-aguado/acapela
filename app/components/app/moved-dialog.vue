<script setup lang="ts">
// Shown once, right after arriving from an old *.vercel.app address with
// imported data (see plugins/00.legacy-import.client.ts).
const moved = useState<{ songbookId: string; favorites: number } | null>("legacy-import", () => null);
const songbookStore = useSongbookStore();
const { showBanner: canPrompt, install, isInstalled } = usePwaInstall();

const songbookName = computed(() =>
  songbookStore.manifest.find(s => s.id === moved.value?.songbookId)?.name ?? "",
);
const broughtText = computed(() => {
  const name = songbookName.value
    ? ` (${songbookName.value})`
    : "";
  const favs = moved.value?.favorites ?? 0;
  return favs > 0
    ? `Trajimos tu himnario${name} y tus ${favs} favoritos.`
    : `Trajimos tu himnario${name}.`;
});
const isIos = import.meta.client && /iphone|ipad|ipod/i.test(navigator.userAgent);

async function onInstall() {
  await install();
}

function close() {
  moved.value = null;
}
</script>

<template>
  <div
    v-if="moved"
    class="modal modal-open"
    role="dialog"
    aria-labelledby="moved-title"
  >
    <div class="modal-box">
      <h3 id="moved-title" class="text-xl font-bold">
        Acapela tiene nueva dirección
      </h3>
      <p class="mt-3">
        Ahora estamos en <strong>acapela.app</strong>. {{ broughtText }}
      </p>

      <ol class="mt-4 list-decimal space-y-3 pl-5">
        <li>
          <strong>Instala la app desde esta dirección.</strong>
          <template v-if="isInstalled">
            Ya está instalada.
          </template>
          <template v-else-if="canPrompt">
            <button class="btn btn-primary btn-sm mt-2 block" @click="onInstall">
              Instalar Acapela
            </button>
          </template>
          <template v-else-if="isIos">
            En Safari, toca <em>Compartir</em> y luego <em>Agregar a pantalla de inicio</em>.
          </template>
          <template v-else>
            Abre el menú del navegador y elige <em>Instalar app</em> o <em>Agregar a la pantalla de inicio</em>.
          </template>
        </li>
        <li>
          <strong>Borra la app anterior</strong> (el ícono que se llamaba “Acappella”). Ya no se actualiza.
        </li>
      </ol>

      <div class="modal-action">
        <button class="btn" @click="close">
          Entendido
        </button>
      </div>
    </div>
  </div>
</template>
