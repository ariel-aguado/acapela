<script lang="ts" setup>
useHead({ title: "Acerca de" });

const CONTACT_EMAIL = "ariel.841207@gmail.com";
</script>

<template>
  <div class="page-scroll w-full flex flex-col max-w-screen min-w-0 md:min-w-2xl md:max-w-2xl md:mx-auto px-4">
    <!-- Brand: the mark, the name in the lyric face and the one tagline. -->
    <div class="about-hero w-full rounded-3xl text-white flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <AppBrandMark class="size-24" />
      <span class="wordmark text-5xl leading-none">Acapela</span>
      <span class="text-lg opacity-85">Himnos y cánticos espirituales</span>
    </div>
    <div>
      <h2 class="text-3xl font-bold text-left md:text-center mt-8">
        Acerca de Acapela
      </h2>
      <p class="md:max-w-2xl md:mx-auto text-left md:text-center mt-4 leading-8">
        "Acapela" nace con una misión clara: poner la tecnología al servicio de la alabanza y la adoración. Es una herramienta diseñada para que la Iglesia pueda exaltar el nombre del Señor, a quien sea toda la honra y la gloria. Amén.
      </p>
      <!-- The one highlighted block of the page: contact (as in Superbiblia). -->
      <section aria-labelledby="about-opinion" class="mt-10 mb-6 rounded-2xl bg-default shadow-card p-5 text-left">
        <h3 id="about-opinion" class="text-lg font-semibold leading-snug">
          Me gustaría conocer tu opinión
        </h3>
        <p class="mt-3 text-base leading-relaxed">
          Si tienes alguna sugerencia, conoces un himnario que podría sumarse, encontraste un error en la letra de algún himno o algo que podemos mejorar, o simplemente deseas compartir una idea, estaré encantado de recibir tu mensaje.
        </p>
        <p class="mt-3 text-base leading-relaxed">
          Cada observación puede ayudar a que Acapela continúe creciendo y cumpla mejor su propósito.
        </p>

        <dl class="mt-5 space-y-3 text-sm">
          <div>
            <dt class="text-muted">
              Desarrollador
            </dt>
            <dd class="font-medium">
              Ariel Aguado Albear
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Correo electrónico
            </dt>
            <dd>
              <a :href="`mailto:${CONTACT_EMAIL}`" class="font-medium break-all underline decoration-(--ui-primary) underline-offset-4">{{ CONTACT_EMAIL }}</a>
            </dd>
          </div>
        </dl>

        <UButton
          :to="`mailto:${CONTACT_EMAIL}`"
          external
          label="Escribir por correo"
          icon="i-tabler-mail"
          size="lg"
          class="mt-5 h-12 justify-center"
          block
        />
      </section>
    </div>
  </div>
</template>

<style scoped>
/* Fixed brand indigo (same as the app icon) in both themes. */
.about-hero {
  background: radial-gradient(120% 140% at 85% 15%, #9583ea 0%, #715de3 45%, #372b79 100%);
}
</style>
