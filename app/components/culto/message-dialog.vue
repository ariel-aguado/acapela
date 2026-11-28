<script setup lang="ts">
import type { Screen } from "~/utils/culto/screens";
import type { MessageAnimation, MessageKind, MessagePosition, MessageSize, ScreenMessage } from "~~/lib/culto";

import {
  MESSAGE_ANIMATION_LABELS,
  MESSAGE_KIND_LABELS,
  MESSAGE_POSITION_LABELS,
  MESSAGE_SIZE_LABELS,
  MESSAGE_TEMPLATES,
  PROJECTION_FONTS,
} from "~~/lib/culto";

// Writes a message over the screen: its kind (which sets place, look and
// motion), its words, and every setting, seen live on the screen it will
// cover. In the editor it can be hung on an element; in the live console it
// can be shown at once.
const props = withDefaults(defineProps<{
  /** The one to edit; none: a new one. */
  message?: ScreenMessage | null;
  /** Elements it can be hung on; none: not offered. */
  items?: { id: string; label: string }[];
  /** Offer «Guardar y mostrar» (live console). */
  live?: boolean;
  /** What the preview shows under the message. */
  screen?: Screen | null;
}>(), {
  message: null,
  items: undefined,
  live: false,
  screen: null,
});
const emit = defineEmits<{
  (e: "save", message: ScreenMessage, show: boolean): void;
  (e: "remove", id: string): void;
}>();
const open = defineModel<boolean>("open", { required: true });

const culto = useCultoStore();
const themeFont = computed(() => PROJECTION_FONTS.find(f => f.id === culto.theme.font)?.css ?? "\"Inter\", sans-serif");

const draft = ref<ScreenMessage>(culto.newMessage("notice"));
const isNew = ref(true);
watch(open, (value) => {
  if (!value)
    return;
  isNew.value = !props.message;
  draft.value = props.message
    ? JSON.parse(JSON.stringify(props.message))
    : culto.newMessage("notice");
}, { immediate: true });

const KINDS = Object.keys(MESSAGE_KIND_LABELS) as MessageKind[];
const KIND_ICONS: Record<MessageKind, string> = {
  alert: "i-tabler-alert-triangle",
  notice: "i-tabler-speakerphone",
  notification: "i-tabler-bell",
  congrats: "i-tabler-confetti",
  welcome: "i-tabler-heart-handshake",
  prayer: "i-tabler-pray",
  countdown: "i-tabler-clock",
  ticker: "i-tabler-news",
};

/** Another kind: its template, keeping the id and where it is hung. */
function pickKind(kind: MessageKind) {
  const { id, trigger } = draft.value;
  draft.value = {
    ...culto.newMessage(kind),
    id,
    ...(trigger
      ? { trigger }
      : {}),
  };
}

const fontItems = [
  { label: "La del tema de la iglesia", value: "theme" },
  ...PROJECTION_FONTS.map(f => ({ label: f.label, value: f.id })),
];
const SIZES = Object.keys(MESSAGE_SIZE_LABELS) as MessageSize[];
const ANIMATIONS = Object.keys(MESSAGE_ANIMATION_LABELS) as MessageAnimation[];
const GRID: MessagePosition[] = [
  "top-start",
  "top",
  "top-end",
  "start",
  "center",
  "end",
  "bottom-start",
  "bottom",
  "bottom-end",
];
const BANDS: MessagePosition[] = ["band-top", "band-bottom"];

const isCountdown = computed(() => draft.value.kind === "countdown");
const durations = computed(() => isCountdown.value
  ? [1, 2, 3, 5, 10, 15].map(m => ({ value: m * 60, label: `${m} min` }))
  : [
      { value: 5, label: "5 s" },
      { value: 10, label: "10 s" },
      { value: 15, label: "15 s" },
      { value: 30, label: "30 s" },
      { value: 60, label: "1 min" },
      { value: 0, label: "Hasta quitarlo" },
    ]);

