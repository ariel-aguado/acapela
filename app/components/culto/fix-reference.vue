<script lang="ts" setup>
import type { ItemScreens } from "~/composables/use-culto-screens";
import type { CultoItem } from "~~/lib/culto";

// Editing an element while the service is live (NN/g: recovering from an
// error is quick and at hand, and nothing changes on the congregation's
// screen without the operator seeing it first): everything the editor has
// for it (a hymn's number, a reading's passage, a screen's texts, design,
// styles and background…), over a copy; the screens it will give; and how
// to apply it. A side panel over the order, so the screen on air stays in
// sight.
const props = defineProps<{
  entry: ItemScreens | null;
  /** The element is on air: show it now or when moving on. */
  onAir: boolean;
}>();
const emit = defineEmits<{
  apply: [changes: Partial<CultoItem>, show: "now" | "later" | "none"];
}>();
const open = defineModel<boolean>("open", { required: true });

/** What the operator changed, not yet applied. */
const edits = ref<Partial<CultoItem>>({});
watch([
  open,
  () => props.entry?.item.id,
], () => {
  edits.value = {};
}, { immediate: true });

function propose(changes: Partial<CultoItem>) {
  edits.value = {
    ...edits.value,
    ...changes,
  } as Partial<CultoItem>;
}

/** The changes that really differ from the element. */
const changes = computed<Partial<CultoItem>>(() => {
  const item = props.entry?.item as Record<string, unknown> | undefined;
  if (!item)
    return {};
  return Object.fromEntries(Object.entries(edits.value)
    .filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(item[key]))) as Partial<CultoItem>;
});
const changed = computed(() => Object.keys(changes.value).length > 0);

// The screens it will give, measured as on the projector.
const draft = computed<CultoItem[]>(() => (props.entry && open.value
  ? [
      {
        ...props.entry.item,
        ...edits.value,
        id: `${props.entry.item.id}-fix`,
      } as CultoItem,
    ]
  : []));
const { entries: preview } = useCultoScreens(draft);
const previewEntry = computed(() => preview.value[0] ?? null);
const ready = computed(() => changed.value && previewEntry.value?.status === "ready" && previewEntry.value.screens.length > 0);

// Enter in a field (the passage, a hymn's number, a title…) takes it; the
// next Enter applies it: the button that does is focused as soon as its
// screens are ready (it stays disabled until then). Typing on drops it.
const wantCta = ref(false);
// Not while Enter is still down: the same key press would press the button
// (a hymn's screens are ready at once) and apply it without a second Enter.
const enterDown = ref(false);
const cta = useTemplateRef<HTMLElement>("cta");
function referenceDone() {
  wantCta.value = true;
}
function onFormKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement;
  if (event.key === "Enter" && !event.shiftKey && target.tagName === "INPUT")
    wantCta.value = true;
  else if (event.key.length === 1 || event.key === "Backspace" || event.key === "Delete")
    wantCta.value = false;
}
// Anywhere (the passage's «Elegir» opens outside the form).
useEventListener("keydown", (event: KeyboardEvent) => {
  if (event.key === "Enter")
    enterDown.value = true;
}, { capture: true });
useEventListener("keyup", (event: KeyboardEvent) => {
  if (event.key === "Enter")
    enterDown.value = false;
});
watch([
  ready,
  wantCta,
  enterDown,
], async () => {
  if (!ready.value || !wantCta.value || enterDown.value)
    return;
  wantCta.value = false;
  await nextTick();
  cta.value?.querySelector<HTMLElement>("[data-cta]")?.focus();
});

// Opens in the first text field, with what it holds selected: ready to
// type over it.
const form = useTemplateRef<HTMLElement>("form");
watch(open, (isOpen) => {
  wantCta.value = false;
  enterDown.value = false;
  if (!isOpen)
    return;
  setTimeout(() => {
    const fields = form.value?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=file]), textarea");
    const first = [
      ...fields ?? [],
    ].find(el => el.offsetParent !== null);
    first?.focus();
    first?.select();
  }, 80);
});

const TITLES: Record<CultoItem["kind"], string> = {
  reading: "Corregir la cita",
  hymn: "Editar el himno",
  slides: "Editar las diapositivas",
  screen: "Editar la pantalla",
};
const title = computed(() => TITLES[props.entry?.item.kind ?? "screen"]);

function apply(show: "now" | "later" | "none") {
  emit("apply", changes.value, show);
  open.value = false;
}
</script>

<template>
  <USlideover
    v-model:open="open"
    side="right"
    :overlay="false"
    :title="title"
    :description="entry?.label"
    :ui="{ content: 'max-w-lg' }"
  >
    <template #body>
      <div v-if="entry && previewEntry" class="flex flex-col gap-5">
        <section class="flex flex-col gap-2" aria-label="Cómo quedará">
          <h3 class="text-xs font-bold uppercase tracking-wider text-muted">
            Cómo quedará
            <template v-if="previewEntry.status === 'ready'">
              · {{ previewEntry.screens.length }} {{ previewEntry.screens.length === 1 ? 'pantalla' : 'pantallas' }}
            </template>
            <template v-if="!changed">
              · sin cambios
            </template>
          </h3>
          <p v-if="previewEntry.status === 'error'" class="rounded-xl bg-warning/10 px-3 py-2 text-sm font-medium text-warning">
            {{ previewEntry.error }}
          </p>
          <div v-else-if="previewEntry.status === 'loading' && !previewEntry.screens.length" class="grid aspect-video place-items-center rounded-xl bg-muted">
            <UIcon name="i-tabler-loader-2" class="size-6 animate-spin opacity-60" aria-label="Preparando" />
          </div>
          <ol v-else class="soft-scrollbar grid max-h-64 grid-cols-3 gap-2 overflow-y-auto">
            <li v-for="(s, i) in previewEntry.screens" :key="i" class="relative overflow-hidden rounded-lg ring-1 ring-default">
              <CultoScreen :screen="s" />
              <span class="absolute bottom-1 left-1 grid h-5 min-w-5 place-items-center rounded-full bg-black/70 px-1 text-[0.68rem] font-bold text-white tabular-nums">{{ i + 1 }}</span>
            </li>
          </ol>
        </section>

        <div ref="form" @keydown="onFormKeydown">
          <CultoItemEditor
            :entry="previewEntry"
            live
            @change="propose"
            @reference-done="referenceDone"
          />
        </div>
      </div>
    </template>
    <template #footer>
      <div ref="cta" class="flex w-full flex-wrap justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          label="Cancelar"
          @click="open = false"
        />
        <template v-if="onAir">
          <UButton
            color="neutral"
            variant="outline"
            label="Aplicar al pasar"
            title="La pantalla actual sigue hasta que avances"
            :disabled="!ready"
            @click="apply('later')"
          />
          <UButton
            data-cta
            icon="i-tabler-broadcast"
            label="Aplicar y mostrar"
            :disabled="!ready"
            @click="apply('now')"
          />
        </template>
        <UButton
          v-else
          data-cta
          icon="i-tabler-check"
          label="Aplicar"
          :disabled="!ready"
          @click="apply('none')"
        />
      </div>
    </template>
  </USlideover>
</template>
