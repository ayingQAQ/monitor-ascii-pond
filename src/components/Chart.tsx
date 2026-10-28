import { useEffect, useRef, useState } from "react";

type Series = { key: string; name: string; color: string; dashed?: boolean };
export type ChartProps = {
  title: string;
  rows: object[];
  series: Series[];
  format: (n: number) => string;
};
type PlotModule = typeof import("./ChartPlot");
let plotModule: Promise<PlotModule> | undefined;
function loadPlot() {
  return (plotModule ??= import("./ChartPlot").catch((error) => {
    plotModule = undefined;
    throw error;
  }));
}

export function Chart(props: ChartProps) {
  const canvas = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false),
    [Plot, setPlot] = useState<PlotModule["default"] | null>(null),
    [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (typeof IntersectionObserver !== "function") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setNear(true);
        observer.disconnect();
      }
    }, { rootMargin: "200px 0px" });
    if (canvas.current) observer.observe(canvas.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!near) return;
    let disposed = false;
    setFailed(false);
    loadPlot().then((module) => {
      if (!disposed) setPlot(() => module.default);
    }).catch(() => {
      if (!disposed) setFailed(true);
    });
    return () => { disposed = true; };
  }, [near, attempt]);

  return (
    <section className="history-chart" aria-label={props.title}>
      <div className="chart-caption" data-pond-avoid>
        <h4>{props.title}</h4>
        <div className="chart-legend">
          {props.series.map((s) => (
            <span key={s.key}>
              <i style={{ borderColor: s.color, borderTopStyle: s.dashed ? "dashed" : "solid" }} />
              {s.name}
            </span>
          ))}
        </div>
      </div>
      <div className="chart-canvas" ref={canvas} data-pond-dim aria-busy={near && !Plot && !failed}>
        {Plot ? <Plot {...props} /> : near ? (
          <div className="chart-placeholder" role="status">
            {failed ? <><span>曲线暂时无法加载。</span><button onClick={() => setAttempt((n) => n + 1)}>重试 ↻</button></> : "正在展开曲线…"}
          </div>
        ) : null}
      </div>
    </section>
  );
}