// Hung on an element of the order, or launched by hand.
const MANUAL = "__manual";
const triggerItem = computed({
  get: () => draft.value.trigger?.itemId ?? MANUAL,
  set: (value: string) => {
    if (value === MANUAL) {
      const { trigger: _t, ...rest } = draft.value;
      draft.value = rest;
    }
    else {
      draft.value = {
        ...draft.value,
        trigger: { itemId: value, delay: draft.value.trigger?.delay ?? 0 },
      };
    }
  },
});
const triggerItems = computed(() => [
  { label: "Lo muestro yo, desde la consola", value: MANUAL },
  ...(props.items ?? []).map(i => ({ label: `Al empezar: ${i.label}`, value: i.id })),
]);
const delayItems = [0, 3, 5, 10, 30, 60].map(s => ({
  label: s
    ? `${s} s después`
    : "En el momento",
  value: s,
}));
const delay = computed({
  get: () => draft.value.trigger?.delay ?? 0,
  set: (value: number) => {
    if (draft.value.trigger) {
      draft.value = {
        ...draft.value,
        trigger: { ...draft.value.trigger, delay: value },
      };
    }
  },
});

// The preview replays the entrance on every change.
const replayKey = ref(0);
const replayAt = ref(Date.now());
function replay() {
  replayKey.value++;
  replayAt.value = Date.now();
}
watch(draft, replay, { deep: true });
const preview = computed(() => ({
  message: draft.value,
  key: `preview-${replayKey.value}`,
  startedAt: replayAt.value,
  themeFont: themeFont.value,
}));

