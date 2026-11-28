<script setup lang="ts">
import type { ItemScreens } from "~/composables/use-culto-screens";
import type { MessageKind, ScreenMessage } from "~~/lib/culto";

import { MESSAGE_KIND_LABELS } from "~~/lib/culto";

// The service's messages over the screen, prepared ahead: each one either
// waits in the live console to be launched, or is hung on an element and
// shows by itself when that element goes on air. Writing one opens the
// message editor (one dialog at a time: the list closes meanwhile).
const props = defineProps<{ entries: ItemScreens[] }>();
const open = defineModel<boolean>("open", { required: true });

const culto = useCultoStore();
const { current } = storeToRefs(culto);
const { show: toast } = useUndoToast();

const messages = computed(() => current.value?.messages ?? []);
const items = computed(() => props.entries.map(e => ({ id: e.item.id, label: e.label })));

const ICONS: Record<MessageKind, string> = {
  alert: "i-tabler-alert-triangle",
  notice: "i-tabler-speakerphone",
  notification: "i-tabler-bell",
  congrats: "i-tabler-confetti",
  welcome: "i-tabler-heart-handshake",
  prayer: "i-tabler-pray",
  countdown: "i-tabler-clock",
  ticker: "i-tabler-news",
};

function label(m: ScreenMessage) {
  return m.kind === "countdown"
    ? `${m.title || MESSAGE_KIND_LABELS.countdown} · ${Math.round(m.duration / 60)} min`
    : [m.title, m.text].filter(Boolean).join(" · ") || MESSAGE_KIND_LABELS[m.kind];
}
function when(m: ScreenMessage) {
  if (!m.trigger)
    return "Se muestra desde la consola en vivo";
  const entry = props.entries.find(e => e.item.id === m.trigger!.itemId);
  if (!entry)
    return "Su elemento ya no está en el orden: se muestra desde la consola";
  return m.trigger.delay
    ? `Al empezar «${entry.label}», a los ${m.trigger.delay} s`
    : `Al empezar «${entry.label}»`;
}

// The editor, over the list's place.
const editing = ref<ScreenMessage | null>(null);
const showEditor = ref(false);
function edit(m: ScreenMessage | null) {
  editing.value = m;
  open.value = false;
  showEditor.value = true;
}
watch(showEditor, (value, was) => {
  if (was && !value)
    open.value = true;
});

/** Under the message: the first screen of its element, or of the service. */
const previewScreen = computed(() => {
  const itemId = editing.value?.trigger?.itemId;
  const entry = (itemId && props.entries.find(e => e.item.id === itemId)) || props.entries.find(e => e.screens.length);
  return entry?.screens[0] ?? null;
});

function save(m: ScreenMessage) {
  culto.saveMessage(m);
}
function remove(id: string) {
  const cultoId = current.value?.id;
  const removed = culto.removeMessage(id, cultoId);
  if (removed) {
    toast("Se eliminó el mensaje.", {
      label: "Deshacer",
      run: () => culto.saveMessage(removed, cultoId),
    });
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Mensajes sobre la pantalla"
    description="Alertas, avisos o felicitaciones que aparecen encima de lo que se proyecta, sin cambiar la pantalla."
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <div class="flex flex-col gap-2">
        <p v-if="!messages.length" class="rounded-xl bg-elevated px-4 py-3 text-sm text-muted">
          Todavía no hay mensajes. Prepáralos aquí, o escríbelos durante el culto desde la consola en vivo (tecla M).
        </p>
        <div
          v-for="m in messages"
          :key="m.id"
          class="flex items-center gap-3 rounded-xl px-3 py-2 ring-1 ring-default"
        >
          <UIcon :name="ICONS[m.kind]" class="size-5 shrink-0 text-primary" />
          <button
            type="button"
            class="flex min-w-0 flex-1 flex-col text-start"
            :aria-label="`Editar: ${label(m)}`"
            @click="edit(m)"
          >
            <span class="truncate font-semibold">{{ label(m) }}</span>
            <span class="truncate text-xs text-muted">{{ MESSAGE_KIND_LABELS[m.kind] }} · {{ when(m) }}</span>
          </button>
          <UButton
            color="neutral"
            variant="ghost"
            square
            icon="i-tabler-pencil"
            :aria-label="`Editar: ${label(m)}`"
            @click="edit(m)"
          />
          <UButton
            color="neutral"
            variant="ghost"
            square
            icon="i-tabler-trash"
            :aria-label="`Eliminar: ${label(m)}`"
            @click="remove(m.id)"
          />
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end">
        <UButton icon="i-tabler-plus" label="Mensaje nuevo" @click="edit(null)" />
      </div>
    </template>
  </UModal>
  <CultoMessageDialog
    v-model:open="showEditor"
    :message="editing"
    :items="items"
    :screen="previewScreen"
    @save="save"
    @remove="remove"
  />
</template>
