import type { Screen } from "~/utils/culto/screens";

/**
 * What the projector window needs to draw: nothing else crosses the channel.
 * A hymn verse or a designed page (see utils/culto/screens.ts), already laid
 * out by the console.
 */
export type ProjectorState = {
  screen: Screen | null;
  black: boolean;
};

type Message
  = | { type: "state"; state: ProjectorState }
    | { type: "hello" }
    | { type: "heartbeat" }
    | { type: "bye" };

const CHANNEL = "acapela-projector";
export const PROJECTOR_WINDOW_NAME = "acapela-projector";

/**
 * Operator side: publishes the live state and tracks whether a projector
 * window is listening (it says hello on load and sends a heartbeat).
 */
export function useProjectorSender(state: Ref<ProjectorState> | ComputedRef<ProjectorState>) {
  const connected = ref(false);
  let lastSeen = 0;
  let channel: BroadcastChannel | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  function post() {
    // JSON round-trip: reactive proxies are not structured-cloneable.
    channel?.postMessage({
      type: "state",
      state: JSON.parse(JSON.stringify(state.value)),
    } satisfies Message);
  }

  onMounted(() => {
    if (typeof BroadcastChannel === "undefined")
      return;
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (e: MessageEvent<Message>) => {
      if (e.data.type === "hello" || e.data.type === "heartbeat") {
        lastSeen = Date.now();
        connected.value = true;
        if (e.data.type === "hello")
          post();
      }
      else if (e.data.type === "bye") {
        connected.value = false;
      }
    };
    timer = setInterval(() => {
      connected.value = Date.now() - lastSeen < 5000;
    }, 1500);
    post();
  });

  watch(state, post, { deep: true });

  onBeforeUnmount(() => {
    if (timer)
      clearInterval(timer);
    channel?.close();
  });

  return { connected };
}

/** Projector side: receives the live state and keeps announcing itself. */
export function useProjectorReceiver() {
  const state = ref<ProjectorState | null>(null);
  let channel: BroadcastChannel | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  function bye() {
    channel?.postMessage({ type: "bye" } satisfies Message);
  }

  onMounted(() => {
    if (typeof BroadcastChannel === "undefined")
      return;
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (e: MessageEvent<Message>) => {
      if (e.data.type === "state")
        state.value = e.data.state;
    };
    channel.postMessage({ type: "hello" } satisfies Message);
    timer = setInterval(() => channel?.postMessage({ type: "heartbeat" } satisfies Message), 2000);
    window.addEventListener("pagehide", bye);
  });

  onBeforeUnmount(() => {
    bye();
    if (timer)
      clearInterval(timer);
    window.removeEventListener("pagehide", bye);
    channel?.close();
  });

  return { state };
}
