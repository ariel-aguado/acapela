<script lang="ts" setup>
import type { Slide } from "~/utils/slides";

// Home, reached from the logo (as in Superbiblia), never from the bottom
// menu. Acapela is the hymnal and the service: the hero says both, the
// phone stays hymnal-first (back to singing, recents, the songbook) and the
// computer shows what a service projects. On a first visit (no songbook
// chosen yet) the songbooks are offered right here.
const songStore = useSongStore();
const songbookStore = useSongbookStore();
const { songs, songId, currentSong, recentSongIds } = storeToRefs(songStore);
const { manifest, currentId, currentSongbook } = storeToRefs(songbookStore);
const { status } = useSongbookWorker();
const { show: showGoTo } = useGoToHymn();
const { canInstall, install, isInstalled } = usePwaInstall();
const { shareApp, shareCulto } = useShareApp();
const favoritesBySongbook = useLocalStorage<Record<string, number[]>>("favoritesBySongbook", {});

const hasSongbook = computed(() => !!currentId.value);
const hasSung = computed(() => recentSongIds.value.length > 0);
const ready = computed(() => hasSongbook.value && !!currentSong.value);

// A few lines of the hymn you were singing (its chorus when it has one).
const snippet = computed(() => {
  const song = currentSong.value;
  if (!song)
    return null;
  const block = song.blocks?.find(b => b.kind === "chorus")
    ?? song.blocks?.find(b => b.kind !== "citation");
  if (!block)
    return null;
  return {
    label: block.kind === "chorus"
      ? `Coro del himno ${song.songId}`
      : `Himno ${song.songId}`,
    lines: block.text.slice(0, 2),
  };
});

const recents = computed(() =>
  recentSongIds.value
    .slice(0, 8)
    .map(id => songs.value[id - 1])
    .filter((s): s is NonNullable<typeof s> => !!s),
);

const favCount = computed(() => favoritesBySongbook.value[currentId.value]?.length ?? 0);

function sing() {
  songStore.navigateToSong(Number(songId.value) || 1);
}

/** "Abrir el himnario": the hymn you were on, or the songbooks to choose one. */
function openHymnal() {
  if (ready.value)
    sing();
  else
    document.getElementById("home-songbooks")?.scrollIntoView({ behavior: "smooth" });
}

async function chooseSongbook(id: string) {
  if (status.value === "loading")
    return;
  await songbookStore.selectSongbook(id);
}

// The hero's screen: Hebrews 13:15 as the projector draws it today.
const HERO_SLIDE: Slide = {
  kind: "stanza",
  label: "",
  preview: "",
  html: [
    "Así que, ofrezcamos siempre",
    "a Dios, por medio de él,",
    "sacrificio de alabanza,",
    "es decir, fruto de labios",
    "que confiesan su nombre.",
  ].map(line => `<p>${line}</p>`).join(""),
};

const showTheme = ref(false);

/** Phone: what the hymnal does, as tiles. */
const FEATURES = [
  {
    icon: "i-tabler-typography",
    title: "Letra a tu medida",
    text: "Tamaño, interlineado y seis letras.",
    to: "/settings",
  },
  {
    icon: "i-tabler-search",
    title: "Por una frase",
    text: "Número, título o un verso de la letra.",
    to: "/search",
  },
  {
    icon: "i-tabler-heart",
    title: "Tus favoritos",
    text: "Guardados por himnario.",
    to: "/favorites",
  },
  {
    icon: "i-tabler-wifi-off",
    title: "Sin conexión",
    text: "Aunque en el templo no haya señal.",
    to: null,
  },
] as const;

/** Computer: everything a service projects. */
const PROJECTS = [
  {
    icon: "i-tabler-music",
    title: "Himnos de cualquier himnario",
    text: "Elige los himnos que hablen sobre el tema de la predicación.",
  },
  {
    icon: "i-tabler-book-2",
    title: "Referencias bíblicas",
    text: "Escribe la cita y elige la versión, también para la Cena y la Ofrenda.",
  },
  {
    icon: "i-tabler-heart-handshake",
    title: "Bienvenida y anuncios",
    text: "Extiende un mensaje cálido a la congregación.",
  },
  {
    icon: "i-tabler-presentation",
    title: "El sermón con sus diapositivas",
    text: "Elige un pasaje y comparte tus propias diapositivas.",
  },
  {
    icon: "i-tabler-speakerphone",
    title: "Avisos",
    text: "Muestra cualquier texto libre para despertar la atención.",
  },
] as const;

