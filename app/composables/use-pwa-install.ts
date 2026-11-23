import type { Ref } from "vue";

type PwaOutcome = "accepted" | "dismissed";

type BeforeInstallPromptEvent = {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: PwaOutcome }>;
  platforms: string[];
} & Event;

// Module-scoped so the banner, the "moved" dialog and Ajustes share one
// state. The browser dispatches `beforeinstallprompt` only once per
// installability check, so a per-component listener added later (e.g. when
// opening Ajustes) would never see it.
const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null);
const isInstalled = ref(false);
const dismissed = ref(false);
let listening = false;

function listen() {
  if (listening || !import.meta.client)
    return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    deferredPrompt.value = e as BeforeInstallPromptEvent;
  });
  window.addEventListener("appinstalled", () => {
    isInstalled.value = true;
    deferredPrompt.value = null;
  });
  if (window.matchMedia("(display-mode: standalone)").matches)
    isInstalled.value = true;
}

/**
 * PWA install prompt controller.
 *
 * Listens to `beforeinstallprompt` directly instead of relying on the
 * `@vite-pwa/nuxt` plugin's `provide("pwa", ...)`, which may not be
 * registered yet when components set up.
 *
 * Dismiss is in-memory only — the browser re-checks installability on every
 * page load.
 */
export function usePwaInstall() {
  listen();

  /** The browser offers a native install prompt right now. */
  const canInstall = computed(() => deferredPrompt.value !== null && !isInstalled.value);

  /** The proactive banner: installable and not dismissed this session. */
  const showBanner = computed(() => canInstall.value && !dismissed.value);

  async function install() {
    const promptEvent = deferredPrompt.value;
    if (!promptEvent)
      return;
    deferredPrompt.value = null;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice?.outcome === "dismissed")
      dismissed.value = true;
  }

  function dismiss() {
    dismissed.value = true;
  }

  return {
    showBanner,
    canInstall,
    install,
    dismiss,
    isInstalled: isInstalled as Readonly<Ref<boolean>>,
  };
}
