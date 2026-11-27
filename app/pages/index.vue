<script lang="ts" setup>
// Home, reached from the logo (as in Superbiblia), never from the bottom
// menu. Top: what Acapela is and one big way back to singing. Then your
// recent hymns and songbook, what the app can do, the install invitation
// and the footer. On a first visit (no songbook chosen yet) the songbooks
// are offered right here, instead of the first-run window.
const songStore = useSongStore();
const songbookStore = useSongbookStore();
const { songs, songId, currentSong, recentSongIds } = storeToRefs(songStore);
const { manifest, currentId, currentSongbook } = storeToRefs(songbookStore);
const { status } = useSongbookWorker();
const { show: showGoTo } = useGoToHymn();
const { canInstall, install, isInstalled } = usePwaInstall();
const { shareApp } = useShareApp();
const isLarge = useMediaQuery("(min-width: 1024px)");
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

async function chooseSongbook(id: string) {
  if (status.value === "loading")
    return;
  await songbookStore.selectSongbook(id);
}

const FEATURES = [
  {
    icon: "i-tabler-typography",
    title: "Letra a tu medida",
    text: "Tamaño, interlineado, margen y seis letras para elegir.",
    to: "/settings",
  },
  {
    icon: "i-tabler-search",
    title: "Encuéntralo al instante",
    text: "Por número, título o una frase de la letra.",
    to: "/search",
  },
  {
    icon: "i-tabler-wifi-off",
    title: "Sin conexión",
    text: "Funciona en el templo aunque no haya señal.",
    to: null,
  },
  {
    icon: "i-tabler-heart",
    title: "Tus favoritos",
    text: "Guardados por himnario, siempre a mano.",
    to: "/favorites",
  },
] as const;
</script>

<template>
  <div class="home h-dvh overflow-y-auto pad-bar-bottom">
    <!-- ===================== Hero ===================== -->
    <section class="hero relative overflow-hidden text-white" aria-labelledby="home-title">
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

      <div class="relative mx-auto max-w-5xl px-5 pb-10 lg:pb-14 hero__inner grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div class="min-w-0">
          <p class="text-xs font-bold uppercase tracking-[0.14em] opacity-80">
            Himnos y cánticos espirituales
          </p>
          <h2 id="home-title" class="hero__title mt-3">
            Cantemos juntos, <em>a capela.</em>
          </h2>
          <p class="mt-3 max-w-md text-base/relaxed opacity-90">
            Sin instrumentos y a una voz.
          </p>

          <!-- Back to singing: the main action. -->
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
            <NuxtLink v-if="isLarge" to="/fullscreen" class="hero__ghost">
              <UIcon name="i-tabler-presentation" class="size-5" />
              Proyectar
            </NuxtLink>
            <NuxtLink v-else to="/search" class="hero__ghost">
              <UIcon name="i-tabler-search" class="size-5" />
              Buscar
            </NuxtLink>
          </div>
        </div>

        <!-- A few lines of your hymn, in the lyric face. -->
        <figure v-if="snippet" class="hero__lyric">
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
    </section>

    <div class="mx-auto max-w-5xl px-5">
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

      <!-- ===================== Yours ===================== -->
      <section v-if="recents.length" class="pt-8" aria-labelledby="home-recent">
        <h3 id="home-recent" class="home__heading">
          Recientes
        </h3>
        <ul v-scroll-fade-x class="recents -mx-5 px-5 flex gap-2 overflow-x-auto pb-1">
          <li v-for="song in recents" :key="song.songId" class="shrink-0">
            <button
              type="button"
              class="w-40 text-start rounded-2xl bg-default shadow-card px-3 py-2.5 hover:bg-elevated"
              @click="songStore.navigateToSong(song.songId)"
            >
              <span class="block text-lg font-bold text-primary tabular-nums leading-tight">{{ song.songId }}</span>
              <span class="block text-sm truncate">{{ song.title }}</span>
            </button>
          </li>
        </ul>
      </section>

      <section v-if="currentSongbook" class="pt-4" aria-label="Tu himnario">
        <NuxtLink to="/settings" class="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3 hover:bg-elevated">
          <UIcon name="i-tabler-book" class="size-5 shrink-0 text-primary" />
          <span class="flex-1 min-w-0 text-sm">
            <b>{{ currentSongbook.name }}</b>
            <template v-if="currentSongbook.count"> · {{ currentSongbook.count }} himnos</template>
            <template v-if="favCount"> · {{ favCount }} {{ favCount === 1 ? 'favorito' : 'favoritos' }}</template>
          </span>
          <span class="text-sm font-semibold text-primary">Cambiar</span>
        </NuxtLink>
      </section>

      <!-- ===================== Features ===================== -->
      <section class="pt-10" aria-labelledby="home-features">
        <h3 id="home-features" class="home__heading">
          Lo que puedes hacer
        </h3>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
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

          <!-- What sets Acapela apart: the projection console. -->
          <component
            :is="isLarge ? resolveComponent('NuxtLink') : 'div'"
            :to="isLarge ? '/fullscreen' : undefined"
            class="feature feature--project col-span-2"
          >
            <span class="feature__icon"><UIcon name="i-tabler-presentation" class="size-5" /></span>
            <b class="text-sm/tight">Proyecta en la pantalla</b>
            <span class="text-xs/snug opacity-80">Desde la computadora: estrofa por estrofa, con la siguiente a la vista y el control remoto.</span>
            <span class="mt-1 flex gap-1.5" aria-hidden="true">
              <i class="feature__slide" /><i class="feature__slide" /><i class="feature__slide" />
            </span>
          </component>

          <NuxtLink to="/settings" class="feature feature--link col-span-2 flex-row! items-center gap-3! min-h-0!">
            <span class="feature__icon"><UIcon name="i-tabler-moon" class="size-5" /></span>
            <span class="flex flex-col">
              <b class="text-sm/tight">Claro u oscuro</b>
              <span class="text-xs/snug text-muted">Para leer de día o con las luces bajas.</span>
            </span>
          </NuxtLink>
        </div>
      </section>

      <!-- ===================== Install ===================== -->
      <section v-if="canInstall && !isInstalled" class="pt-10" aria-label="Instalar Acapela">
        <div class="flex items-center gap-3 rounded-3xl bg-[#715DE3] text-white p-4">
          <span class="grid place-items-center size-12 shrink-0 rounded-xl bg-white text-[#715DE3]">
            <AppBrandMark class="size-8" />
          </span>
          <span class="flex-1 min-w-0">
            <b class="block">Instala Acapela</b>
            <span class="text-sm opacity-85">Ábrela desde tu pantalla de inicio, también sin conexión</span>
          </span>
          <UButton
            color="neutral"
            variant="solid"
            class="bg-white text-[#715DE3] hover:bg-white/90"
            label="Instalar"
            @click="install"
          />
        </div>
      </section>

      <!-- ===================== Footer ===================== -->
      <footer class="pt-12 pb-6 text-center text-sm text-muted">
        <p class="wordmark text-xl text-highlighted">
          Acapela
        </p>
        <p class="mt-1">
          Himnos y cánticos espirituales
        </p>
        <UButton
          color="neutral"
          variant="outline"
          size="lg"
          class="mt-4"
          icon="i-tabler-share"
          label="Compartir Acapela"
          @click="shareApp"
        />
        <p class="mt-4">
          <NuxtLink to="/about" class="text-primary underline underline-offset-2">
            Acerca de
          </NuxtLink>
        </p>
      </footer>
    </div>
  </div>
