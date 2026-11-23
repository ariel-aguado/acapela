// "Compartir Acapela", as in Superbiblia (shareApp in HeaderMenu.vue): the
// app's link through the phone's native share sheet, or copied to the
// clipboard where there is none (desktop browsers).
export function useShareApp() {
  const { show: toast } = useUndoToast();

  async function shareApp() {
    const url = window.location.origin;
    const title = "Acapela";
    const text = "Himnos y cánticos espirituales, a capela";
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      }
      catch (err) {
        // AbortError: the sheet was closed without choosing anything.
        if (err instanceof Error && err.name === "AbortError")
          return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Enlace copiado. Pégalo donde quieras compartirlo.");
    }
    catch {
      toast("No se pudo compartir el enlace");
    }
  }

  return { shareApp };
}
