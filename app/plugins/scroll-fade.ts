import type { Directive } from "vue";

/**
 * `v-scroll-fade` (from Superbiblia): any container with its own vertical
 * scroll fades out on the side that still has content (.scroll-fade-y,
 * main.css), with the soft scrollbar: the top once scrolled, the bottom
 * while there is more to see. The rule: EVERY area with its own scroll
 * has it (panels, lists, dialogs' bodies…).
 *
 * `v-scroll-fade="false"` turns it off. `v-scroll-fade.parent` puts it on the
 * element's parent, for a body that scrolls but is drawn by a component (a
 * slideover's or a modal's). The classes are set again after each render,
 * so a component's `:class` does not wipe them.
 */
type FadeState = { on: boolean; target: HTMLElement; schedule: () => void; cleanup: () => void };
const yStates = new WeakMap<HTMLElement, FadeState>();

function applyY(el: HTMLElement, on: boolean) {
  el.classList.toggle("scroll-fade-y", on);
  el.classList.toggle("soft-scrollbar", on || el.classList.contains("soft-scrollbar"));
  if (!on) {
    el.classList.remove("at-top", "at-bottom");
    return;
  }
  el.classList.toggle("at-top", el.scrollTop <= 4);
  el.classList.toggle("at-bottom", el.scrollTop + el.clientHeight >= el.scrollHeight - 4);
}

const scrollFade: Directive<HTMLElement, boolean | undefined> = {
  mounted(el, binding) {
    const target = binding.modifiers.parent && el.parentElement
      ? el.parentElement
      : el;
    let frame = 0;
    const state: FadeState = {
      on: binding.value !== false,
      target,
      schedule: () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => applyY(target, state.on));
      },
      cleanup: () => {},
    };
    target.addEventListener("scroll", state.schedule, { passive: true });
    const resize = new ResizeObserver(state.schedule);
    resize.observe(target);
    const mutation = new MutationObserver(state.schedule);
    mutation.observe(target, { childList: true, subtree: true, characterData: true });
    state.cleanup = () => {
      cancelAnimationFrame(frame);
      target.removeEventListener("scroll", state.schedule);
      resize.disconnect();
      mutation.disconnect();
    };
    yStates.set(el, state);
    // What needs no measuring, now (just mounted, the scroll is at the top);
    // the heights, next frame: measuring during mount forces layout early.
    target.classList.toggle("scroll-fade-y", state.on);
    target.classList.toggle("soft-scrollbar", state.on || target.classList.contains("soft-scrollbar"));
    target.classList.toggle("at-top", state.on);
    state.schedule();
  },
  updated(el, binding) {
    const state = yStates.get(el);
    if (!state)
      return;
    state.on = binding.value !== false;
    state.schedule();
  },
  unmounted(el) {
    yStates.get(el)?.cleanup();
    yStates.delete(el);
  },
  getSSRProps: () => ({}),
};

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
  nuxtApp.vueApp.directive("scroll-fade", scrollFade);
  nuxtApp.vueApp.directive("scroll-fade-x", scrollFadeX);
});
