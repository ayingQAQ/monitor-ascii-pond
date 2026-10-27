import { finite, record } from "../domain/nodes";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export async function api<T>(
  path: string,
  options: { fetcher?: typeof fetch; signal?: AbortSignal } = {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      const signal = options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000);
      const res = await (options.fetcher ?? fetch)(`/api${path}`, { signal });
      if (!res.ok) {
        const plain = res.headers.get("content-type")?.startsWith("text/plain")
          ? (await res.text()).trim()
          : "";
        throw new ApiError(
          res.status,
          plain || `服务暂时无法访问（HTTP ${res.status}），稍后再试`,
        );
      }
      try {
        return (await res.json()) as T;
      } catch (e) {
        if (e instanceof SyntaxError)
          throw new ApiError(res.status, "收到的不是状态数据，稍后再试");
        throw e;
      }
    } catch (e) {
      if (options.signal?.aborted) throw e;
      if (e instanceof ApiError) throw e;
      const timeout =
        e instanceof Error && ["TimeoutError", "AbortError"].includes(e.name);
      if (!timeout || attempt >= 2)
        throw new ApiError(0, "网络连接失败，稍后再试");
    }
  }
}
export async function decodeFrame(
  data: string | Blob | ArrayBuffer,
): Promise<string> {
  if (typeof data === "string") return data;
  const blob = data instanceof Blob ? data : new Blob([data]);
  return new Response(
    blob.stream().pipeThrough(new DecompressionStream("gzip")),
  ).text();
}
export type MetricPoint = {
  ts: number;
  cpu?: number;
  cpu_max?: number;
  mem_used?: number;
  disk_used?: number;
  swap_used?: number;
  net_rx?: number;
  net_tx?: number;
  net_rx_max?: number;
  net_tx_max?: number;
  minutes?: number;
};
export type PingPoint = {
  ts: number;
  task_id: number;
  latency: number | null;
  band?: [number, number];
  loss?: number;
};
export type History = {
  metrics: MetricPoint[];
  ping: PingPoint[];
  probes: Record<string, string>;
  loss: Record<string, number>;
  step?: number;
};
export function parseHistory(input: unknown): History {
  if (
    !record(input) ||
    (!Array.isArray(input.metrics) && !Array.isArray(input.ping))
  )
    throw new ApiError(200, "历史数据格式异常");
  const metrics: MetricPoint[] = (
    Array.isArray(input.metrics) ? input.metrics : []
  )
    .flatMap((r) => {
      if (!record(r) || !finite(r.ts)) return [];
      const p: MetricPoint = { ts: r.ts };
      for (const k of [
        "cpu",
        "cpu_max",
        "mem_used",
        "disk_used",
        "swap_used",
        "net_rx",
        "net_tx",
        "net_rx_max",
        "net_tx_max",
        "minutes",
      ] as const)
        if (finite(r[k])) p[k] = r[k];
      return [p];
    })
    .sort((a, b) => a.ts - b.ts);
  const ping: PingPoint[] = (
    Array.isArray(input.ping) ? input.ping : []
  ).flatMap((r) => {
    if (!record(r) || !finite(r.ts) || !finite(r.task_id)) return [];
    const p: PingPoint = {
      ts: r.ts,
      task_id: r.task_id,
      latency: finite(r.latency) ? r.latency : null,
    };
    if (finite(r.loss)) p.loss = r.loss;
    if (Array.isArray(r.band) && r.band.length === 2 && r.band.every(finite))
      p.band = r.band as [number, number];
    return [p];
  });
  return {
    metrics,
    ping,
    probes: Object.fromEntries(
      Object.entries(record(input.probes) ? input.probes : {}).filter(
        ([, v]) => typeof v === "string",
      ),
    ) as Record<string, string>,
    loss: Object.fromEntries(
      Object.entries(record(input.loss) ? input.loss : {}).filter(([, v]) =>
        finite(v),
      ),
    ) as Record<string, number>,
    step: finite(input.step) ? input.step : undefined,
  };
}