const canSave = computed(() => !!(draft.value.text.trim() || draft.value.title.trim() || isCountdown.value));
function save(show: boolean) {
  if (!canSave.value)
    return;
  emit("save", draft.value, show);
  open.value = false;
}
function remove() {
  emit("remove", draft.value.id);
  open.value = false;
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="isNew ? 'Mensaje nuevo' : 'Editar mensaje'"
    description="Aparece encima de lo que se está proyectando, sin cambiar la pantalla."
    :ui="{ content: 'sm:max-w-5xl' }"
  >
    <template #body>
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        <div class="flex flex-col gap-3 min-w-0 lg:sticky lg:top-0 lg:self-start">
          <div class="overflow-hidden rounded-xl ring-1 ring-default">
            <CultoLiveScreen :screen="screen" :message="preview" :animate="false" />
          </div>
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm text-muted">
              {{ MESSAGE_TEMPLATES[draft.kind].hint }}
            </p>
            <UButton
              color="neutral"
              variant="outline"
              icon="i-tabler-player-play"
              label="Ver de nuevo"
              @click="replay"
            />
          </div>

          <UFormField label="Tipo">
            <div class="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label="Tipo de mensaje">
              <button
                v-for="k in KINDS"
                :key="k"
                type="button"
                role="radio"
                :aria-checked="draft.kind === k"
                class="flex min-h-12 items-center gap-2 rounded-xl px-3 py-2 text-start text-sm ring-1 transition-colors"
                :class="draft.kind === k ? 'bg-primary/10 font-semibold text-highlighted ring-primary' : 'ring-default hover:bg-elevated'"
                @click="pickKind(k)"
              >
                <UIcon :name="KIND_ICONS[k]" class="size-5 shrink-0 text-primary" />
                {{ MESSAGE_KIND_LABELS[k] }}
              </button>
            </div>
          </UFormField>
        </div>

        <div class="flex flex-col gap-5 min-w-0">
          <UFormField label="Título" help="Pequeño, arriba. Puede quedar vacío.">
            <UInput v-model="draft.title" size="lg" class="w-full" />
          </UFormField>
          <UFormField :label="isCountdown ? 'Texto debajo (opcional)' : 'Mensaje'">
            <UTextarea
              v-model="draft.text"
              :rows="2"
              autoresize
              size="lg"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Letra">
            <USelect v-model="draft.font" :items="fontItems" class="w-full" />
          </UFormField>

          <UFormField label="Tamaño">
            <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tamaño">
              <UButton
                v-for="s in SIZES"
                :key="s"
                role="radio"
                :aria-checked="draft.size === s"
                :color="draft.size === s ? 'primary' : 'neutral'"
                :variant="draft.size === s ? 'solid' : 'outline'"
                :label="MESSAGE_SIZE_LABELS[s]"
                @click="draft.size = s"
              />
            </div>
          </UFormField>

          <UFormField label="Ubicación" :help="MESSAGE_POSITION_LABELS[draft.position]">
            <div class="flex items-start gap-3">
              <div class="grid grid-cols-3 gap-1 rounded-xl bg-elevated p-1.5 ring-1 ring-default" role="radiogroup" aria-label="Ubicación">
                <button
                  v-for="p in GRID"
                  :key="p"
                  type="button"
                  role="radio"
                  :aria-checked="draft.position === p"
                  :aria-label="MESSAGE_POSITION_LABELS[p]"
                  :title="MESSAGE_POSITION_LABELS[p]"
                  class="grid h-8 w-12 place-items-center rounded-md transition-colors"
                  :class="draft.position === p ? 'bg-primary' : 'bg-default hover:ring-1 hover:ring-primary'"
                  @click="draft.position = p"
                >
                  <span class="size-2.5 rounded-sm" :class="draft.position === p ? 'bg-white' : 'bg-accented'" />
                </button>
              </div>
              <div class="flex flex-col gap-1.5">
                <UButton
                  v-for="p in BANDS"
                  :key="p"
                  role="radio"
                  :aria-checked="draft.position === p"
                  :color="draft.position === p ? 'primary' : 'neutral'"
                  :variant="draft.position === p ? 'solid' : 'outline'"
                  :label="MESSAGE_POSITION_LABELS[p]"
                  @click="draft.position = p"
                />
              </div>
            </div>
          </UFormField>

          <UFormField label="Animación">
            <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Animación">
              <UButton
                v-for="a in ANIMATIONS"
                :key="a"
                role="radio"
                :aria-checked="draft.animation === a"
                :color="draft.animation === a ? 'primary' : 'neutral'"
                :variant="draft.animation === a ? 'solid' : 'outline'"
                :label="MESSAGE_ANIMATION_LABELS[a]"
                @click="draft.animation = a"
              />
            </div>
          </UFormField>

          <UFormField :label="isCountdown ? 'Cuenta' : 'Tiempo en pantalla'" :help="isCountdown ? 'Se quita sola al llegar a cero.' : 'Se quita sola al terminar; también se puede quitar antes.'">
            <div class="flex flex-wrap gap-1.5" role="radiogroup" :aria-label="isCountdown ? 'Cuenta' : 'Tiempo en pantalla'">
              <UButton
                v-for="d in durations"
                :key="d.value"
                role="radio"
                :aria-checked="draft.duration === d.value"
                :color="draft.duration === d.value ? 'primary' : 'neutral'"
                :variant="draft.duration === d.value ? 'solid' : 'outline'"
                :label="d.label"
                @click="draft.duration = d.value"
              />
            </div>
          </UFormField>

          <UFormField v-if="items?.length" label="Cuándo aparece">
            <div class="flex flex-col gap-2">
              <USelect v-model="triggerItem" :items="triggerItems" class="w-full" />
              <USelect
                v-if="draft.trigger"
                v-model="delay"
                :items="delayItems"
                class="w-full"
              />
            </div>
          </UFormField>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap items-center gap-2">
        <UButton
          v-if="!isNew"
          color="error"
          variant="ghost"
          icon="i-tabler-trash"
          label="Eliminar"
          @click="remove"
        />
        <span class="flex-1" />
        <UButton
          color="neutral"
          variant="ghost"
          label="Cancelar"
          @click="open = false"
        />
        <UButton
          :color="live ? 'neutral' : 'primary'"
          :variant="live ? 'outline' : 'solid'"
          label="Guardar"
          :disabled="!canSave"
          @click="save(false)"
        />
        <UButton
          v-if="live"
          icon="i-tabler-player-play-filled"
          label="Guardar y mostrar"
          :disabled="!canSave"
          @click="save(true)"
        />
      </div>
    </template>
  </UModal>
</template>
