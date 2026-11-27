<script lang="ts" setup>
import type { CultoItem } from "~~/lib/culto";

import { itemLook } from "~/utils/culto/moment";

// The tile that tells an element of a service apart in its order: the
// hymn's number or the moment's icon, on the colour of its family
// (app/utils/culto/moment.ts).
const props = withDefaults(defineProps<{
  item: CultoItem;
  size?: "md" | "sm";
}>(), { size: "md" });

const look = computed(() => itemLook(props.item));
</script>

<template>
  <span
    class="moment-tile shrink-0 grid place-items-center font-extrabold tabular-nums tracking-tight"
    :class="[`moment--${look.tone}`, size === 'md' ? 'size-10 rounded-xl text-[0.95rem]' : 'size-7 rounded-lg text-[0.7rem]']"
    aria-hidden="true"
  >
    <template v-if="item.kind === 'hymn'">{{ item.songId }}</template>
    <UIcon v-else :name="look.icon" :class="size === 'md' ? 'size-5' : 'size-4'" />
  </span>
</template>
