import "server-only";
import { promises as dns } from "node:dns";
import type { CollectorResult, DnsResult } from "@/lib/types";

async function resolveOne(host: string): Promise<DnsResult> {
  try {
    const records = await dns.lookup(host, { all: true, verbatim: true });
    const addresses = records.map((r) => r.address);
    return { host, ok: addresses.length > 0, addresses };
  } catch {
    return { host, ok: false, addresses: [] };
  }
}

export async function collectDns(
  hosts: readonly string[],
): Promise<CollectorResult<DnsResult[]>> {
  const collectedAt = new Date().toISOString();
  const results = await Promise.all(hosts.map((h) => resolveOne(h)));
  return { ok: true, value: results, collectedAt };
}
