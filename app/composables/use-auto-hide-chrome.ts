/** True while the floating capsules are tucked away (scrolling down). */
export function useChromeHidden() {
  return useState<boolean>("chrome-hidden", () => false);
}

type Track = { y: number; anchor: number };

// How far (px) the user must scroll in one direction before the floating
// elements hide (down) or come back (up). Small jitters are ignored.
const HIDE_AFTER = 28;
const SHOW_AFTER = 20;
const NEAR_TOP = 56;
const NEAR_BOTTOM = 32;

/**
 * Floating header capsules, the bottom navigation and the reading pager hide
 * while scrolling down (more room for the lyric) and come back as soon as the
 * user scrolls up, reaches the top or the end, changes screen, or moves
 * keyboard focus into them. Listens to scroll in capture phase, so it works
 * for every scrolling container (each hymn, the search results, pages).
 */
export function useAutoHideChrome() {
  const hidden = useChromeHidden();
  const route = useRoute();
  const tracks = new WeakMap<Element, Track>();

  function onScroll(e: Event) {
    const el = e.target === document ? document.scrollingElement : e.target;
    if (!(el instanceof HTMLElement) || el.closest("[data-no-autohide]"))
      return;
    const y = el.scrollTop;
    const t = tracks.get(el) ?? { y, anchor: y };

    // Direction change: restart the distance count from here.
    if ((y > t.y && t.anchor > t.y) || (y < t.y && t.anchor < t.y))
      t.anchor = t.y;
    t.y = y;
    tracks.set(el, t);

    const atTop = y < NEAR_TOP;
    const atEnd = el.scrollHeight - el.clientHeight - y < NEAR_BOTTOM;
    if (atTop || atEnd)
      hidden.value = false;
    else if (y - t.anchor > HIDE_AFTER)
      hidden.value = true;
    else if (t.anchor - y > SHOW_AFTER)
      hidden.value = false;
  }

  function onFocusIn(e: FocusEvent) {
    if ((e.target as HTMLElement | null)?.closest("[data-floating-chrome]"))
      hidden.value = false;
  }

  onMounted(() => {
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    document.addEventListener("focusin", onFocusIn);
  });
  onBeforeUnmount(() => {
    document.removeEventListener("scroll", onScroll, { capture: true });
    document.removeEventListener("focusin", onFocusIn);
  });

  watch(() => route.fullPath, () => (hidden.value = false));

  return { hidden };
}
