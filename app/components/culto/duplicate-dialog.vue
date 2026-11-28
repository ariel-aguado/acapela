<script setup lang="ts">
import type { DateValue, Time } from "@internationalized/date";

import { parseDate, parseTime } from "@internationalized/date";

import type { Culto } from "~~/lib/culto";

import { cultoWhen, formatCultoDate, nextSunday, partOfDay } from "~/stores/culto";

// Duplicating a service: the same order and content for another day. The
// day comes chosen (the coming Sunday, or a week after the service if that
// one is still ahead) and so does the time; the name follows them unless
// it is written here.
const props = defineProps<{ source: Culto | null }>();
const emit = defineEmits<{ done: [copy: Culto, source: Culto] }>();
const open = defineModel<boolean>("open", { required: true });

const culto = useCultoStore();

function plusDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y!, m! - 1, d! + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const date = ref(nextSunday());
const time = ref<string | undefined>();
const title = ref("");

watch(open, (value) => {
  const s = props.source;
  if (!value || !s)
    return;
  const sunday = nextSunday();
  date.value = s.date >= sunday
    ? plusDays(s.date, 7)
    : sunday;
  time.value = s.time;
  title.value = "";
}, { immediate: true });

const suggested = computed(() => props.source
  ? culto.copyTitle(props.source, date.value, time.value)
  : "");

const calendarDate = computed({
  get: () => parseDate(date.value),
  set: (value: DateValue | undefined) => {
    if (value)
      date.value = value.toString();
  },
});
const timeModel = computed({
  get: () => {
    try {
      return time.value
        ? parseTime(time.value)
        : undefined;
    }
    catch {
      return undefined;
    }
  },
  set: (value: Time | undefined | null) => {
    time.value = value
      ? `${String(value.hour).padStart(2, "0")}:${String(value.minute).padStart(2, "0")}`
      : undefined;
  },
});

/** What goes with the copy, said plainly. */
const summary = computed(() => {
  const s = props.source;
  if (!s)
    return "";
  const items = s.items.filter(i => !i.inserted);
  const dropped = s.items.length - items.length;
  const parts = [`${items.length} ${items.length === 1
    ? "elemento"
    : "elementos"}`];
  if (s.sections?.length) {
    parts.push(`${s.sections.length} ${s.sections.length === 1
      ? "sección"
      : "secciones"}`);
  }
  if (s.messages?.length) {
    parts.push(`${s.messages.length} ${s.messages.length === 1
      ? "mensaje"
      : "mensajes"}`);
  }
  return `Se copian ${parts.join(", ")}.${dropped
    ? ` Lo que se añadió en vivo (${dropped}) no se copia.`
    : ""}`;
});

function confirm() {
  const s = props.source;
  if (!s)
    return;
  const copy = culto.duplicate(s.id, {
    date: date.value,
    time: time.value ?? null,
    title: title.value,
  });
  open.value = false;
  if (copy)
    emit("done", copy, s);
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Duplicar culto"
    :description="source ? `«${source.title}» · ${cultoWhen(source)}` : undefined"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <form class="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)]" @submit.prevent="confirm">
        <div class="flex flex-col gap-2">
          <span class="text-sm font-medium">Para el día</span>
          <UCalendar v-model="calendarDate" class="self-start rounded-xl ring-1 ring-default p-2" />
        </div>
        <div class="flex min-w-0 flex-col gap-4">
          <UFormField label="Fecha">
            <p class="font-semibold first-letter:uppercase">
              {{ formatCultoDate(date) }}
            </p>
          </UFormField>
          <UFormField label="Hora" hint="Opcional">
            <div class="flex flex-wrap items-center gap-2">
              <UInputTime v-model="timeModel" :hour-cycle="24" aria-label="Hora del culto (opcional)" />
              <UBadge
                v-if="partOfDay(time)"
                color="neutral"
                variant="soft"
                :label="partOfDay(time)!"
              />
              <UButton
                v-if="time"
                color="neutral"
                variant="link"
                size="sm"
                label="Quitar hora"
                @click="time = undefined"
              />
            </div>
          </UFormField>
          <UFormField label="Nombre">
            <UInput
              v-model="title"
              :placeholder="suggested"
              class="w-full"
              aria-label="Nombre de la copia"
            />
          </UFormField>
          <p class="rounded-xl bg-elevated px-3 py-2 text-sm text-muted">
            {{ summary }}
          </p>
        </div>
        <button type="submit" class="hidden" />
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          label="Cancelar"
          @click="open = false"
        />
        <UButton icon="i-tabler-copy" label="Duplicar" @click="confirm" />
      </div>
    </template>
  </UModal>
</template>
