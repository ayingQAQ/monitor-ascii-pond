export function bytes(n?: number | null): string {
  if (n == null || !Number.isFinite(n) || n < 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = n < 1 ? 0 : Math.min(5, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toLocaleString("en-US", { maximumFractionDigits: i ? 1 : 0 })} ${units[i]}`;
}
export const rate = (n?: number | null) => (n == null ? "—" : `${bytes(n)}/s`);
export const pct = (used?: number, total?: number) =>
  used == null || total == null || total <= 0 ? null : (used / total) * 100;
export function duration(n?: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n >= 86400
    ? `${Math.floor(n / 86400)} 天`
    : n >= 3600
      ? `${Math.floor(n / 3600)} 小时`
      : n >= 60
        ? `${Math.floor(n / 60)} 分`
        : "不足 1 分";
}
export function expiry(days: number | null) {
  return days === null
    ? "未设到期"
    : days === 0
      ? "今天到期"
      : days < 0
        ? `已过期 ${-days} 天`
        : `${days} 天后到期`;
}
export function money(n?: number, currency = "CNY") {
  if (n === undefined) return "—";
  if (n === 0) return "免费";
  try {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}
export function cycle(v: string) {
  const names: Record<string, string> = {
    monthly: "月付",
    quarterly: "季付",
    semiannual: "半年付",
    yearly: "年付",
    biennial: "两年付",
    triennial: "三年付",
    once: "一次性",
  };
  const months = /^(\d+)m$/.exec(v)?.[1];
  return names[v] || (months ? `${months} 个月付` : v || "—");
}
