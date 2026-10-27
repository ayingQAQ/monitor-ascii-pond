import { memo, type MouseEvent } from "react";
import type { NodeData } from "../domain/nodes";
import { expiryDays, monthUsage, seenAgo } from "../domain/nodes";
import { bytes, duration, expiry, pct, rate } from "../domain/format";
import { Watermark } from "./Watermark";
export function nodeState(n: NodeData) {
  return !n.online
    ? "offline"
    : n.metricsInvalid
      ? "invalid"
      : !n.metrics
        ? "waiting"
        : "online";
}
export const statusLabels = {
  online: "在线",
  offline: "离线",
  waiting: "等待上报",
  invalid: "指标异常",
};
export function Meter({ label, value }: { label: string; value: number | null }) {
  const filled =
    value === null
      ? 0
      : Math.round((Math.max(0, Math.min(100, value)) / 100) * 8);
  return (
    <span className="meter">
      <span className="meter-label">{label}</span>
      <span className="meter-track" aria-hidden="true">
        <span className="meter-fill">{"∿".repeat(filled)}</span>
        {"·".repeat(8 - filled)}
      </span>
      <span className="meter-value">
        {value === null ? "—" : value.toFixed(1) + "%"}
      </span>
    </span>
  );
}
export const NodeRow = memo(function NodeRow({
  node: n,
  index,
  selected,
  showExpiry,
  onOpen,
}: {
  node: NodeData;
  index: number;
  selected: boolean;
  showExpiry: boolean;
  onOpen: (id: number, e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const state = nodeState(n),
    m = state === "online" ? n.metrics : null,
    usage = monthUsage(n);
  return (
    <a
      className={"node-row " + state + (selected ? " selected" : "")}
      data-testid="node-row"
      data-node-id={n.id}
      data-pond-ignore
      href={"/node/" + n.id}
      aria-label={n.name + "，" + statusLabels[state]}
      aria-current={selected ? "page" : undefined}
      onClick={(e) => onOpen(n.id, e)}
    >
      <div className="node-water-sign" data-pond-avoid>
        <span className="node-sign-number">
          {String(index + 1).padStart(2, "0")}
        </span>
        <Watermark
          id={n.id}
          values={[
            m?.cpu ?? null,
            m ? pct(m.mem_used, m.mem_total) : null,
            m ? pct(m.disk_used, m.disk_total) : null,
          ]}
        />
        <span className="node-sign-country">{n.country || "NODE"}</span>
      </div>
      <div className="node-letter">
        <div className="node-heading" data-pond-avoid>
          <span className="node-index">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="node-name" data-pond-ink>
            {n.name}
          </span>
          <span className="node-country">{n.country || "—"}</span>
          <span className={"node-status " + state}>
            <i />
            {statusLabels[state]}
          </span>
          <span className="node-arrow" aria-hidden="true">
            ↗
          </span>
        </div>
        <div className="node-resources" data-pond-avoid>
          <Meter label="CPU" value={m?.cpu ?? null} />
          <Meter label="MEM" value={m ? pct(m.mem_used, m.mem_total) : null} />
          <Meter
            label="DSK"
            value={m ? pct(m.disk_used, m.disk_total) : null}
          />
          <div className="traffic-line">
            <Meter label="流量" value={pct(usage ?? undefined, n.traffic_limit)} />
            <span className="node-network">
              <span title="下载">↓ {rate(m?.net_rx)}</span>
              <span title="上传">↑ {rate(m?.net_tx)}</span>
            </span>
          </div>
        </div>
        <div className="node-bottom" data-pond-avoid>
          <span className="node-meta">
            {state === "offline" ? (
              <span>离线 {duration(seenAgo(n))}</span>
            ) : (
              <span>本期 {bytes(usage)}{n.traffic_limit ? ` / ${bytes(n.traffic_limit)}` : ""}</span>
            )}
            {showExpiry && (
              <span className={(expiryDays(n) ?? 99) < 7 ? "due" : ""}>
                {expiry(expiryDays(n))}
              </span>
            )}
          </span>
        </div>
      </div>
      <span className="node-ripple-edge" aria-hidden="true">
        ﹏ ﹏ ﹏ ﹏ ﹏
      </span>
    </a>
  );
});
