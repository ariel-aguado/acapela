// "Compartir Acapela", as in Superbiblia (shareApp in HeaderMenu.vue): the
// app's link through the phone's native share sheet, or copied to the
// clipboard where there is none (desktop browsers).
export function useShareApp() {
  const { show: toast } = useUndoToast();

  /** A link of the app through the share sheet, or copied where there is none. */
  async function shareLink(url: string, text: string, copied: string) {
    const title = "Acapela";
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
      toast(copied);
    }
    catch {
      toast("No se pudo compartir el enlace");
    }
  }

  function shareApp() {
    return shareLink(window.location.origin, "Himnos y cánticos espirituales, a capela", "Enlace copiado. Pégalo donde quieras compartirlo.");
  }

  /** From the phone: the service console's link, to open on the computer. */
  function shareCulto() {
    return shareLink(`${window.location.origin}/culto`, "Prepara y proyecta el culto con Acapela", "Enlace copiado. Ábrelo en la computadora para preparar el culto.");
  }

  return { shareApp, shareCulto };
}
