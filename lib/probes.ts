import "server-only";
import net from "node:net";
import type { Probe, ProbeResult } from "@/lib/types";

async function runHttp(p: Extract<Probe, { type: "http" }>): Promise<ProbeResult> {
  const start = Date.now();
  const timeoutMs = p.timeoutMs ?? 3000;
  const expect = p.expectStatus;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // redirect:"manual" にすることで、サービス本体の応答のみを判定対象にする。
    // probe の目的は「サーバが返答するか」であり、リダイレクト先まで追う必要はない。
    const res = await fetch(p.url, {
      signal: ctrl.signal,
      cache: "no-store",
      redirect: "manual",
    });
    const latency = Date.now() - start;
    // expectStatus 指定なしの場合: 5xx 未満ならサーバが応答しているとみなす（200/3xx/4xx すべて ok）
    const okStatus =
      expect !== undefined
        ? res.status === expect
        : res.status > 0 && res.status < 500;
    if (okStatus) {
      return {
        name: p.name,
        type: "http",
        ok: true,
        latencyMs: latency,
        detail: `HTTP ${res.status} (${p.url})`,
      };
    }
    return {
      name: p.name,
      type: "http",
      ok: false,
      latencyMs: latency,
      detail: `HTTP ${res.status} (期待: ${expect ?? "<500"})`,
      error: `unexpected status ${res.status}`,
    };
  } catch (e) {
    const latency = Date.now() - start;
    const aborted = e instanceof DOMException && e.name === "AbortError";
    return {
      name: p.name,
      type: "http",
      ok: false,
      latencyMs: aborted ? timeoutMs : latency,
      detail: aborted ? `タイムアウト (${timeoutMs}ms)` : "接続失敗",
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(t);
  }
}

function runTcp(p: Extract<Probe, { type: "tcp" }>): Promise<ProbeResult> {
  const timeoutMs = p.timeoutMs ?? 2000;
  return new Promise<ProbeResult>((resolve) => {
    const start = Date.now();
    const sock = net.createConnection({ host: p.host, port: p.port });
    let settled = false;
    const settle = (r: ProbeResult) => {
      if (settled) return;
      settled = true;
      sock.destroy();
      resolve(r);
    };
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => {
      settle({
        name: p.name,
        type: "tcp",
        ok: true,
        latencyMs: Date.now() - start,
        detail: `TCP 接続成功 (${p.host}:${p.port})`,
      });
    });
    sock.once("timeout", () => {
      settle({
        name: p.name,
        type: "tcp",
        ok: false,
        latencyMs: timeoutMs,
        detail: `タイムアウト (${timeoutMs}ms)`,
        error: "connect timeout",
      });
    });
    sock.once("error", (err) => {
      settle({
        name: p.name,
        type: "tcp",
        ok: false,
        latencyMs: Date.now() - start,
        detail: `接続失敗 (${p.host}:${p.port})`,
        error: err.message,
      });
    });
  });
}

export async function runProbes(probes: Probe[]): Promise<ProbeResult[]> {
  return Promise.all(
    probes.map((p) => (p.type === "http" ? runHttp(p) : runTcp(p))),
  );
}
