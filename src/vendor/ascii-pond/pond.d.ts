export type PondInstance = {
  canvas: HTMLCanvasElement;
  readonly paused: boolean;
  pause(): void;
  resume(): void;
  destroy(): void;
  measure(): void;
  feed(x: number, y: number): void;
  setFeeding(enabled: boolean): void;
  setTheme(light: boolean, at?: { x: number; y: number }): void;
};
export function mount(
  canvas: HTMLCanvasElement,
  options?: {
    species?: { type: string; count: number; young: number }[];
    theme?: string;
    paused?: boolean;
    feed?: boolean;
    maxFps?: number;
    maxDpr?: number;
    contentRoot?: Element | Document;
  },
): PondInstance;
