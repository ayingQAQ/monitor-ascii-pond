import type { History } from "../data/api";
import { withGaps } from "./nodes";
export type LatencyRow = {
  ts: number;
  [key: string]: number | null | undefined;
};
export function latencyComparison(data: History | null) {
  // The shared rows define the axis/tooltip times; each line retains its own
  // samples and gaps so probes with different intervals do not break each other.
  const timestamps = new Map<number, LatencyRow>();
  const ids = [...new Set(data?.ping.map((p) => p.task_id) ?? [])];
  const series = ids.map((id, index) => {
    const key = `probe_${id}`;
    const points = (data?.ping.filter((p) => p.task_id === id) ?? [])
      .slice()
      .sort((a, b) => a.ts - b.ts);
    const rows = withGaps(points, data?.step).map((p) => {
      const row: LatencyRow = {
        ts: p.ts,
        [key]: "latency" in p ? p.latency : null,
        [`${key}_low`]: "band" in p ? p.band?.[0] : undefined,
        [`${key}_high`]: "band" in p ? p.band?.[1] : undefined,
      };
      timestamps.set(p.ts, { ...timestamps.get(p.ts), ...row });
      return row;
    });
    return {
      key,
      label: data?.probes[id] || `探测 ${id}`,
      color: `var(--probe-${(index % 6) + 1})`,
      data: rows,
      range: [`${key}_low`, `${key}_high`] as [string, string],
      description:
        data?.loss[id] === undefined
          ? "窗口丢包 —"
          : `窗口丢包 ${data.loss[id].toLocaleString("zh-CN", { maximumFractionDigits: 2 })}%`,
      allLost: points.length > 0 && points.every((p) => p.latency === null),
    };
  });
  return { rows: [...timestamps.values()].sort((a, b) => a.ts - b.ts), series };
}
