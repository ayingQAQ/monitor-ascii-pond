export type Metrics = {
  cpu: number;
  mem_used: number;
  mem_total: number;
  disk_used: number;
  disk_total: number;
  net_rx: number;
  net_tx: number;
  uptime?: number;
  swap_used?: number;
  swap_total?: number;
  load?: number[];
  tcp?: number;
  udp?: number;
  procs?: number;
};
export type NodeData = {
  id: number;
  name: string;
  sort: number;
  online: boolean;
  group: string;
  country: string;
  public_remark: string;
  metrics: Metrics | null;
  metricsInvalid: boolean;
  os: string;
  kernel: string;
  arch: string;
  virt: string;
  cpu_name: string;
  agent_version: string;
  cpu_cores?: number;
  mem_total?: number;
  disk_total?: number;
  swap_total?: number;
  price?: number;
  currency: string;
  billing_cycle: string;
  traffic_mode: string;
  traffic_limit?: number;
  total_rx?: number;
  total_tx?: number;
  month_rx?: number;
  month_tx?: number;
  month_used?: number;
  month_start: string;
  traffic_reset_day?: number;
  expires_in?: number | null;
  expires_at?: string | null;
  last_seen_ago?: number | null;
  last_seen?: number;
};
export const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
const strings = [
  "name",
  "group",
  "country",
  "public_remark",
  "os",
  "kernel",
  "arch",
  "virt",
  "cpu_name",
  "agent_version",
  "currency",
  "billing_cycle",
  "traffic_mode",
  "month_start",
] as const;
const numbers = [
  "cpu_cores",
  "mem_total",
  "disk_total",
  "swap_total",
  "price",
  "traffic_limit",
  "total_rx",
  "total_tx",
  "month_rx",
  "month_tx",
  "month_used",
  "traffic_reset_day",
  "last_seen",
] as const;
export function normalizeNodes(input: unknown): NodeData[] {
  if (!Array.isArray(input)) throw new Error("节点数据格式异常");
  const seen = new Set<number>();
  const nodes = input
    .flatMap((raw): NodeData[] => {
      if (
        !record(raw) ||
        !Number.isSafeInteger(raw.id) ||
        Number(raw.id) <= 0 ||
        seen.has(Number(raw.id))
      )
        return [];
      seen.add(Number(raw.id));
      const m = raw.metrics;
      const good =
        record(m) &&
        [
          "cpu",
          "mem_used",
          "mem_total",
          "disk_used",
          "disk_total",
          "net_rx",
          "net_tx",
        ].every((k) => finite(m[k]));
      let metrics: Metrics | null = null;
      if (good && record(m)) {
        metrics = Object.fromEntries(
          [
            "cpu",
            "mem_used",
            "mem_total",
            "disk_used",
            "disk_total",
            "net_rx",
            "net_tx",
            "uptime",
            "swap_used",
            "swap_total",
            "tcp",
            "udp",
            "procs",
          ]
            .filter((k) => finite(m[k]))
            .map((k) => [k, m[k]]),
        ) as Metrics;
        if (
          Array.isArray(m.load) &&
          m.load.length === 3 &&
          m.load.every(finite)
        )
          metrics.load = m.load;
      }
      const node = {
        id: raw.id,
        sort: finite(raw.sort) ? raw.sort : 0,
        online: raw.online === true,
        metrics,
        metricsInvalid: m != null && !good,
      } as NodeData;
      for (const k of strings)
        node[k] = typeof raw[k] === "string" ? raw[k] : "";
      node.name ||= `节点 ${node.id}`;
      for (const k of numbers) if (finite(raw[k])) node[k] = raw[k];
      for (const k of ["expires_in", "last_seen_ago"] as const) {
        if (
          raw[k] === null ||
          (typeof raw[k] === "number" &&
            Number.isFinite(raw[k]) &&
            (k === "expires_in" || raw[k] >= 0))
        )
          node[k] = raw[k];
      }
      if (raw.expires_at === null || typeof raw.expires_at === "string")
        node.expires_at = raw.expires_at;
      return [node];
    })
    .sort((a, b) => a.sort - b.sort || a.id - b.id);
  if (input.length && !nodes.length) throw new Error("节点数据格式异常");
  return nodes;
}
export type Filters = {
  group: string | null;
  search: string;
  status: "all" | "online" | "offline";
};
export const groupsOf = (nodes: NodeData[]) => [
  ...new Set(nodes.map((n) => n.group).filter(Boolean)),
];
export const filterNodes = (nodes: NodeData[], f: Filters) =>
  nodes.filter(
    (n) =>
      (f.group === null || n.group === f.group) &&
      n.name
        .toLocaleLowerCase()
        .includes(f.search.trim().toLocaleLowerCase()) &&
      (f.status === "all" || n.online === (f.status === "online")),
  );
