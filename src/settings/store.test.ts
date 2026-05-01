import { describe, expect, test } from "bun:test";
import path from "node:path";
import os from "node:os";
import { mkdir, writeFile } from "node:fs/promises";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "../types.ts";
import { loadSettings, normalizeSettings, saveSettings } from "./store.ts";

function makeTmpRoot(): string {
  return path.join(os.tmpdir(), `settings-store-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

describe("normalizeSettings", () => {
  test("fills missing or invalid values from defaults", () => {
    expect(normalizeSettings({ defaultRaidTier: "bad", defaultTab: "bis", preferImportedSets: "yes" }))
      .toEqual({ ...DEFAULT_APP_SETTINGS, defaultTab: "bis" });
  });
});

describe("loadSettings / saveSettings", () => {
  test("missing file returns defaults", async () => {
    expect(await loadSettings(makeTmpRoot())).toEqual(DEFAULT_APP_SETTINGS);
  });

  test("round-trips persisted settings", async () => {
    const tmpRoot = makeTmpRoot();
    const settings: AppSettings = {
      defaultTab: "acquisition",
    };
    await saveSettings(tmpRoot, settings);
    expect(await loadSettings(tmpRoot)).toEqual(settings);
  });

  test("corrupt JSON returns defaults", async () => {
    const tmpRoot = makeTmpRoot();
    const dir = path.join(tmpRoot, "data");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "settings.json"), "nope", "utf-8");
    expect(await loadSettings(tmpRoot)).toEqual(DEFAULT_APP_SETTINGS);
  });
});
