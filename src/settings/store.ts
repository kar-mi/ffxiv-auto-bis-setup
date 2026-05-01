import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  APP_DEFAULT_TABS,
  DEFAULT_APP_SETTINGS,
  type AppDefaultTab,
  type AppSettings,
} from "../types.ts";
import { writeJsonAtomic } from "../util/atomic-write.ts";

function settingsPath(projectRoot: string): string {
  return path.join(projectRoot, "data", "settings.json");
}

export function isAppDefaultTab(value: unknown): value is AppDefaultTab {
  return typeof value === "string" && (APP_DEFAULT_TABS as readonly string[]).includes(value);
}

export function normalizeSettings(value: unknown): AppSettings {
  const raw = value && typeof value === "object" ? value as Partial<AppSettings> : {};
  return {
    defaultTab: isAppDefaultTab(raw.defaultTab)
      ? raw.defaultTab
      : DEFAULT_APP_SETTINGS.defaultTab,
  };
}

export async function loadSettings(projectRoot: string): Promise<AppSettings> {
  try {
    const raw = await readFile(settingsPath(projectRoot), "utf-8");
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

export async function saveSettings(projectRoot: string, settings: AppSettings): Promise<void> {
  await writeJsonAtomic(settingsPath(projectRoot), JSON.stringify(normalizeSettings(settings), null, 2) + "\n");
}
