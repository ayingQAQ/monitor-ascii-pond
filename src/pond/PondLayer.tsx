import { memo, useEffect, useRef } from "react";
import type { PondInstance } from "../vendor/ascii-pond/pond.js";
import { useHidden, useMedia } from "../hooks";
type Props = {
  enabled: boolean;
  feeding: boolean;
  paused: boolean;
  theme: "light" | "dark";
  origin: { x: number; y: number } | null;
  onUnavailable: () => void;
};
export const PondLayer = memo(function PondLayer({
  enabled,
  feeding,
  paused,
  theme,
  origin,
  onUnavailable,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null),
    instance = useRef<PondInstance | null>(null),
    lastTheme = useRef(theme);
  const mobile = useMedia("(max-width: 639px)"),
    reduced = useMedia("(prefers-reduced-motion: reduce)"),
    forced = useMedia("(forced-colors: active)"),
    hidden = useHidden();
  const current = useRef({ theme, feeding, paused, reduced, hidden });
  current.current = { theme, feeding, paused, reduced, hidden };
  useEffect(() => {
    if (!enabled || forced || !canvas.current) return;
    let disposed = false, starting = false;
    let frame = 0, idle = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pond: PondInstance | null = null;
    const start = async () => {
      if (disposed || document.hidden || starting || pond) return;
      starting = true;
      try {
        const { mount } = await import("../vendor/ascii-pond/pond.js");
        if (disposed || document.hidden || !canvas.current) return;
        const state = current.current;
        pond = mount(canvas.current, {
          species: [
            { type: "koi", count: mobile ? 2 : 4, young: mobile ? 1 : 2 },
          ],
          theme: state.theme,
          paused: state.paused || state.reduced || state.hidden,
          feed: state.feeding,
          maxFps: mobile ? 24 : 30,
          maxDpr: mobile ? 1 : 1.5,
          contentRoot: document.getElementById("root")!,
        });
        instance.current = pond;
        lastTheme.current = state.theme;
        canvas.current.dataset.state = pond.paused ? "paused" : "running";
        document.removeEventListener("visibilitychange", schedule);
      } catch {
        if (!disposed) onUnavailable();
      } finally {
        starting = false;
      }
    };
    // Let the first content paint and API requests run before loading the canvas engine.
    // Scheduling is cancellable, including StrictMode's throwaway mount and hidden tabs.
    const schedule = () => {
      if (disposed || document.hidden || pond || frame || idle || timer) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (typeof window.requestIdleCallback === "function") {
          idle = window.requestIdleCallback(() => { idle = 0; void start(); }, { timeout: 500 });
        } else {
          timer = setTimeout(() => { timer = undefined; void start(); }, 0);
        }
      });
    };
    document.addEventListener("visibilitychange", schedule);
    schedule();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      if (idle) window.cancelIdleCallback(idle);
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", schedule);
      pond?.destroy();
      instance.current = null;
    };
  }, [enabled, mobile, forced, onUnavailable]);
  useEffect(() => {
    const pond = instance.current;
    if (!pond) return;
    if (paused || reduced || hidden) pond.pause();
    else pond.resume();
    if (canvas.current)
      canvas.current.dataset.state = pond.paused ? "paused" : "running";
  }, [paused, reduced, hidden, enabled, mobile, forced]);
  useEffect(() => {
    instance.current?.setFeeding(feeding);
  }, [feeding, enabled, mobile, forced]);
  useEffect(() => {
    if (lastTheme.current === theme) return;
    lastTheme.current = theme;
    instance.current?.setTheme(theme === "light", origin ?? undefined);
  }, [theme, origin]);
  return enabled && !forced ? (
    <canvas ref={canvas} className="pond-canvas" aria-hidden="true" />
  ) : null;
});
