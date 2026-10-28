import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartProps } from "./Chart";

const time = (ts: number) =>
  new Date(ts * 1000).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
const dateTime = (ts: unknown) =>
  new Date(Number(ts) * 1000).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
export default function ChartPlot({ rows, series, format }: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart
        data={rows}
        margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
        accessibilityLayer
      >
        <CartesianGrid
          vertical={false}
          stroke="var(--line)"
          strokeDasharray="2 5"
        />
        <XAxis
          dataKey="ts"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={time}
          tickLine={false}
          axisLine={false}
          minTickGap={36}
          tick={{ fill: "var(--muted)", fontSize: 10 }}
        />
        <YAxis
          width={58}
          tickFormatter={format}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted)", fontSize: 10 }}
        />
        <Tooltip
          labelFormatter={dateTime}
          formatter={(v) => (v == null ? "—" : format(Number(v)))}
          contentStyle={{
            background: "var(--bg)",
            border: "1px solid var(--line)",
            borderRadius: 0,
            color: "var(--fg)",
            fontSize: 11,
          }}
        />
        {series.map((s) => (
          <Line
            key={s.key}
            type="linear"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={1.5}
            strokeDasharray={s.dashed ? "3 4" : undefined}
            dot={false}
            activeDot={{ r: 3 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
