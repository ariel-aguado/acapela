<script setup lang="ts">
import { cultoWhen } from "~/stores/culto";
import { qrSvg, roomUrl } from "~/utils/culto/relay";

// «Compartir con la congregación»: the service as a link for the church's
// group. It opens the program on any phone, read-only, to follow the
// service; the readings travel with their text; notes, messages and images
// stay here. The link also names the service's room, so the phones follow
// the screen live once the service starts; the QR (for the screen, or to
// print) is the room's short link. Built when the dialog opens.
const open = defineModel<boolean>("open", { required: true });

const culto = useCultoStore();
const { current } = storeToRefs(culto);
const { show: toast } = useUndoToast();
const programShare = useProgramShare();

const building = ref(false);
const url = ref("");
const shortUrl = ref("");
const qr = ref("");
/** The room got the program: the QR works. */
const online = ref(false);
const failed = ref<string[]>([]);
const error = ref("");

async function build() {
  const c = current.value;
  if (!c)
    return;
  building.value = true;
  error.value = "";
  failed.value = [];
  url.value = "";
  online.value = false;
  try {
    const { encoded, failed: missing } = await programShare.build(c);
    failed.value = missing;
    const room = programShare.roomFor(c.id);
    shortUrl.value = roomUrl(room.code);
    url.value = `${shortUrl.value}#${encoded}`;
    qr.value = qrSvg(shortUrl.value);
    // The full link works even without the relay; the QR needs it.
    programShare.publish(c.id, encoded, c.updatedAt)
      .then(({ room: kept }) => {
        if (kept.code !== room.code) {
          shortUrl.value = roomUrl(kept.code);
          url.value = `${shortUrl.value}#${encoded}`;
          qr.value = qrSvg(shortUrl.value);
        }
        online.value = true;
      })
      .catch(() => (online.value = false));
  }
  catch (err) {
    error.value = err instanceof Error
      ? err.message
      : String(err);
  }
  finally {
    building.value = false;
  }
}

watch(open, (value) => {
  if (value)
    build();
}, { immediate: true });

const message = computed(() => current.value
  ? `Programa del culto: ${current.value.title} · ${cultoWhen(current.value)}.\nÁbrelo en el teléfono para seguir el culto:\n${url.value}`
  : url.value);

const kb = computed(() => Math.max(1, Math.round(url.value.length / 1024)));

/** What goes and what stays, said plainly. */
const counts = computed(() => {
  const items = current.value?.items ?? [];
  const n = (kind: string) => items.filter(i => i.kind === kind).length;
  const plural = (k: number, one: string, many: string) => `${k} ${k === 1
    ? one
    : many}`;
  const goes: string[] = [];
  if (n("hymn"))
    goes.push(plural(n("hymn"), "himno", "himnos"));
  if (n("reading"))
    goes.push(`${plural(n("reading"), "lectura", "lecturas")} con su texto`);
  if (n("screen"))
    goes.push(plural(n("screen"), "pantalla", "pantallas"));
  const slides = items.filter(i => i.kind === "slides");
  return {
    goes: goes.join(", "),
    notes: items.some(i => i.notes?.trim()),
    messages: current.value?.messages?.length ?? 0,
    slides: slides.reduce((sum, i) => sum + (i.kind === "slides"
      ? i.pages.length
      : 0), 0),
  };
});

const canShare = ref(false);
onMounted(() => {
  canShare.value = typeof navigator.share === "function";
});

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  }
  catch {
    toast("No se pudo copiar. Selecciona el enlace y cópialo a mano.");
  }
}