export function summaryOf(nodes: NodeData[]) {
  const online = nodes.filter((n) => n.online);
  const reported = online.filter((n) => n.metrics !== null);
  const sumKnown = (values: (number | undefined)[]) =>
    values.length === 0
      ? 0
      : values.every(finite)
        ? values.reduce<number>((a, b) => a + b!, 0)
        : null;
  return {
    online: nodes.filter((n) => n.online).length,
    total: nodes.length,
    rx: online.length && !reported.length ? null : sumKnown(reported.map((n) => n.metrics?.net_rx)),
    tx: online.length && !reported.length ? null : sumKnown(reported.map((n) => n.metrics?.net_tx)),
    missing: online.length - reported.length,
    monthRx: sumKnown(nodes.map((n) => n.month_rx)),
    monthTx: sumKnown(nodes.map((n) => n.month_tx)),
  };
}
export function monthUsage(
  n: Pick<NodeData, "month_used" | "month_rx" | "month_tx" | "traffic_mode">,
): number | null {
  if (finite(n.month_used)) return n.month_used;
  if (n.traffic_mode === "up") return finite(n.month_tx) ? n.month_tx : null;
  if (n.traffic_mode === "down") return finite(n.month_rx) ? n.month_rx : null;
  if (!finite(n.month_rx) || !finite(n.month_tx)) return null;
  return n.traffic_mode === "max"
    ? Math.max(n.month_rx, n.month_tx)
    : n.month_rx + n.month_tx;
}
export function expiryDays(n: {
  expires_in?: number | null;
  expires_at?: string | null;
}): number | null {
  if (n.expires_in !== undefined) return n.expires_in;
  if (!n.expires_at) return null;
  const target = new Date(`${n.expires_at}T00:00:00`).getTime();
  return Number.isFinite(target)
    ? Math.ceil((target - Date.now()) / 86400000)
    : null;
}
export function seenAgo(n: {
  last_seen_ago?: number | null;
  last_seen?: number;
}): number | null {
  if (n.last_seen_ago !== undefined) return n.last_seen_ago;
  return n.last_seen ? Math.max(0, Date.now() / 1000 - n.last_seen) : null;
}
export function historyWindows(days?: number): number[] {
  const whole =
    (finite(days) && days >= 1 ? Math.min(365, Math.floor(days)) : 7) * 24;
  return [
    ...[1, 6, 24, 168, 720, 2160].filter((h) => h * 1.25 <= whole),
    whole,
  ];
}
export function withGaps<T extends { ts: number }>(
  rows: T[],
  step?: number,
): (T | { ts: number })[] {
  const gaps = rows
    .slice(1)
    .map((r, i) => r.ts - rows[i].ts)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  const spacing = step || gaps[(gaps.length - 1) >> 1] || 60;
  return rows.flatMap((r, i): (T | { ts: number })[] =>
    i && r.ts - rows[i - 1].ts > spacing * 2
      ? [{ ts: rows[i - 1].ts + spacing }, r]
      : [r],
  );
}
