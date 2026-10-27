import { ApiError, decodeFrame } from "./api";
import { record } from "../domain/nodes";
export type Connection = "connecting" | "live" | "polling" | "paused" | "error";
type Socket = Pick<
  WebSocket,
  "readyState" | "close" | "onmessage" | "onclose" | "onerror"
>;
type Options = {
  url: string;
  fetchNodes: (signal: AbortSignal) => Promise<unknown[]>;
  socketFactory?: (url: string) => Socket;
  decode?: typeof decodeFrame;
  onNodes: (nodes: unknown[]) => void;
  onState: (state: Connection, error?: string, closed?: boolean) => void;
};
export function createLiveClient(o: Options) {
  let active = false,
    epoch = 0,
    revision = 0,
    socket: Socket | null = null,
    pending = false,
    streaming = false;
  let abort: AbortController | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined,
    poll: ReturnType<typeof setTimeout> | undefined,
    silent: ReturnType<typeof setTimeout> | undefined;
  const state = (s: Connection, e?: string, closed?: boolean) =>
    o.onState(s, e, closed);
  const fetchOnce = async () => {
    if (!active || pending) return;
    pending = true;
    const started = epoch,
      version = revision,
      controller = new AbortController();
    abort = controller;
    try {
      const nodes = await o.fetchNodes(controller.signal);
      if (active && started === epoch && version === revision) {
        o.onNodes(nodes);
        if (!streaming) state("polling");
      }
    } catch (e) {
      if (
        active &&
        started === epoch &&
        version === revision &&
        !controller.signal.aborted
      ) {
        const closed = e instanceof ApiError && e.status === 401;
        if (closed) {
          stop();
          o.onNodes([]);
        }
        state(
          "error",
          e instanceof Error ? e.message : "节点数据加载失败",
          closed,
        );
      }
    } finally {
      if (started === epoch) {
        pending = false;
        abort = null;
      }
    }
  };
  const pollSoon = () => {
    if (active && !streaming && !poll)
      poll = setTimeout(async () => {
        poll = undefined;
        await fetchOnce();
        pollSoon();
      }, 5000);
  };
  const disconnect = () => {
    streaming = false;
    if (socket) {
      socket.onclose = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.close();
      socket = null;
    }
    clearTimeout(silent);
    clearTimeout(retry);
  };
  const watch = () => {
    clearTimeout(silent);
    silent = setTimeout(() => {
      if (!active) return;
      state("polling", "实时数据中断，正在重新连接");
      disconnect();
      pollSoon();
      void fetchOnce();
      connect();
    }, 10000);
  };
  const connect = () => {
    if (!active) return;
    let opened: Socket;
    try {
      opened = (o.socketFactory ?? ((url) => new WebSocket(url)))(o.url);
      socket = opened;
    } catch {
      state("polling", "实时连接暂不可用，使用轮询");
      pollSoon();
      retry = setTimeout(connect, 5000);
      return;
    }
    watch();
    let queue = Promise.resolve();
    opened.onmessage = (e) => {
      queue = queue
        .then(async () => {
          const data: unknown = JSON.parse(
            await (o.decode ?? decodeFrame)(e.data),
          );
          if (!active || socket !== opened || opened.readyState !== 1) return;
          if (!record(data) || !Array.isArray(data.nodes)) return;
          // Publish first: malformed node arrays cannot keep an unusable stream alive.
          o.onNodes(data.nodes);
          revision++;
          streaming = true;
          watch();
          state("live");
          clearTimeout(poll);
          poll = undefined;
        })
        .catch(() => {
          /* watchdog replaces unreadable streams */
        });
    };
    opened.onerror = () => opened.close();
    opened.onclose = () => {
      if (!active || socket !== opened) return;
      socket = null;
      streaming = false;
      clearTimeout(silent);
      state("polling", "实时连接已断开，轮询中");
      pollSoon();
      retry = setTimeout(connect, 5000);
    };
  };
  function stop() {
    active = false;
    epoch++;
    pending = false;
    abort?.abort();
    abort = null;
    disconnect();
    clearTimeout(poll);
    poll = undefined;
  }
  return {
    start() {
      stop();
      active = true;
      state("connecting");
      void fetchOnce();
      pollSoon();
      connect();
    },
    stop,
  };
}
