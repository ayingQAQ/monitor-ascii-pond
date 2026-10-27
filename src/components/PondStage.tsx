import { useId, useLayoutEffect, useRef } from "react";
import { rate } from "../domain/format";

/** The pond is a composed part of the page, not an empty background column. */
export function PondStage({
  rx,
  tx,
  paused,
  enabled,
  feeding,
}: {
  rx: number | null;
  tx: number | null;
  paused: boolean;
  enabled: boolean;
  feeding: boolean;
}) {
  const rim = useId();
  const stage = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = stage.current;
    const column = element?.parentElement;
    if (!element || !column) return;
    // The grid owns horizontal alignment; scroll never changes the fixed water's position.
    const align = () => {
      const rect = column.getBoundingClientRect();
      for (const [name, value] of [["--pond-left", `${rect.left}px`], ["--pond-width", `${rect.width}px`]]) {
        if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
      }
    };
    const observer = new ResizeObserver(align);
    observer.observe(column);
    observer.observe(document.documentElement);
    addEventListener("resize", align);
    align();
    return () => { observer.disconnect(); removeEventListener("resize", align); };
  }, []);
  return (
    <section ref={stage} className="pond-stage" aria-label="锦鲤水庭" data-pond-habitat data-pond-overflow="visible">
      <div className="pond-stage-heading">
        <span data-pond-avoid>弐 / 水庭</span>
        <span data-pond-avoid>
          {!enabled ? "静水" : paused ? "鱼群小憩" : "锦鲤漫游"}{" "}
          <i className="stage-dot" />
        </span>
      </div>
      <div className="pond-basin">
        <svg
          className="pond-shore"
          viewBox="0 0 700 530"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <path
              id={rim}
              d="M110 86 C210 4 530 18 613 140 C702 267 603 446 458 487 C283 543 72 448 51 310 C25 205 46 145 110 86Z"
            />
          </defs>
          <path
            className="shore-outer"
            d="M104 65 C231 -3 551 -9 640 141 C728 304 607 473 457 507 C258 562 48 461 32 307 C17 176 44 115 104 65Z"
          />
          <text className="shore-glyphs">
            <textPath href={"#" + rim} textLength="1790" lengthAdjust="spacing">
              {". : · ".repeat(85)}
            </textPath>
          </text>
          <path
            className="shore-inner"
            d="M120 108 C232 36 513 42 584 153 C660 271 576 421 446 460 C283 507 102 419 81 302 C61 208 70 155 120 108Z"
          />
          <path
            className="water-contour"
            d="M152 163 C265 100 493 115 536 215 M143 358 C225 421 413 452 523 359 M192 384 C279 428 407 424 476 389"
          />
          <g className="shore-stones">
            <path data-pond-collider d="M72 129l19-17 30 5 10 19-29 16-25-5Z" />
            <path data-pond-collider d="M45 167l12-19 22 3 7 18-19 10Z" />
            <path data-pond-collider d="M550 435l28-14 23 8-4 19-36 10Z" />
          </g>
        </svg>
        <span className="pond-poem" data-pond-avoid>
          <span>一池</span>
          <span>闲意</span>
          <small>
            POND
            <br />
            NO. 01
          </small>
        </span>
        <pre className="pond-reeds reeds-top" aria-hidden="true">
          {"  /|  /\n / | / /\n~:~:~:~"}
        </pre>
        <pre className="pond-reeds reeds-bottom" aria-hidden="true">
          {"  \u2571  |\n \u2571| /|\n~:~:~:~"}
        </pre>
        <span className="water-cross cross-one" aria-hidden="true">
          +
        </span>
        <span className="water-cross cross-two" aria-hidden="true">
          +
        </span>
      </div>
      <div className="pond-flow" data-pond-ignore>
        <div className="flow-title" data-pond-avoid>
          <span>水流读数</span>
          <small>LIVE TRAFFIC</small>
        </div>
        <div className="flow-reading">
          <span data-pond-avoid>↓ 入流 / 下载</span>
          <strong data-pond-avoid>{rate(rx)}</strong>
          <span className="flow-wave" aria-hidden="true">
            · ∿∿ ∿∿∿ · ∿∿ ·
          </span>
        </div>
        <div className="flow-reading">
          <span data-pond-avoid>↑ 出流 / 上传</span>
          <strong data-pond-avoid>{rate(tx)}</strong>
          <span className="flow-wave" aria-hidden="true">
            · ∿ ∿∿ · ∿∿ ∿ ·
          </span>
        </div>
      </div>
      <div className="pond-stage-foot">
        <span data-pond-avoid>游鱼自有去处，节点各有回声。</span>
        <span data-pond-avoid>{enabled&&!paused&&feeding?'点水 · 投喂 ↘':'静看 · 水面如常'}</span>
      </div>
    </section>
  );
}
