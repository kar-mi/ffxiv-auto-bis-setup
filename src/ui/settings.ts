import { signal } from "@preact/signals";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "../types.ts";
import { API_BASE } from "./constants.ts";
import { logger } from "./dom.ts";

export const appSettings = signal<AppSettings>({ ...DEFAULT_APP_SETTINGS });

export async function loadSettings(): Promise<AppSettings> {
  try {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const settings = await res.json() as AppSettings;
    appSettings.value = settings;
    return settings;
  } catch (err) {
    logger.warn(err, "[settings] could not load settings");
    appSettings.value = { ...DEFAULT_APP_SETTINGS };
    return appSettings.value;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const res = await fetch(`${API_BASE}/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(err?.error ?? `HTTP ${res.status}`);
  }
  appSettings.value = await res.json() as AppSettings;
}
