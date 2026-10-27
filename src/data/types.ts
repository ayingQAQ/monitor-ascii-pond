import type { History } from "./api";
import type { NodeData } from "../domain/nodes";
import type { Settings } from "../config/settings";
import type { Connection } from "./live";
export type Site = {
  site_name: string;
  authed: boolean;
  public_page: boolean;
  history_days?: number;
};
export type Snapshot = {
  nodes: NodeData[] | null;
  state: Connection;
  error: string;
  closed: boolean;
};
export type Source = {
  demo: boolean;
  loadSite: (signal?: AbortSignal) => Promise<Site>;
  loadConfig: (signal?: AbortSignal) => Promise<Settings>;
  subscribe: (notify: (value: Snapshot) => void) => () => void;
  history: (
    id: number,
    hours: number,
    points: number,
    series: "metrics" | "ping",
    signal: AbortSignal,
  ) => Promise<History>;
};
