type UndoToast = {
  id: number;
  message: string;
  actionLabel?: string;
};

let timer: ReturnType<typeof setTimeout> | null = null;
let pendingAction: (() => void) | null = null;

/**
 * One short-lived notice at a time ("Quitado de Favoritos · Deshacer").
 * Undo instead of confirmation dialogs: removing something is never final.
 */
export function useUndoToast() {
  const toast = useState<UndoToast | null>("undo-toast", () => null);

  function hide() {
    toast.value = null;
    pendingAction = null;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function show(message: string, action?: { label: string; run: () => void }, ms = 5000) {
    if (timer)
      clearTimeout(timer);
    pendingAction = action?.run ?? null;
    toast.value = {
      id: Date.now(),
      message,
      actionLabel: action?.label,
    };
    timer = setTimeout(hide, ms);
  }

  function runAction() {
    const run = pendingAction;
    hide();
    run?.();
  }

  return { toast, show, hide, runAction };
}
