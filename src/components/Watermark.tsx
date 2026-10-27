/** Three glyph contours: CPU, memory and disk occupancy, from the inside out. */
export function Watermark({
  values,
  id,
}: {
  values: (number | null)[];
  id: number;
}) {
  const width = 19,
    height = 9;
  const rows = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      const dx = (x - 9) / 9,
        dy = (y - 4) / 4,
        d = Math.sqrt(dx * dx + dy * dy);
      const ring =
        Math.abs(d - 0.33) < 0.15
          ? 0
          : Math.abs(d - 0.65) < 0.12
            ? 1
            : Math.abs(d - 0.95) < 0.1
              ? 2
              : -1;
      if (ring < 0) return " ";
      const v = values[ring];
      if (v === null) return "·";
      const phase =
        ((Math.atan2(dy, dx) + Math.PI * 2 + id * 0.4) % (Math.PI * 2)) /
        (Math.PI * 2);
      return phase < v / 100 ? "≈" : ring === 0 ? "·" : ring === 1 ? "∙" : ".";
    }).join(""),
  ).join("\n");
  return (
    <pre className="node-watermark" aria-hidden="true">
      {rows}
    </pre>
  );
}
