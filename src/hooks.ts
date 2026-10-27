import { useEffect, useState } from "react";
export function useMedia(query: string) {
  const [matches, set] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query),
      sync = () => set(m.matches);
    sync();
    m.addEventListener("change", sync);
    return () => m.removeEventListener("change", sync);
  }, [query]);
  return matches;
}
export function useHidden() {
  const [hidden, set] = useState(document.hidden);
  useEffect(() => {
    const sync = () => set(document.hidden);
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return hidden;
}
