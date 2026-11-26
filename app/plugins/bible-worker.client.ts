import type { Remote } from "comlink";

import * as Comlink from "comlink";

import type { BibleWorkerApi } from "~/workers/bible.worker";

// Same mechanism as SúperBiblia (plugins/bible-worker.client.ts there).
//
// The OPFS "SAH Pool" VFS the worker uses allows ONE connection per origin,
// not per tab, and Acapela often has several windows open at once (the
// console and the projector, the installed app and a browser tab). The Web
// Locks API elects one "leader" tab, the first to ask, which runs the real
// worker; the others talk to it over a BroadcastChannel. When the leader
// closes, its lock is released and the next tab in line takes over on the
// same channel, without the others doing anything.

const LOCK_NAME = "acapela-bible-worker-leader";
const CHANNEL_NAME = "acapela-bible-worker";
// Separate from CHANNEL_NAME (Comlink's): a new leader says it is listening.
const LEADER_READY_CHANNEL_NAME = "acapela-bible-worker-leader-ready";
const LEADER_READY_MESSAGE = "leader-ready";

/**
 * A follower's request travels to the leader of that moment; if the leader
 * goes away meanwhile (reload, close) nobody answers and the call would hang.
 * Each pending request is sent again when a new leader announces itself; the
 * first answer wins. Safe to repeat: the API only reads or imports
 * idempotently.
 */
function relayWithLeaderRetry<T>(call: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const leaderReady = new BroadcastChannel(LEADER_READY_CHANNEL_NAME);
    let settled = false;
    function settle() {
      settled = true;
      leaderReady.close();
    }
    function attempt() {
      call().then(
        (value) => {
          if (settled)
            return;
          settle();
          resolve(value);
        },
        (err) => {
          if (settled)
            return;
          settle();
          reject(err);
        },
      );
    }
    leaderReady.onmessage = (event) => {
      if (!settled && event.data === LEADER_READY_MESSAGE)
        attempt();
    };
    attempt();
  });
}

function createDirectApi(): BibleWorkerApi {
  const worker = new Worker(new URL("~/workers/bible.worker.ts", import.meta.url), { type: "module" });
  return Comlink.wrap<BibleWorkerApi>(worker) as unknown as BibleWorkerApi;
}

/**
 * Hand-written relay: loadVersion's progress callback is a Comlink.proxy(),
 * which needs to transfer a MessagePort, and BroadcastChannel cannot
 * transfer. From a follower tab, versions load without fine progress.
 */
function createFollowerApi(): BibleWorkerApi {
  const relayed = Comlink.wrap<BibleWorkerApi>(new BroadcastChannel(CHANNEL_NAME)) as Remote<BibleWorkerApi>;
  const r = relayWithLeaderRetry;
  return {
    getPoolStatus: () => r(() => relayed.getPoolStatus()),
    listAvailableVersions: () => r(() => relayed.listAvailableVersions()),
    loadVersion: versionId => r(() => relayed.loadVersion(versionId)),
    removeVersion: versionId => r(() => relayed.removeVersion(versionId)),
    getBookList: versionId => r(() => relayed.getBookList(versionId)),
    getChapter: (versionId, bookId, chapter) => r(() => relayed.getChapter(versionId, bookId, chapter)),
    getPassage: (versionId, bookId, from, to) => r(() => relayed.getPassage(versionId, bookId, from, to)),
    search: (versionId, query, opts) => r(() => relayed.search(versionId, query, opts)),
  };
}

function exposeAsLeader(api: BibleWorkerApi) {
  Comlink.expose(api, new BroadcastChannel(CHANNEL_NAME));
  const announcer = new BroadcastChannel(LEADER_READY_CHANNEL_NAME);
  announcer.postMessage(LEADER_READY_MESSAGE);
  announcer.close();
}

function resolveApi(): Promise<BibleWorkerApi> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("locks" in navigator)) {
      // No Web Locks (insecure context, very old browser): no coordination.
      resolve(createDirectApi());
      return;
    }

    navigator.locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
      if (lock) {
        const api = createDirectApi();
        exposeAsLeader(api);
        resolve(api);
        // Never resolves: holds the lock (leadership) while the tab lives.
        await new Promise<void>(() => {});
        return;
      }

      resolve(createFollowerApi());

      // Queued behind the current leader: when it goes, this tab exposes
      // its own worker on the same channel its calls already use.
      await navigator.locks.request(LOCK_NAME, async () => {
        exposeAsLeader(createDirectApi());
        await new Promise<void>(() => {});
      });
    });
  });
}

/**
 * Provides $bibleWorker (use useBibleWorker()). The worker is only created
 * on first use: the hymnal never pays for SQLite.
 */
export default defineNuxtPlugin(() => {
  let readyApi: Promise<BibleWorkerApi> | null = null;

  const api = new Proxy({}, {
    get(_target, method: string) {
      return async (...args: unknown[]) => {
        readyApi ??= resolveApi();
        const resolved = await readyApi;
        return (resolved as unknown as Record<string, (...fnArgs: unknown[]) => unknown>)[method]!(...args);
      };
    },
  }) as BibleWorkerApi;

  return {
    provide: {
      bibleWorker: api,
    },
  };
});
