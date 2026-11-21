import type { Songbook } from "~~/lib/types";

/**
 * Runs before the songbook plugin and before any store reads localStorage:
 * imports the data sent by the old *.vercel.app deployments (see
 * `utils/legacy-import.ts`) and flags it so the "we moved" dialog shows.
 */
export default defineNuxtPlugin({
  name: "legacy-import",
  parallel: false,
  async setup() {
    // Read before anything else: the router drops it from the URL below.
    const hash = window.location.hash;
    if (!hash.startsWith("#import="))
      return;
    // The router captured the initial URL (with the hash) before this plugin
    // ran and restores it, so the payload is also dropped through the router.
    const router = useRouter();
    router.isReady().then(() => {
      const route = router.currentRoute.value;
      if (route.hash.startsWith("#import="))
        router.replace({ path: route.path, query: route.query, hash: "" });
    });
    const moved = useState<{ songbookId: string; favorites: number } | null>("legacy-import", () => null);
    try {
      const res = await fetch("/songs/manifest.json");
      const manifest = (await res.json()) as Songbook[];
      moved.value = applyLegacyImport(hash, manifest.map(s => s.id));
    }
    catch (err) {
      console.warn("[legacy-import] failed:", err);
      history.replaceState(history.state, "", window.location.pathname + window.location.search);
    }
  },
});
