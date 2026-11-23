import type { Directive } from "vue";

/**
 * `v-scroll-fade-x` (from Superbiblia): a row that scrolls sideways fades
 * out on the side that still has content (.scroll-fade-x, main.css), so a
 * card cut by the edge reads as "there is more" instead of as clipped.
 * At the start only the right edge fades; at the end only the left one.
 * A row that doesn't overflow gets no fade at all.
 */
const states = new WeakMap<HTMLElement, { schedule: () => void; cleanup: () => void }>();

function apply(el: HTMLElement) {
  const overflows = el.scrollWidth > el.clientWidth + 4;
  el.classList.toggle("scroll-fade-x", overflows);
  el.classList.toggle("at-start", !overflows || el.scrollLeft <= 4);
  el.classList.toggle("at-end", !overflows || el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
}

const scrollFadeX: Directive<HTMLElement> = {
  mounted(el) {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => apply(el));
    };
    el.addEventListener("scroll", schedule, { passive: true });
    const resize = new ResizeObserver(schedule);
    resize.observe(el);
    states.set(el, {
      schedule,
      cleanup: () => {
        cancelAnimationFrame(frame);
        el.removeEventListener("scroll", schedule);
        resize.disconnect();
      },
    });
    // Next frame, not now: measuring during mount forces layout early.
    schedule();
  },
  updated(el) {
    states.get(el)?.schedule();
  },
  unmounted(el) {
    states.get(el)?.cleanup();
    states.delete(el);
  },
  getSSRProps: () => ({}),
};

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive("scroll-fade-x", scrollFadeX);
});