const OWN = [
  {
    title: "Se queda en esta computadora",
    text: "Los cultos, las diapositivas y el tema se guardan aquí. Nadie tiene que registrarse.",
  },
  {
    title: "Pásalo a otra computadora",
    text: "Descarga el culto como archivo y ábrelo en la computadora del local.",
  },
  {
    title: "Funciona en el local sin internet",
    text: "Una vez abierta, Acapela no necesita internet para cantar ni para proyectar.",
  },
] as const;
</script>

<template>
  <div class="home h-dvh overflow-y-auto flex flex-col">
    <!-- ===================== Hero ===================== -->
    <section class="hero relative shrink-0 overflow-hidden text-white" aria-labelledby="home-title">
      <!-- The staff that waves behind the title, its notes floating. -->
      <svg
        class="hero__staff"
        viewBox="0 0 1000 520"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <g fill="none" stroke="currentColor" stroke-width="1.2">
          <path d="M-20 300 C 250 220 600 400 1020 270" />
          <path d="M-20 320 C 250 240 600 420 1020 290" />
          <path d="M-20 340 C 250 260 600 440 1020 310" />
          <path d="M-20 360 C 250 280 600 460 1020 330" />
          <path d="M-20 380 C 250 300 600 480 1020 350" />
        </g>
        <g fill="currentColor">
          <ellipse
            class="hero__note"
            cx="720"
            cy="318"
            rx="11"
            ry="8"
          />
          <ellipse
            class="hero__note"
            cx="800"
            cy="292"
            rx="11"
            ry="8"
          />
          <ellipse
            class="hero__note"
            cx="640"
            cy="352"
            rx="11"
            ry="8"
          />
        </g>
      </svg>

      <div class="relative mx-auto max-w-5xl lg:max-w-7xl px-5 lg:px-4 pb-10 lg:pb-16 hero__inner grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14 lg:items-center">
        <div class="min-w-0 flex flex-col">
          <p class="hero__kicker">
            Himnos y cánticos espirituales
          </p>
          <h2 id="home-title" class="hero__title mt-1">
            Cantemos juntos,<br><em>a capela.</em>
          </h2>
          <p class="hero__sub mt-2 lg:mt-3">
            Sin instrumentos, y a una voz.
          </p>
          <p class="hidden lg:block mt-5 max-w-[46ch] text-lg/relaxed text-[#d6d2ea]">
            Prepara el orden del culto en la computadora y acompaña la adoración desde el móvil.
          </p>

          <!-- Computer: the service, then the hymnal. -->
          <div class="hidden lg:flex flex-wrap gap-3 mt-7">
            <NuxtLink to="/culto" class="hero__primary">
              <UIcon name="i-tabler-device-desktop" class="size-5.5 text-[#4b36c4]" />
              Preparar el culto del domingo
            </NuxtLink>
            <button type="button" class="hero__outline" @click="openHymnal">
              Abrir el himnario
            </button>
          </div>

          <!-- Phone: back to singing, the main action. -->
          <div class="lg:hidden">
            <button
              v-if="ready"
              type="button"
              class="cta mt-6"
              @click="sing"
            >
              <span class="cta__n">{{ currentSong!.songId }}</span>
              <span class="flex-1 min-w-0 text-start">
                <span class="cta__label">{{ hasSung ? 'Seguir cantando' : 'Abrir el himnario' }}</span>
                <span class="cta__title">{{ currentSong!.title }}</span>
              </span>
              <UIcon name="i-tabler-arrow-right" class="size-6 shrink-0" />
            </button>
            <a v-else-if="!hasSongbook" href="#home-songbooks" class="cta mt-6">
              <span class="cta__n"><UIcon name="i-tabler-book" class="size-6" /></span>
              <span class="flex-1 min-w-0 text-start">
                <span class="cta__label">Para empezar</span>
                <span class="cta__title">Elige el himnario de tu iglesia</span>
              </span>
              <UIcon name="i-tabler-arrow-down" class="size-6 shrink-0" />
            </a>

            <div v-if="hasSongbook" class="mt-3 flex gap-2 max-w-md">
              <button type="button" class="hero__ghost" @click="showGoTo">
                <UIcon name="i-tabler-hash" class="size-5" />
                Ir al himno
              </button>
              <NuxtLink to="/search" class="hero__ghost">
                <UIcon name="i-tabler-search" class="size-5" />
                Buscar
              </NuxtLink>
            </div>

            <!-- A few lines of your hymn, in the lyric face. -->
            <figure v-if="snippet" class="hero__lyric mt-5">
              <figcaption class="hero__lyric-label">
                {{ snippet.label }}
              </figcaption>
              <p class="font-lyric italic text-lg/relaxed">
                <template v-for="(line, i) in snippet.lines" :key="i">
                  {{ line }}<br v-if="i < snippet.lines.length - 1">
                </template>
              </p>
            </figure>
          </div>
        </div>

        <!-- Computer: the screen as the projector draws it, and what comes next. -->
        <figure class="hidden lg:flex flex-col gap-3 m-0" aria-label="Así se ve un versículo proyectado en el culto">
          <div class="overflow-hidden rounded-xl shadow-[0_24px_60px_-24px_rgb(0_0_0/0.8)]">
            <ProjectionSlide :slide="HERO_SLIDE" badge="En vivo" />
          </div>
          <div class="flex items-center gap-3 rounded-2xl bg-[#221e3d] px-4 py-3" aria-hidden="true">
            <b class="flex-1 text-[0.95rem]">Hebreos 13:15</b>
            <span class="inline-flex h-10 items-center gap-2 rounded-xl bg-[#b9aeff] px-4 text-[0.95rem] font-bold text-[#17142b]">
              Siguiente <UIcon name="i-tabler-arrow-right" class="size-4" />
            </span>
          </div>
        </figure>
      </div>
    </section>

    <div class="w-full shrink-0 mx-auto max-w-5xl lg:max-w-7xl px-5 lg:px-4 pb-12 lg:pb-24">
      <!-- ===================== First visit: pick a songbook ===================== -->
      <section
        v-if="!hasSongbook"
        id="home-songbooks"
        class="pt-8 scroll-mt-20"
        aria-labelledby="home-sb"
      >
        <h3 id="home-sb" class="home__heading">
          Elige tu himnario
        </h3>
        <ul class="grid gap-2 sm:grid-cols-3">
          <li v-for="sb in manifest" :key="sb.id">
            <button
              type="button"
              class="w-full flex items-center gap-3 rounded-2xl bg-default shadow-card px-4 min-h-16 text-start hover:bg-elevated disabled:opacity-60"
              :disabled="status === 'loading'"
              @click="chooseSongbook(sb.id)"
            >
              <UIcon name="i-tabler-book" class="size-6 shrink-0 text-primary" />
              <span class="flex-1 flex flex-col">
                <span class="font-semibold">{{ sb.name }}</span>
                <span v-if="sb.count" class="text-sm text-muted">{{ sb.count }} himnos</span>
              </span>
              <UIcon name="i-tabler-chevron-right" class="size-5 text-muted" />
            </button>
          </li>
        </ul>
        <p class="mt-2 text-sm text-muted">
          Lo puedes cambiar cuando quieras en Ajustes.
        </p>
      </section>

      <!-- ===================== Phone: the hymnal ===================== -->
      <div class="lg:hidden">
        <section v-if="recents.length" class="pt-7" aria-labelledby="home-recent">
          <h3 id="home-recent" class="home__heading">
            Recientes
          </h3>
          <ul v-scroll-fade-x class="recents -mx-5 px-5 flex gap-2 overflow-x-auto pb-1">
            <li v-for="song in recents" :key="song.songId" class="shrink-0">
              <button
                type="button"
                class="w-36 text-start rounded-2xl bg-default shadow-card px-3 py-2.5 hover:bg-elevated"
                @click="songStore.navigateToSong(song.songId)"
              >
                <span class="block text-lg font-bold text-primary tabular-nums leading-tight">{{ song.songId }}</span>
                <span class="block text-sm truncate">{{ song.title }}</span>
              </button>
            </li>
          </ul>
        </section>

        <section v-if="currentSongbook" class="pt-6" aria-label="Tu himnario">
          <NuxtLink to="/settings" class="flex items-center gap-3 rounded-2xl bg-primary/10 px-4 py-3.5 hover:bg-primary/15">
            <UIcon name="i-tabler-book" class="size-5 shrink-0 text-primary" />
            <span class="flex-1 min-w-0 text-sm">
              <b>{{ currentSongbook.name }}</b>
              <template v-if="currentSongbook.count"> · {{ currentSongbook.count }} himnos</template>
              <template v-if="favCount"> · {{ favCount }} {{ favCount === 1 ? 'favorito' : 'favoritos' }}</template>
            </span>
            <span class="text-sm font-semibold text-primary">Cambiar</span>
          </NuxtLink>
        </section>

        <section class="pt-7" aria-labelledby="home-features">
          <h3 id="home-features" class="home__heading">
            Lo que puedes hacer
          </h3>
          <div class="grid grid-cols-2 gap-2.5">
            <component
              :is="f.to ? resolveComponent('NuxtLink') : 'div'"
              v-for="f in FEATURES"
              :key="f.title"
              :to="f.to ?? undefined"
              class="feature"
              :class="{ 'feature--link': f.to }"
            >
              <span class="feature__icon"><UIcon :name="f.icon" class="size-5" /></span>
              <b class="text-sm/tight">{{ f.title }}</b>
              <span class="text-xs/snug text-muted">{{ f.text }}</span>
            </component>
          </div>
        </section>

        <!-- The service is a computer task: say so, and send the link there. -->
        <section class="mt-7 flex flex-col gap-3 rounded-3xl bg-[#17142b] p-5 text-white" aria-labelledby="home-pc">
          <div class="flex gap-1.5" aria-hidden="true">
            <span class="aspect-video flex-1 rounded-md bg-[#2a2548]" />
            <span class="aspect-video flex-1 rounded-md bg-[#2a2548] ring-2 ring-[#f4b740]" />
            <span class="aspect-video flex-1 rounded-md bg-[#2a2548]" />
          </div>
          <h3 id="home-pc" class="font-[Literata,Georgia,serif] text-2xl/tight font-bold">
            ¿Proyectan en tu iglesia?
          </h3>
          <p class="text-[0.95rem]/relaxed text-[#d6d2ea]">
            En la computadora, Acapela prepara y proyecta todo el culto: himnos, lecturas, Santa Cena, ofrenda y avisos.
          </p>
          <button
            type="button"
            class="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#b9aeff] px-4 py-2.5 text-center font-bold leading-tight text-[#17142b]"
            @click="shareCulto"
          >
            <UIcon name="i-tabler-send" class="size-5" />
            Enviarme el enlace a la computadora
          </button>
        </section>
      </div>

      <!-- ===================== Computer: the service ===================== -->
      <div class="hidden lg:block">
        <section class="pt-20" aria-labelledby="home-projects">
          <p class="section__kicker">
            Todo lo que se proyecta
          </p>
          <h3 id="home-projects" class="section__title">
            En un culto de adoración
          </h3>
          <div class="mt-8 grid grid-cols-3 gap-4">
            <div v-for="p in PROJECTS" :key="p.title" class="flex gap-4 rounded-3xl bg-default p-5 shadow-card">
              <span class="project__icon"><UIcon :name="p.icon" class="size-5.5" /></span>
              <div class="min-w-0">
                <h4 class="font-semibold text-highlighted text-lg/snug">
                  {{ p.title }}
                </h4>
                <p class="mt-1.5 text-[0.95rem]/relaxed text-muted">
                  {{ p.text }}
                </p>
              </div>
            </div>
            <div class="flex gap-4 rounded-3xl bg-[#17142b] p-5 text-white">
              <span class="project__icon project__icon--gold"><UIcon name="i-tabler-plus" class="size-5.5" /></span>
              <div class="min-w-0">
                <h4 class="font-semibold text-lg/snug">
                  Algo que no estaba previsto
                </h4>
                <p class="mt-1.5 text-[0.95rem]/relaxed text-[#d6d2ea]">
                  Inserta un himno o un pasaje en cualquier lugar, aun en pleno culto.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section class="pt-20 grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-12" aria-labelledby="home-church">
          <div class="flex flex-col gap-3.5">
            <p class="section__kicker">
              Para cualquier congregación
            </p>
            <h3 id="home-church" class="section__title">
              Con el nombre, el logo y los colores de tu iglesia
            </h3>
            <p class="text-lg/relaxed text-muted">
              Elige un tema, un fondo y dónde va el logo; cada culto lo hereda.
            </p>
            <button type="button" class="self-start font-semibold text-primary hover:underline" @click="showTheme = true">
              Elegir el tema de la iglesia →
            </button>
          </div>
          <div class="grid grid-cols-3 gap-3.5" aria-hidden="true">
            <figure class="m-0 flex flex-col gap-2">
              <div class="theme-sample bg-[#17142b] text-white">
                <span class="size-7 rounded-full border-2 border-[#f4b740]" />
                <b class="font-[Literata,Georgia,serif] text-lg">Bienvenidos</b>
                <span class="text-xs text-[#a8a3c4]">Nombre de tu iglesia</span>
              </div>
              <figcaption class="text-sm text-muted">
                Noche
              </figcaption>
            </figure>
            <figure class="m-0 flex flex-col gap-2">
              <div class="theme-sample bg-white text-[#17142b] ring-1 ring-[#e3e0f0]">
                <span class="size-7 rounded-md bg-[#1f5f4a]" />
                <b class="font-[Literata,Georgia,serif] text-lg">Santa Cena</b>
                <span class="text-xs text-[#5e5a78]">«Haced esto en memoria de mí»</span>
              </div>
              <figcaption class="text-sm text-muted">
                Claro, con el verde de la iglesia
              </figcaption>
            </figure>
            <figure class="m-0 flex flex-col gap-2">
              <div class="theme-sample theme-sample--photo text-[#fff6ea]">
                <b class="font-[Literata,Georgia,serif] text-lg">Ofrenda</b>
                <span class="text-xs">2 Corintios 9:7</span>
              </div>
              <figcaption class="text-sm text-muted">
                Una imagen de fondo
              </figcaption>
            </figure>
          </div>
        </section>

        <!-- The hymnal, still in your pocket. -->
        <section class="mt-20 grid grid-cols-[minmax(0,1fr)_15rem] items-center gap-12 rounded-[2rem] bg-[#4b36c4] px-12 py-10 text-white" aria-labelledby="home-pocket">
          <div class="flex flex-col gap-4">
            <p class="section__kicker text-[#f4d58a]!">
              En el teléfono
            </p>
            <h3 id="home-pocket" class="section__title text-white!">
              El himnario sigue en tu bolsillo
            </h3>
            <p class="text-lg/relaxed text-[#e4e0fa]">
              Desde el teléfono accedes al himnario.
            </p>
            <template v-if="recents.length">
              <ul class="flex flex-wrap gap-2">
                <li v-for="song in recents.slice(0, 4)" :key="song.songId">
                  <button
                    type="button"
                    class="flex min-w-32 flex-col rounded-2xl bg-white/15 px-3.5 py-2.5 text-start hover:bg-white/25"
                    @click="songStore.navigateToSong(song.songId)"
                  >
                    <b class="text-lg tabular-nums">{{ song.songId }}</b>
                    <span class="max-w-40 truncate text-sm">{{ song.title }}</span>
                  </button>
                </li>
              </ul>
              <span class="text-sm text-[#e4e0fa]">Tus recientes</span>
            </template>
            <button
              v-else
              type="button"
              class="self-start rounded-2xl bg-white px-5 py-3 font-bold text-[#4b36c4]"
              @click="openHymnal"
            >
              Abrir el himnario
            </button>
          </div>
          <div class="h-[19rem] rounded-[2.25rem] bg-[#0e0c1d] p-2.5" aria-hidden="true">
            <div class="flex h-full flex-col gap-2.5 overflow-hidden rounded-[2rem] bg-white px-5 py-6 text-[#17142b]">
              <span class="text-xs font-bold text-[#4b36c4]">{{ currentSong ? `${currentSong.songId} · ${currentSong.title}` : '4 · ¡Aleluya!' }}</span>
              <p class="font-lyric text-base/relaxed">
                <template v-if="snippet">
                  <template v-for="(line, i) in snippet.lines" :key="i">
                    {{ line }}<br>
                  </template>
                </template>
                <template v-else>
                  Cantad alegres a Dios, habitantes de toda la tierra. Servid a Dios con alegría.
                </template>
              </p>
            </div>
          </div>
        </section>

        <section class="pt-20" aria-labelledby="home-own">
          <p class="section__kicker">
            Tuyo
          </p>
          <h3 id="home-own" class="section__title">
            Sin cuentas, sin nube, sin conexión
          </h3>
          <div class="mt-8 grid grid-cols-3 gap-4">
            <div v-for="o in OWN" :key="o.title" class="rounded-3xl bg-default p-6 shadow-card">
              <h4 class="font-semibold text-highlighted text-lg/snug">
                {{ o.title }}
              </h4>
              <p class="mt-2 text-[0.95rem]/relaxed text-muted">
                {{ o.text }}
              </p>
            </div>
          </div>
        </section>
      </div>

      <!-- ===================== Install ===================== -->
      <section v-if="canInstall && !isInstalled" class="pt-10 lg:pt-16" aria-label="Instalar Acapela">
        <div class="flex items-center gap-3 rounded-3xl bg-[#4b36c4] text-white p-4">
          <span class="grid place-items-center size-12 shrink-0 rounded-xl bg-white text-[#4b36c4]">
            <AppBrandMark class="size-8" />
          </span>
          <span class="flex-1 min-w-0">
            <b class="block">Instala Acapela</b>
            <span class="text-sm opacity-85">Ábrela desde tu pantalla de inicio, también sin conexión</span>
          </span>
          <UButton
            color="neutral"
            variant="solid"
            class="bg-white text-[#4b36c4] hover:bg-white/90"
            label="Instalar"
            @click="install"
          />
        </div>
      </section>
    </div>

    <!-- ===================== Footer ===================== -->
    <footer class="home-footer mt-auto shrink-0">
      <div class="mx-auto max-w-5xl lg:max-w-7xl px-5 lg:px-4 py-10 lg:py-14 flex flex-col items-center gap-5 text-center lg:flex-row lg:text-start">
        <div class="flex flex-col items-center gap-3 lg:flex-row lg:gap-4 lg:flex-1">
          <AppBrandMark class="size-14 lg:size-16" />
          <div class="flex flex-col gap-0.5">
            <span class="wordmark text-2xl lg:text-3xl">Acapela</span>
            <span class="text-sm text-[#a8a3c4]">Himnos y cánticos espirituales</span>
          </div>
        </div>
        <nav aria-label="Pie" class="flex flex-wrap items-center justify-center gap-3">
          <button type="button" class="home-footer__share" @click="shareApp">
            <UIcon name="i-tabler-share" class="size-5" />
            Compartir Acapela
          </button>
          <NuxtLink to="/about" class="px-3 py-2.5 text-[#d6d2ea] underline-offset-4 hover:underline">
            Acerca de
          </NuxtLink>
        </nav>
      </div>
    </footer>

    <CultoThemeDialog v-model:open="showTheme" />
  </div>
