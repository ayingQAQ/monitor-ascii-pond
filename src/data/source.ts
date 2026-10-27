import manifest from "../../theme.json";
import { parseConfig } from "../config/settings";
import { normalizeNodes, record, finite } from "../domain/nodes";
import { api, ApiError, parseHistory } from "./api";
import { createLiveClient } from "./live";
import type { Source, Snapshot } from "./types";
export const source: Source = {
  demo: false,
  async loadSite(signal) {
    const data = await api<unknown>("/me", { signal });
    if (
      !record(data) ||
      typeof data.public_page !== "boolean" ||
      typeof data.authed !== "boolean"
    )
      throw new ApiError(200, "站点数据格式异常");
    return {
      site_name:
        typeof data.site_name === "string" ? data.site_name : "锦鲤池塘",
      authed: data.authed,
      public_page: data.public_page,
      history_days: finite(data.history_days) ? data.history_days : 7,
    };
  },
  async loadConfig(signal) {
    try {
      return parseConfig(
        await api(`/themes/${manifest.short}/config`, { signal }),
      );
    } catch {
      return parseConfig({});
    }
  },
  subscribe(notify) {
    let current: Snapshot = {
      nodes: null,
      state: "connecting",
      error: "",
      closed: false,
    };
    const client = createLiveClient({
      url: `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/ws${typeof DecompressionStream === "function" ? "?gzip" : ""}`,
      fetchNodes: async (signal) => {
        const d = await api<unknown>("/nodes", { signal });
        if (!record(d) || !Array.isArray(d.nodes))
          throw new ApiError(200, "节点数据格式异常");
        return d.nodes;
      },
      onNodes: (nodes) => {
        current = {
          ...current,
          nodes: normalizeNodes(nodes),
          error: "",
          closed: false,
        };
        notify(current);
      },
      onState: (state, error = "", closed = false) => {
        current = { ...current, state, error, closed };
        notify(current);
      },
    });
    const visibility = () => {
      if (document.hidden) {
        client.stop();
        current = { ...current, state: "paused" };
        notify(current);
      } else client.start();
    };
    document.addEventListener("visibilitychange", visibility);
    visibility();
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      client.stop();
    };
  },
  async history(id, hours, points, series, signal) {
    return parseHistory(
      await api(
        `/nodes/${id}/metrics?hours=${hours}&points=${Math.max(60, Math.min(1440, Math.round(points)))}&series=${series}`,
        { signal },
      ),
    );
  },
};