</template>

<style scoped>
/* Fixed brand indigo (like the app icon) in both themes, under the
   floating capsules. */
.hero {
  background:
    radial-gradient(110% 90% at 100% 0%, #9583ea 0%, transparent 55%),
    radial-gradient(80% 80% at 0% 100%, #413098 0%, transparent 60%),
    linear-gradient(160deg, #715de3, #5e46d6 60%, #372b79);
}
.hero__inner {
  padding-top: calc(var(--bar-top) + 1.25rem);
}
/* The staff that waves behind the title: Acapela's own detail. */
.hero__staff {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  color: #fff;
  opacity: 0.22;
  pointer-events: none;
}
.hero__title {
  font-family: "Literata", Georgia, serif;
  font-weight: 700;
  font-size: clamp(2.25rem, 7vw, 3.5rem);
  line-height: 1.04;
  letter-spacing: -0.01em;
  text-wrap: balance;
}
.hero__title em {
  font-style: italic;
  font-weight: 400;
  color: #d7cff9;
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
  color: #372b79;
  box-shadow: 0 16px 34px -16px rgb(0 0 0 / 0.55);
  transition: transform 0.15s ease;
}
.cta:active {
  transform: scale(0.98);
}
.cta:focus-visible {
  outline: 3px solid #d7cff9;
  outline-offset: 3px;
}
.cta__n {
  display: grid;
  place-items: center;
  min-width: 3rem;
  height: 3rem;
  padding-inline: 0.5rem;
  border-radius: 0.9rem;
  background: #715de3;
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
  color: #71717a;
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
  margin: 0;
  border-radius: 1.25rem;
  padding: 1rem 1.25rem;
  background: rgb(255 255 255 / 0.1);
  border: 1px solid rgb(255 255 255 / 0.2);
}
.hero__lyric-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.75;
  margin-bottom: 0.25rem;
}
@media (min-width: 1024px) {
  .hero__lyric {
    background: #fff;
    color: #111114;
    border: 0;
    transform: rotate(1.5deg);
    box-shadow: 0 24px 50px -24px rgb(0 0 0 / 0.6);
  }
  .hero__lyric-label {
    color: #715de3;
    opacity: 1;
  }
}
.home__heading {
  margin-bottom: 0.75rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ui-text-muted);
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
.feature--project {
  min-height: 0;
  background: #221a4a;
  color: #fff;
}
.feature--project .feature__icon {
  background: #fff;
  color: #715de3;
}
.feature__slide {
  flex: 1;
  height: 2.25rem;
  border-radius: 0.5rem;
  background: linear-gradient(135deg, #6b5326, #2b2218);
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