</template>

<style scoped>
/* The hero: the room where it is projected (Noche), in both themes, under
   the floating capsules. */
.hero {
  background: #17142b;
}
.hero__inner {
  padding-top: calc(var(--bar-top) + 1.25rem);
}
@media (min-width: 1024px) {
  .hero__inner {
    padding-top: calc(var(--bar-top) + 3.5rem);
  }
}
/* The staff that waves behind the title: Acapela's own detail. */
.hero__staff {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  color: #fff;
  opacity: 0.18;
  pointer-events: none;
}
.hero__kicker {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #f4b740;
}
.hero__title {
  font-family: "Literata", Georgia, serif;
  font-weight: 700;
  font-size: clamp(2.5rem, 7vw, 4.25rem);
  line-height: 1.02;
  letter-spacing: -0.015em;
}
/* «a capela.» alone on its line, never split. */
.hero__title em {
  font-style: italic;
  font-weight: 400;
  color: #b9aeff;
  white-space: nowrap;
}
.hero__sub {
  font-family: "Literata", Georgia, serif;
  font-size: 1.2rem;
  line-height: 1.35;
}
@media (min-width: 1024px) {
  .hero__sub {
    font-size: 1.5rem;
  }
}
.hero__primary,
.hero__outline {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  height: 3.5rem;
  padding-inline: 1.5rem;
  border-radius: 1rem;
  font-weight: 700;
  font-size: 1.05rem;
  transition:
    background-color 0.15s,
    transform 0.15s;
}
.hero__primary {
  background: #fff;
  color: #17142b;
}
.hero__primary:hover {
  background: #ecebf6;
}
.hero__outline {
  border: 1px solid rgb(255 255 255 / 0.35);
  font-weight: 600;
}
.hero__outline:hover {
  background: rgb(255 255 255 / 0.1);
}
.hero__primary:focus-visible,
.hero__outline:focus-visible {
  outline: 3px solid #b9aeff;
  outline-offset: 3px;
}
.cta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  max-width: 28rem;
  padding: 0.75rem 1rem 0.75rem 0.75rem;
  border-radius: 1.25rem;
  background: #fff;
  color: #17142b;
  box-shadow: 0 16px 34px -16px rgb(0 0 0 / 0.55);
  transition: transform 0.15s ease;
}
.cta:active {
  transform: scale(0.98);
}
.cta:focus-visible {
  outline: 3px solid #b9aeff;
  outline-offset: 3px;
}
.cta__n {
  display: grid;
  place-items: center;
  min-width: 3rem;
  height: 3rem;
  padding-inline: 0.5rem;
  border-radius: 0.9rem;
  background: #4b36c4;
  color: #fff;
  font-size: 1.25rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.cta__label {
  display: block;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #5e5a78;
}
.cta__title {
  display: block;
  font-family: "Literata", Georgia, serif;
  font-weight: 600;
  font-size: 1.05rem;
  line-height: 1.25;
  color: #111114;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hero__ghost {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  height: 2.75rem;
  border-radius: 999px;
  border: 1px solid rgb(255 255 255 / 0.35);
  font-size: 0.9rem;
  font-weight: 600;
  transition: background-color 0.15s;
}
.hero__ghost:hover {
  background: rgb(255 255 255 / 0.1);
}
.hero__ghost:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}
.hero__lyric {
  margin-bottom: 0;
  border-radius: 1.25rem;
  padding: 1rem 1.25rem;
  border: 1px solid rgb(255 255 255 / 0.18);
}
.hero__lyric-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #f4b740;
  margin-bottom: 0.25rem;
}
.home__heading {
  margin-bottom: 0.75rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ui-text-muted);
}
.section__kicker {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ui-primary);
}
.section__title {
  margin-top: 0.75rem;
  font-family: "Literata", Georgia, serif;
  font-weight: 700;
  font-size: clamp(1.9rem, 3.2vw, 2.75rem);
  line-height: 1.1;
  letter-spacing: -0.01em;
  text-wrap: balance;
  color: var(--ui-text-highlighted);
}
.project__icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 0.9rem;
  background: color-mix(in oklab, var(--ui-primary) 14%, transparent);
  color: var(--ui-primary);
}
.project__icon--gold {
  background: #f4b740;
  color: #17142b;
}
.theme-sample {
  aspect-ratio: 16 / 9;
  border-radius: 0.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.75rem;
  text-align: center;
}
.theme-sample--photo {
  background:
    linear-gradient(rgb(0 0 0 / 0.35), rgb(0 0 0 / 0.45)),
    url("/img/background-fullscreen.webp") center / cover no-repeat;
}
.recents {
  scrollbar-width: none;
}
.recents::-webkit-scrollbar {
  display: none;
}
.feature {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-height: 8rem;
  padding: 0.9rem;
  border-radius: 1.5rem;
  /* A white card on the canvas, as Diaconeo's. */
  background: var(--ui-bg);
  box-shadow: var(--shadow-card);
  transition: box-shadow 0.15s;
}
.feature--link:hover {
  box-shadow: var(--shadow-float);
}
.feature__icon {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.75rem;
  background: var(--ui-primary);
  color: var(--ui-text-inverted);
}
/* The footer closes the page: the room the floating bottom menu needs is
   inside it (its dark runs to the edge), not a strip of canvas under it. */
.home-footer {
  padding-bottom: var(--bar-bottom);
  background: #17142b;
  color: #fff;
}
@media (min-width: 1024px) {
  .home-footer {
    padding-bottom: 0;
  }
}
.home-footer__share {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  height: 2.75rem;
  padding-inline: 1.1rem;
  border-radius: 0.75rem;
  border: 1px solid rgb(255 255 255 / 0.35);
  font-weight: 600;
}
.home-footer__share:hover {
  background: rgb(255 255 255 / 0.1);
}
.hero__note {
  transform-box: fill-box;
  transform-origin: center;
  transform: rotate(-24deg);
}
@media (prefers-reduced-motion: no-preference) {
  .hero__note {
    animation: note-float 6s ease-in-out infinite;
  }
  .hero__note:nth-child(2) {
    animation-delay: -2s;
  }
  .hero__note:nth-child(3) {
    animation-delay: -4s;
  }
}
@keyframes note-float {
  0%,
  100% {
    transform: rotate(-24deg);
  }
  50% {
    transform: translateY(-8px) rotate(-24deg);
  }
}
</style>
