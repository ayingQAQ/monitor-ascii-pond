import manifest from "../../theme.json";
export type Mode = "auto" | "light" | "dark";
export type Settings = {
  notice: string;
  color_mode: Mode;
  pond_enabled: boolean;
  feeding_enabled: boolean;
  show_expiry: boolean;
};
export function parseConfig(saved: unknown): Settings {
  const values =
    saved && typeof saved === "object" && !Array.isArray(saved)
      ? (saved as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    manifest.config.map((f) => {
      const v = values[f.key];
      const valid =
        f.type === "select"
          ? f.options?.some((o) => o.value === v)
          : typeof v === typeof f.default;
      return [f.key, valid ? v : f.default];
    }),
  ) as Settings;
}
export const defaults = parseConfig({});
export function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(`monitor-pond:${key}`);
  } catch {
    return null;
  }
}
export function savePreference(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(`monitor-pond:${key}`);
    else localStorage.setItem(`monitor-pond:${key}`, value);
  } catch {
    /* in-memory state still works */
  }
}
