<script lang="ts" setup>
const route = useRoute();
const detail = typeof route.query.error === "string" && route.query.error
  ? route.query.error
  : "";
</script>

<template>
  <div class="container mx-auto mt-8 px-4 flex flex-col items-center gap-4 text-center">
    <Icon
      name="tabler:alert-triangle"
      size="48"
      class="text-warning"
      aria-hidden="true"
    />
    <h2 class="text-2xl font-bold">
      Algo salió mal al abrir esta página
    </h2>
    <p class="max-w-md opacity-80">
      Puedes volver al himno o intentarlo de nuevo en unos segundos.
    </p>
    <p v-if="detail" class="max-w-md text-sm opacity-60">
      Detalle: {{ detail }}
    </p>
    <div class="flex flex-wrap justify-center gap-2 mt-2">
      <NuxtLink to="/" class="btn btn-primary">
        <Icon name="tabler:arrow-left" size="20" />
        Volver al himno
      </NuxtLink>
      <button type="button" class="btn btn-ghost" @click="$router.go(0)">
        Reintentar
      </button>
    </div>
  </div>
</template>
