"use client";
import { useEffect, useState } from "react";

export interface PollState<T> {
  data: T | null;
  error: string | null;
  fails: number;
  lastFetchedAt: number | null;
}

// url が null の間は fetch しない（タブ切替で不要な API を停止する用途）。
// データは保持したまま — 切替後の stale レンダリングは呼び出し側で gating する。
export function usePolling<T>(url: string | null, intervalMs: number): PollState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fails, setFails] = useState(0);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);

  useEffect(() => {
    if (url === null) return;
    let alive = true;
    let abort: AbortController | null = null;
    const tick = async () => {
      abort?.abort();
      abort = new AbortController();
      try {
        const res = await fetch(url, { signal: abort.signal, cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as T;
        if (!alive) return;
        setData(json);
        setError(null);
        setLastFetchedAt(Date.now());
        setFails(0);
      } catch (e) {
        if (!alive) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setFails((n) => n + 1);
        setError(e instanceof Error ? e.message : String(e));
      }
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      abort?.abort();
      clearInterval(id);
    };
  }, [url, intervalMs]);

  return { data, error, fails, lastFetchedAt };
}
