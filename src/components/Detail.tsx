import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { source } from "@source";
import type { History } from "../data/api";
import {
  expiryDays,
  historyWindows,
  monthUsage,
  seenAgo,
  withGaps,
  type NodeData,
} from "../domain/nodes";
import { bytes, cycle, duration, expiry, money, pct, rate } from "../domain/format";
import { latencyComparison } from "../domain/latency";
import { useHidden } from "../hooks";
import { Meter, nodeState, statusLabels } from "./NodeRow";
import { PaperSelect } from "./PaperSelect";
import { Watermark } from "./Watermark";

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
const hoursLabel = (h: number) => (h >= 24 ? `${h / 24} 天` : `${h} 小时`);
const percent = (n: number) => `${Number(n.toFixed(1))}%`;
type Series = { key: string; name: string; color: string; dashed?: boolean };
function Chart({
  title,
  rows,
  series,
  format,
}: {
  title: string;
  rows: object[];
  series: Series[];
  format: (n: number) => string;
}) {
  return (
    <section className="history-chart" aria-label={title}>
      <div className="chart-caption" data-pond-avoid>
        <h4>{title}</h4>
        <div className="chart-legend">
          {series.map((s) => (
            <span key={s.key}>
              <i
                style={{
                  borderColor: s.color,
                  borderTopStyle: s.dashed ? "dashed" : "solid",
                }}
              />
              {s.name}
            </span>
          ))}
        </div>
      </div>
      <div className="chart-canvas" data-pond-dim>
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
      </div>
    </section>
  );
}
function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="facts">
      {rows.map(([label, value]) => (
        <div key={label} data-pond-avoid>
          <dt>{label}</dt>
          <dd>{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
export default function Detail({
  node: n,
  historyDays,
  showExpiry,
}: {
  node: NodeData;
  historyDays?: number;
  showExpiry: boolean;
}) {
  const [tab, setTab] = useState<"metrics" | "ping">("metrics"),
    [hours, setHours] = useState(6),
    [width, setWidth] = useState(360),
    [attempt, setAttempt] = useState(0);
  const [history, setHistory] = useState<History | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const hidden = useHidden(),
    container = useRef<HTMLDivElement>(null);
  const windows = historyWindows(historyDays),
    range = windows.includes(hours) ? hours : windows[0];
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const size = Math.round(entry.contentRect.width / 60) * 60;
      setWidth(Math.max(60, size));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (hidden) return;
    const controller = new AbortController();
    setHistory(null);
    setError("");
    setLoading(true);
    source
      .history(n.id, range, width, tab, controller.signal)
      .then((v) => {
        if (!controller.signal.aborted) setHistory(v);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [n.id, range, width, tab, hidden, attempt]);
  useEffect(() => {
    dispatchEvent(new Event("pond-layout"));
  }, [history, tab, error]);
  const resourceRows = useMemo(
    () => withGaps(history?.metrics ?? [], history?.step),
    [history],
  );
  const latency = useMemo(() => latencyComparison(history), [history]);
  const state = nodeState(n),
    m = n.metrics,
    mem = m?.mem_total ?? n.mem_total,
    disk = m?.disk_total ?? n.disk_total,
    usage = monthUsage(n),
    usagePercent = pct(usage ?? undefined, n.traffic_limit),
    live = state === "online" ? m : null;
  const vitals = [live?.cpu ?? null, live ? pct(live.mem_used, live.mem_total) : null, live ? pct(live.disk_used, live.disk_total) : null];
  return (
    <div className="detail-content" ref={container}>
      <div className="detail-title">
        <div className="ledger-overline" data-pond-avoid><span>池畔观测手札</span><span>NO. {String(n.id).padStart(2, "0")}</span></div>
        <div className="ledger-identity">
          <div data-pond-avoid>
            <h2 data-pond-ink>{n.name}</h2>
            <p>{[n.country, n.group, n.virt].filter(Boolean).join(" / ") || "未设置分组"}</p>
            <span className={"node-status " + state}><i />{statusLabels[state]}</span>
          </div>
          <div className="ledger-imprint"><Watermark id={n.id} values={vitals} /><small>此刻 · 水纹</small></div>
        </div>
        <div className="detail-vitals" data-pond-avoid>
          {["CPU", "MEM", "DSK"].map((label, i) => <Meter key={label} label={label} value={vitals[i]} />)}
          <div className="traffic-line">
            <Meter label="流量" value={usagePercent} />
            <span className="node-network"><span title="下载">↓ {rate(live?.net_rx)}</span><span title="上传">↑ {rate(live?.net_tx)}</span></span>
          </div>
        </div>
        <div className="ledger-live" data-pond-avoid><span>{n.online ? "运行 " + duration(m?.uptime) : "离线 " + duration(seenAgo(n))}</span></div>
      </div>
      {n.public_remark && (
        <p className="public-remark" data-pond-avoid>
          {n.public_remark}
        </p>
      )}
      <section className="detail-section machine-record">
        <h3 data-pond-avoid>
          <span className="chapter-mark" aria-hidden="true">壱</span>节点档案 <span>MACHINE</span>
        </h3>
        <div className="machine-feature" data-pond-avoid>
          <span>处理器 / PROCESSOR</span>
          <strong>{n.cpu_name || "—"}</strong>
          <small>{n.cpu_cores ? `${n.cpu_cores} 核` : "—"}{n.arch ? " · " + n.arch : ""}</small>
        </div>
        <div className="machine-capacity" data-pond-avoid>
          <div><span>内存容量</span><strong>{bytes(mem)}</strong><span className="capacity-rule" aria-hidden="true">┆┆┆┆┆┆┆┆┆┆┆┆┆┆┆</span></div>
          <div><span>磁盘空间</span><strong>{bytes(disk)}</strong><span className="capacity-rule" aria-hidden="true">┆┆┆┆┆┆┆┆┆┆┆┆┆┆┆</span></div>
        </div>
        <Facts
          rows={[
            ["系统", [n.os, n.arch].filter(Boolean).join(" · ")],
            ["内核", n.kernel],
            ["交换空间", bytes(m?.swap_total ?? n.swap_total)],
            ["探针版本", n.agent_version],
            [
              n.online ? "运行时间" : "离线时间",
              duration(n.online ? m?.uptime : seenAgo(n)),
            ],
            [
              "负载",
              m?.load
                ?.map((v) => (Number.isFinite(v) ? v.toFixed(2) : "—"))
                .join(" / ") || "—",
            ],
          ]}
        />
      </section>
      <section className="detail-section usage-record">
        <h3 data-pond-avoid>
          <span className="chapter-mark" aria-hidden="true">弐</span>用量与账期 <span>WATERLINE</span>
        </h3>
        <div className="usage-waterline" data-pond-avoid>
          <div className="usage-amount"><div><span>本期计费用量</span><strong>{bytes(usage)}</strong></div><div><span>占用额度</span><strong>{usagePercent === null ? "—" : usagePercent.toFixed(1) + "%"}</strong></div></div>
          <div className="tide-scale" aria-label={`本期已用 ${bytes(usage)}，额度 ${bytes(n.traffic_limit)}`}>
            <div className="tide-marks" aria-hidden="true">{"┊".repeat(50)}</div>
            <div className="tide-glyphs" aria-hidden="true">{"∿ · ".repeat(18)}</div>
            {usagePercent !== null && <div className="tide-fill" style={{ width: `${Math.min(100, Math.max(0, usagePercent))}%` }} aria-hidden="true">{"∿∿∿".repeat(25)}</div>}
          </div>
          <div className="tide-labels"><span>0</span><span>额度 {bytes(n.traffic_limit)}</span></div>
          <div className="traffic-ledger">
            <div><span>↓ 入流 · 本期下载</span><strong>{bytes(n.month_rx)}</strong><small>累计 {bytes(n.total_rx)}</small></div>
            <div><span>↑ 出流 · 本期上传</span><strong>{bytes(n.month_tx)}</strong><small>累计 {bytes(n.total_tx)}</small></div>
          </div>
          <div className="billing-note"><span>账期</span><strong>{money(n.price, n.currency)}</strong><span>/ {cycle(n.billing_cycle)}</span></div>
        </div>
        <Facts
          rows={[
            [
              "流量计费",
              (
                {
                  up: "仅上传",
                  down: "仅下载",
                  sum: "双向累计",
                  max: "双向取大",
                } as Record<string, string>
              )[n.traffic_mode] ||
                n.traffic_mode ||
                "—",
            ],
            ["周期开始", n.month_start || "—"],
            [
              "重置日",
              n.traffic_reset_day ? `每月 ${n.traffic_reset_day} 日` : "—",
            ],
            ...(showExpiry
              ? [
                  [
                    "到期",
                    `${expiry(expiryDays(n))}${n.expires_at ? " · " + n.expires_at : ""}`,
                  ] as [string, string],
                ]
              : []),
          ]}
        />
      </section>
      <section className="detail-section history-section" aria-busy={loading}>
        <h3 data-pond-avoid>
          <span className="chapter-mark" aria-hidden="true">参</span>
          {tab === "metrics" ? "资源历史" : "延迟历史"}{" "}
          <span>TRACES</span>
        </h3>
        <div className="history-controls" data-pond-avoid>
          <div role="tablist" aria-label="历史类型">
            {(["metrics", "ping"] as const).map((t) => (
              <button
                key={t}
                id={"tab-" + t}
                role="tab"
                aria-selected={tab === t}
                aria-controls="history-content"
                onClick={() => setTab(t)}
              >
                {t === "metrics" ? "资源" : "延迟"}
              </button>
            ))}
          </div>
          <PaperSelect label="历史时间范围" value={String(range)}
            onChange={value => setHours(Number(value))}
            options={windows.map(h => ({ value: String(h), label: `近 ${hoursLabel(h)}` }))}
          />
        </div>
        <div
          id="history-content"
          role="tabpanel"
          aria-labelledby={"tab-" + tab}
        >
          {hidden ? (
            <p className="history-message">页面隐藏，历史请求已暂停。</p>
          ) : loading ? (
            <p className="history-message">正在读取水面的痕迹…</p>
          ) : error ? (
            <div className="history-message" role="alert">
              <p>{error}</p>
              <button onClick={() => setAttempt((v) => v + 1)}>重试 ↻</button>
            </div>
          ) : tab === "metrics" ? (
            resourceRows.length ? (
              <>
                <Chart
                  title="CPU"
                  rows={resourceRows}
                  format={percent}
                  series={[
                    { key: "cpu", name: "平均", color: "var(--accent)" },
                    {
                      key: "cpu_max",
                      name: "峰值",
                      color: "var(--accent)",
                      dashed: true,
                    },
                  ]}
                />
                <Chart
                  title="内存与磁盘"
                  rows={resourceRows}
                  format={bytes}
                  series={[
                    { key: "mem_used", name: "内存", color: "var(--probe-2)" },
                    { key: "disk_used", name: "磁盘", color: "var(--probe-3)" },
                  ]}
                />
                <Chart
                  title="网络流速"
                  rows={resourceRows}
                  format={rate}
                  series={[
                    {
                      key: "net_rx",
                      name: "下载平均",
                      color: "var(--probe-2)",
                    },
                    {
                      key: "net_rx_max",
                      name: "下载峰值",
                      color: "var(--probe-2)",
                      dashed: true,
                    },
                    { key: "net_tx", name: "上传平均", color: "var(--accent)" },
                    {
                      key: "net_tx_max",
                      name: "上传峰值",
                      color: "var(--accent)",
                      dashed: true,
                    },
                  ]}
                />
              </>
            ) : (
              <p className="history-message">这个时间范围内还没有资源记录。</p>
            )
          ) : latency.series.length ? (
            latency.series.map((p) => (
              <div key={p.key} className="probe-chart">
                <p className="probe-description">
                  {p.description}
                  {p.allLost ? " · 全部丢包" : ""}
                </p>
                <Chart
                  title={p.label}
                  rows={p.data}
                  format={(v) => `${Number(v.toFixed(1))} ms`}
                  series={[{ key: p.key, name: "延迟", color: p.color }]}
                />
              </div>
            ))
          ) : (
            <p className="history-message">这个时间范围内还没有延迟记录。</p>
          )}
          {!loading && !error && history && (
            <p className="history-footnote">
              空白处表示没有观测数据。
              {tab === "metrics"
                ? "实线为平均值，虚线为峰值。"
                : "丢包率采用 Hub 返回的整个时间窗口统计。"}
            </p>
          )}
        </div>
      </section>
      <p className="detail-end" data-pond-avoid>
        · 观测至此，水面如常 ·
      </p>
    </div>
  );
}
