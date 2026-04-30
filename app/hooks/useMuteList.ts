"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";

export type MuteCategory =
  | "interfaces"
  | "services"
  | "diskMounts"
  | "smartDevices"
  | "pingTargets"
  | "dnsHosts";

export type MuteList = Record<MuteCategory, string[]>;

const STORAGE_KEY = "pcinfo:mute-list:v1";
const SAME_TAB_EVENT = "pcinfo:mute-list:changed";

const empty: MuteList = {
  interfaces: [],
  services: [],
  diskMounts: [],
  smartDevices: [],
  pingTargets: [],
  dnsHosts: [],
};

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const onChange = () => cb();
  window.addEventListener("storage", onChange);
  window.addEventListener(SAME_TAB_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SAME_TAB_EVENT, onChange);
  };
}

function getClientSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

function getServerSnapshot(): string | null {
  return null;
}

function parse(raw: string | null): MuteList {
  if (!raw) return empty;
  try {
    return { ...empty, ...(JSON.parse(raw) as Partial<MuteList>) };
  } catch {
    return empty;
  }
}

export function useMuteList() {
  const raw = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const muteList = useMemo(() => parse(raw), [raw]);

  const toggleMute = useCallback((cat: MuteCategory, key: string) => {
    if (typeof window === "undefined") return;
    const current = parse(window.localStorage.getItem(STORAGE_KEY));
    const arr = current[cat];
    const next: MuteList = {
      ...current,
      [cat]: arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key],
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      return;
    }
    window.dispatchEvent(new Event(SAME_TAB_EVENT));
  }, []);

  const clearAll = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      return;
    }
    window.dispatchEvent(new Event(SAME_TAB_EVENT));
  }, []);

  return { muteList, toggleMute, clearAll };
}