async function share() {
  try {
    await navigator.share({ title: current.value?.title ?? "Programa del culto", text: message.value });
  }
  catch (err) {
    if (!(err instanceof Error && err.name === "AbortError"))
      copy(message.value, "Mensaje copiado. Pégalo en el grupo de la iglesia.");
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Compartir con la congregación"
    description="Un enlace para el grupo de la iglesia: abre el programa del culto en cualquier teléfono, sin instalar nada, para seguirlo mientras se proyecta."
    :ui="{ content: 'sm:max-w-xl' }"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <div v-if="building" class="flex items-center gap-3 rounded-xl bg-elevated px-4 py-3 text-sm">
          <UIcon name="i-tabler-loader-2" class="size-5 animate-spin text-primary" />
          Preparando el programa…
        </div>
        <p v-else-if="error" class="rounded-xl bg-error/10 px-4 py-3 text-sm text-error">
          No se pudo preparar el enlace: {{ error }}
        </p>
        <template v-else-if="url">
          <div class="flex items-center gap-2">
            <UInput
              :model-value="url"
              readonly
              class="min-w-0 flex-1"
              icon="i-tabler-link"
              aria-label="Enlace del programa"
              data-program-link
              @focus="($event.target as HTMLInputElement).select()"
            />
            <UButton
              color="neutral"
              variant="outline"
              icon="i-tabler-copy"
              label="Copiar"
              @click="copy(url, 'Enlace copiado.')"
            />
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="canShare"
              icon="i-tabler-share"
              label="Compartir…"
              @click="share"
            />
            <UButton
              :color="canShare ? 'neutral' : 'primary'"
              :variant="canShare ? 'outline' : 'solid'"
              icon="i-tabler-message-share"
              label="Copiar mensaje para el grupo"
              @click="copy(message, 'Mensaje copiado. Pégalo en el grupo de la iglesia.')"
            />
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-tabler-device-mobile"
              label="Ver cómo se ve"
              :to="url"
              target="_blank"
            />
          </div>
        </template>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-xl bg-elevated px-4 py-3 text-sm">
            <p class="mb-1 flex items-center gap-2 font-semibold">
              <UIcon name="i-tabler-check" class="size-4 text-success" /> Va en el enlace
            </p>
            <p class="text-muted">
              El orden{{ counts.goes ? `: ${counts.goes}` : "" }}. Con el nombre de la iglesia y sus colores.
            </p>
          </div>
          <div class="rounded-xl bg-elevated px-4 py-3 text-sm">
            <p class="mb-1 flex items-center gap-2 font-semibold">
              <UIcon name="i-tabler-lock" class="size-4 text-muted" /> Se queda aquí
            </p>
            <p class="text-muted">
              Las notas del presentador, los mensajes sobre la pantalla<template v-if="counts.slides">
                , las {{ counts.slides }} diapositivas del sermón
              </template> y las imágenes de fondo.
            </p>
          </div>
        </div>
        <div v-if="url && qr" class="flex items-center gap-4 rounded-xl ring-1 ring-default p-3">
          <div
            class="share-qr size-32 shrink-0 overflow-hidden rounded-lg bg-white"
            role="img"
            :aria-label="`Código QR: ${shortUrl}`"
            data-program-qr
            v-html="qr"
          />
          <div class="flex min-w-0 flex-col gap-1 text-sm">
            <p class="font-semibold">
              Código QR para la pantalla
            </p>
            <p class="text-muted">
              Para quien llega sin el enlace. En la consola en vivo, la tecla <kbd class="rounded bg-elevated px-1 font-mono">Q</kbd> lo muestra sobre la pantalla.
            </p>
            <p class="truncate font-mono text-xs text-muted">
              {{ shortUrl.replace(/^https?:\/\//, "") }}
            </p>
            <p v-if="!online" class="text-xs text-warning">
              Sin conexión con el servidor de salas: el QR funcionará cuando la consola se conecte.
            </p>
          </div>
        </div>
        <p v-if="failed.length" class="rounded-xl bg-warning/10 px-4 py-3 text-sm">
          No se pudo leer {{ failed.map(f => `«${f}»`).join(", ") }}: en el teléfono aparecerá solo la cita.
        </p>
        <p class="text-xs text-muted">
          <template v-if="url">
            Enlace de {{ kb }} KB.
          </template>
          Durante el culto, los teléfonos siguen la pantalla y reciben los cambios del orden solos.
        </p>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.share-qr :deep(svg) {
  width: 100%;
  height: 100%;
}
</style>
