import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { source } from "@source";
import type { Site, Snapshot } from "./data/types";
import {
  defaults,
  readPreference,
  savePreference,
  type Mode,
  type DisplayMode,
} from "./config/settings";
import { filterNodes, groupsOf, summaryOf, type Filters } from "./domain/nodes";
import { rate } from "./domain/format";
import { useHidden, useMedia } from "./hooks";
import { PondLayer } from "./pond/PondLayer";
import { NodeRow } from "./components/NodeRow";
import { PondStage } from "./components/PondStage";
import { PaperSelect } from "./components/PaperSelect";
import Detail from "./components/Detail";
const routeId = () =>
  location.pathname === "/"
    ? null
    : Number(/^\/node\/(\d+)\/?$/.exec(location.pathname)?.[1] || -1);
const initialMode = () => {
  const v = readPreference("mode");
  return v === "auto" || v === "dark" || v === "light" ? v : null;
};
const initialDisplay = () => {
  const v = readPreference("display");
  return v === "garden" || v === "ambient" ? v : null;
};
const connectionLabels = {
  connecting: "正在连接",
  live: "实时更新",
  polling: "轮询更新",
  paused: "后台休眠",
  error: "连接异常",
};
export default function App() {
  const [site, setSite] = useState<Site | null>(null),
    [siteError, setSiteError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [settings, setSettings] = useState(defaults),
    [settingsReady, setSettingsReady] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot>({
    nodes: null,
    state: "connecting",
    error: "",
    closed: false,
  });
  const [route, setRoute] = useState(routeId),
    [filters, setFilters] = useState<Filters>({
      group: null,
      search: "",
      status: "all",
    });
  const [preference, setPreference] = useState<Mode | null>(initialMode),
    [displayPreference, setDisplayPreference] = useState<DisplayMode | null>(initialDisplay),
    [paused, setPaused] = useState(() => readPreference("paused") === "true"),
    [pondFailed, setPondFailed] = useState(false);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const dark = useMedia("(prefers-color-scheme: dark)"),
    reduced = useMedia("(prefers-reduced-motion: reduce)"),
    forced = useMedia("(forced-colors: active)");
  const hidden = useHidden();
  const choice = preference ?? settings.color_mode,
    theme = choice === "auto" ? (dark ? "dark" : "light") : choice,
    display = displayPreference ?? settings.display_mode;
  const backContext = useRef({ scroll: 0, id: 0 }),
    previousRoute = useRef(route),
    detailHeading = useRef<HTMLDivElement>(null);
  const unavailable = useCallback(() => setPondFailed(true), []);
  useEffect(() => {
    if (hidden) return;
    const controller = new AbortController();
    setSiteError("");
    source
      .loadSite(controller.signal)
      .then((v) => {
        if (!controller.signal.aborted) setSite(v);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setSiteError(e.message);
      });
    return () => controller.abort();
  }, [attempt, hidden]);
  useEffect(() => {
    if (hidden) return;
    const controller = new AbortController();
    source.loadConfig(controller.signal).then((v) => {
      if (!controller.signal.aborted) {
        setSettings(v);
        setSettingsReady(true);
      }
    });
    return () => controller.abort();
  }, [hidden]);
  useEffect(() => source.subscribe(setSnapshot), []);
  useEffect(() => {
    if (snapshot.closed) {
      setSite(null);
      setAttempt((n) => n + 1);
    }
  }, [snapshot.closed]);
  useEffect(() => {
    if (site && !site.public_page && !site.authed) location.replace("/admin/");
  }, [site]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#1a1917" : "#f5f4f1");
  }, [theme]);
  useEffect(() => {
    setOrigin(null);
  }, [dark]);
  useEffect(() => {
    const sync = () => setRoute(routeId());
    addEventListener("popstate", sync);
    return () => removeEventListener("popstate", sync);
  }, []);
  useEffect(() => {
    const before = previousRoute.current;
    previousRoute.current = route;
    const id = requestAnimationFrame(() => {
      if (route === null && before !== null) {
        window.scrollTo({
          top: backContext.current.scroll,
          behavior: "instant",
        });
        document
          .querySelector<HTMLAnchorElement>(
            '[data-node-id="' + backContext.current.id + '"]',
          )
          ?.focus({ preventScroll: true });
      } else if (route !== null) {
        window.scrollTo({ top: 0, behavior: "instant" });
        detailHeading.current?.focus({ preventScroll: true });
      }
      dispatchEvent(new Event("pond-layout"));
    });
    return () => cancelAnimationFrame(id);
  }, [route]);
  const nodes = snapshot.nodes,
    selected = nodes?.find((n) => n.id === route),
    groups = groupsOf(nodes ?? []);
  const validGroup =
    filters.group === null || nodes?.some((n) => n.group === filters.group)
      ? filters.group
      : null;
  const effective = { ...filters, group: validGroup },
    shown = filterNodes(nodes ?? [], effective),
    summary = summaryOf(shown);
  const layoutKey = JSON.stringify([
    display,
    filters,
    settings.notice,
    settings.hero_eyebrow,
    settings.hero_title,
    settings.hero_subtitle,
    nodes?.map((n) => [n.id, n.name, n.group]),
  ]);
  useEffect(() => {
    dispatchEvent(new Event("pond-layout"));
  }, [layoutKey]);
  useEffect(() => {
    document.title = [selected?.name, site?.site_name || "锦鲤池塘"]
      .filter(Boolean)
      .join(" · ");
  }, [selected?.name, site?.site_name]);
  const open = (id: number, e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return;
    e.preventDefault();
    backContext.current = {
      scroll: route === null ? window.scrollY : backContext.current.scroll,
      id,
    };
    if (route === null)
      history.pushState({ pondDetail: true }, "", "/node/" + id);
    else history.replaceState(history.state, "", "/node/" + id);
    setRoute(id);
  };
  const close = () => {
    if (history.state?.pondDetail) history.back();
    else {
      history.pushState({}, "", "/");
      setRoute(null);
    }
  };
  const toggleTheme = (e: MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    const next = theme === "light" ? "dark" : "light";
    setPreference(next);
    savePreference("mode", next);
  };
  const togglePause = () =>
    setPaused((v) => {
      savePreference("paused", String(!v));
      return !v;
    });
  const toggleDisplay = () => {
    const next = display === "garden" ? "ambient" : "garden";
    setDisplayPreference(next);
    savePreference("display", next);
  };
  const pondEnabled = settings.pond_enabled && !pondFailed;
  const ambient = route !== null || display === "ambient";
  const hasTitle = Boolean(settings.hero_title.trim());
  const hasIntro = hasTitle || Boolean(settings.hero_eyebrow.trim() || settings.hero_subtitle.trim());
  return (
    <>
      <PondLayer
        enabled={settingsReady && pondEnabled}
        paused={paused}
        feeding={settings.feeding_enabled}
        theme={theme}
        origin={origin}
        onUnavailable={unavailable}
      />
      {ambient && <div className="ambient-water" data-pond-habitat data-pond-overflow="visible" data-pond-scene="ambient" aria-hidden="true" />}
      <div className={"site-shell" + (route !== null ? " has-detail" : "") + (ambient ? " ambient-scene" : "") + (route === null && ambient ? " home-ambient" : "") + (route === null && !hasTitle ? " home-compact" : "")}>
        <a className="skip-link" href="#main">
          跳到主要内容
        </a>
        <header className="site-header">
          <a
            className="brand"
            href="/"
            data-pond-ignore
            data-pond-avoid
            onClick={(e) => {
              if (e.ctrlKey || e.metaKey) return;
              e.preventDefault();
              if (route !== null) close();
            }}
          >
            <span className="brand-mark" aria-hidden="true">
              ≈
            </span>
            <span>
              <b data-pond-ink>
                POND<span className="brand-dot">.</span>
              </b>
              <small>{site?.site_name || "池畔观测"}</small>
            </span>
          </a>
          <nav
            className="header-actions"
            aria-label="页面控制"
            data-pond-ignore
            data-pond-avoid
          >
            {source.demo && <span className="demo-label">DEMO · 演示数据</span>}
            {route === null && (
              <button
                className="icon-button display-toggle"
                onClick={toggleDisplay}
                aria-label="全屏游鱼背景"
                aria-pressed={display === "ambient"}
                title={display === "garden" ? "切换全屏游鱼背景" : "切换水庭布局"}
              >
                <span aria-hidden="true" data-pond-ink>{display === "garden" ? "▥" : "≈"}</span>
              </button>
            )}
            <button
              className="icon-button theme-toggle"
              onClick={toggleTheme}
              aria-label="切换深浅色"
              title={theme === "light" ? "切换暖黑" : "切换纸白"}
            >
              <span aria-hidden="true" data-pond-ink>{theme === "light" ? "◐" : "◑"}</span>
            </button>
            {pondEnabled && !reduced && !forced && (
              <button
                className="icon-button"
                onClick={togglePause}
                aria-label={paused ? "继续锦鲤" : "暂停锦鲤"}
                aria-pressed={paused}
                title={paused ? "继续锦鲤" : "暂停锦鲤"}
              >
                <span aria-hidden="true" data-pond-ink>{paused ? "▷" : "Ⅱ"}</span>
              </button>
            )}
            <a className="admin-link" href="/admin/" title="前往 Monitor 后台">
              后台 <span aria-hidden="true">↗</span>
            </a>
          </nav>
        </header>
        <section className="scene-heading" aria-label="池畔概览">
          {hasIntro && (
            <div className="intro" data-pond-avoid>
              {settings.hero_eyebrow.trim() && (
                <div className="eyebrow">
                  <span className="tiny-line" aria-hidden="true" />
                  <span>{settings.hero_eyebrow}</span>
                </div>
              )}
              {settings.hero_title.trim() && <h1 data-pond-ink>{settings.hero_title}</h1>}
              {settings.hero_subtitle.trim() && <p>{settings.hero_subtitle}</p>}
            </div>
          )}
          {settings.notice && (
            <p className="notice" data-pond-avoid data-pond-ignore>
              {settings.notice}
            </p>
          )}
          <div
            className="summary"
            data-pond-avoid
            data-pond-ignore
            aria-label="当前筛选汇总"
          >
            <div>
              <span>在线节点</span>
              <strong data-testid="node-count" data-pond-ink>
                {nodes ? summary.online + " / " + summary.total : "—"}
              </strong>
            </div>
            <div>
              <span>↓ 下载{summary.missing > 0 ? " · 已上报合计" : ""}</span>
              <strong data-pond-ink>{nodes ? rate(summary.rx) : "—"}</strong>
            </div>
            <div>
              <span>↑ 上传{summary.missing > 0 ? " · 已上报合计" : ""}</span>
              <strong data-pond-ink>{nodes ? rate(summary.tx) : "—"}</strong>
            </div>
          </div>
        </section>
        <main id="main" className="observation-layout">
          <section className="roster-column" aria-label="节点观测">
            <section className="node-roster" aria-label="节点名册">
              <div className="roster-caption" data-pond-avoid>
                <h2>
                  壱 / 节点观测签{" "}
                  <span>
                    / {nodes ? String(shown.length).padStart(2, "0") : "—"}
                  </span>
                </h2>
                <span className={"connection " + snapshot.state}>
                  <i />
                  {connectionLabels[snapshot.state]}
                </span>
              </div>
              <div className="filters" data-pond-ignore data-pond-avoid>
                <label className="search">
                  <span aria-hidden="true">⌕</span>
                  <input
                    aria-label="搜索节点"
                    placeholder="寻找一个节点…"
                    value={filters.search}
                    onChange={(e) =>
                      setFilters({ ...filters, search: e.target.value })
                    }
                  />
                </label>
                <PaperSelect
                  label="节点分组"
                  value={validGroup === null ? "*" : validGroup === "" ? "empty" : "g:" + validGroup}
                  options={[
                    { value: "*", label: "全部分组" },
                    ...groups.map(g => ({ value: "g:" + g, label: g })),
                    ...(nodes?.some(n => !n.group) ? [{ value: "empty", label: "未分组" }] : []),
                  ]}
                  onChange={value => setFilters({ ...filters, group: value === "*" ? null : value === "empty" ? "" : value.slice(2) })}
                />
                <PaperSelect
                  label="节点状态"
                  value={filters.status}
                  options={[{ value: "all", label: "全部状态" }, { value: "online", label: "在线" }, { value: "offline", label: "离线" }]}
                  onChange={value => setFilters({ ...filters, status: value as Filters["status"] })}
                />
              </div>
              {route === null && <>{siteError ? (
                <div className="empty-message" role="alert" data-pond-ignore>
                  <p>{siteError}</p>
                  <button onClick={() => setAttempt((n) => n + 1)}>
                    重新连接 ↻
                  </button>
                </div>
              ) : !site || !nodes ? (
                <div
                  className="empty-message"
                  aria-busy={!snapshot.error}
                  data-pond-avoid
                >
                  {snapshot.error ? (
                    <p role="alert">{snapshot.error}</p>
                  ) : (
                    <>
                      正在连接观测站<span className="loading-dots">…</span>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {snapshot.error && (
                    <p
                      className="connection-error"
                      role="status"
                      data-pond-avoid
                    >
                      {snapshot.error}
                    </p>
                  )}
                  {shown.length ? (
                    <div className="node-list">
                      {shown.map((n, i) => (
                        <NodeRow
                          key={n.id}
                          node={n}
                          index={i}
                          selected={n.id === route}
                          showExpiry={settings.show_expiry}
                          onOpen={open}
                        />
                      ))}
                    </div>
                  ) : (
                    <div
                      className="empty-message"
                      data-pond-ignore
                      data-pond-avoid
                    >
                      <p>
                        {nodes.length
                          ? "没有找到匹配的节点"
                          : "池塘很安静，尚无公开节点"}
                      </p>
                      {nodes.length > 0 && (
                        <button
                          onClick={() =>
                            setFilters({
                              group: null,
                              search: "",
                              status: "all",
                            })
                          }
                        >
                          清除筛选 ↻
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
              <div className="roster-end" data-pond-avoid>
                <span>—</span>
                <span>一切变化，皆有所见。</span>
                <span>—</span>
              </div></>}
            {route !== null ? (
              <aside
                className="detail-panel"
                data-pond-ignore
                aria-label="节点详情"
              >
                <div
                  className="detail-navigation"
                  ref={detailHeading}
                  tabIndex={-1}
                  data-pond-avoid
                >
                  <span>NODE / {String(route).padStart(2, "0")}</span>
                  <button onClick={close} aria-label="返回节点名册">
                    返回名册 <span aria-hidden="true">↶</span>
                  </button>
                </div>
                {selected ? (
                  <Detail
                    key={selected.id}
                    node={selected}
                    historyDays={site?.history_days}
                    showExpiry={settings.show_expiry}
                  />
                ) : (
                  <div className="empty-message" data-pond-avoid>
                    <h2>{nodes ? "节点不存在或未公开" : "正在读取节点…"}</h2>
                  </div>
                )}
              </aside>
            ) : null}
            </section>
          </section>
          {!ambient && <div className="water-column">
            <PondStage
              rx={nodes ? summary.rx : null}
              tx={nodes ? summary.tx : null}
              partial={summary.missing > 0}
              paused={paused || reduced}
              enabled={pondEnabled&&!forced}
              feeding={settings.feeding_enabled}
            />

          </div>}
        </main>
        <footer className="site-footer">
          <span data-pond-avoid data-pond-ignore>
            <span className="footer-seal">池</span> POND /{" "}
            <a
              href="https://github.com/ayingQAQ/monitor-ascii-pond"
              title="查看 monitor-ascii-pond 项目"
              target="_blank"
              rel="noreferrer"
            >
              MONITOR
            </a>
          </span>
          <span className="water-instruction" data-pond-avoid>
            {pondFailed
              ? "池塘暂不可用"
              : !settings.pond_enabled
                ? "池塘已关闭"
                : reduced
                  ? "静水模式 · 遵循减少动态效果设置"
                  : paused
                    ? "鱼群小憩中"
                    : settings.feeding_enabled
                      ? "轻点水面，投一把鱼食。"
                      : "看鱼游，也看节点运行。"}
          </span>
        </footer>
      </div>
    </>
  );
}
