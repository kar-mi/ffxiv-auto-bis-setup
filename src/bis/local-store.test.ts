import { describe, expect, test } from "bun:test";
import path from "node:path";
import os from "node:os";
import { writeFile, mkdir } from "node:fs/promises";
import {
  makeEntryId, canonicalUrl,
  upsertSet, removeSet, setPreference, clearPreference,
  loadCatalog, saveCatalog,
} from "./local-store.ts";
import type { BisCatalog, LocalBisEntry } from "../types.ts";

function makeTmpRoot(): string {
  return path.join(os.tmpdir(), `local-store-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

function makeEntry(id: string): LocalBisEntry {
  return {
    id,
    url: `https://xivgear.app/?page=bis%7Cwar%7Ccurrent&selectedIndex=0`,
    setIndex: 0,
    savedAt: "2026-01-01T00:00:00.000Z",
    set: { name: "Test", job: "WAR", source: "https://xivgear.app/", items: {} },
    raidTier: "aac_hw",
  };
}

describe("makeEntryId", () => {
  test("derives slug from page param + setIndex", () => {
    expect(makeEntryId("https://xivgear.app/?page=bis|war|current", 0))
      .toBe("bis_war_current_0");
  });

  test("normalizes hash-style URL first", () => {
    expect(makeEntryId("https://xivgear.app/#/bis/war/current", 1))
      .toBe("bis_war_current_1");
  });
});

describe("canonicalUrl", () => {
  test("bakes selectedIndex into the URL", () => {
    const result = canonicalUrl("https://xivgear.app/?page=bis|war|current", 0);
    expect(result).toContain("selectedIndex=0");
  });
});

describe("upsertSet", () => {
  test("inserts into empty catalog", () => {
    const catalog: BisCatalog = { sets: [], preferences: {} };
    const updated = upsertSet(catalog, makeEntry("a"));
    expect(updated.sets).toHaveLength(1);
    expect(updated.sets[0]!.id).toBe("a");
  });

  test("replaces existing entry with same id", () => {
    const catalog: BisCatalog = { sets: [makeEntry("a")], preferences: {} };
    const replaced: LocalBisEntry = { ...makeEntry("a"), setIndex: 1 };
    const updated = upsertSet(catalog, replaced);
    expect(updated.sets).toHaveLength(1);
    expect(updated.sets[0]!.setIndex).toBe(1);
  });
});

describe("removeSet", () => {
  test("removes set and clears matching preferences", () => {
    const catalog: BisCatalog = {
      sets: [makeEntry("a"), makeEntry("b")],
      preferences: { WAR: "a", DRK: "b" },
    };
    const updated = removeSet(catalog, "a");
    expect(updated.sets.map(s => s.id)).toEqual(["b"]);
    expect(updated.preferences["WAR"]).toBeUndefined();
    expect(updated.preferences["DRK"]).toBe("b");
  });
});

describe("setPreference / clearPreference", () => {
  test("setPreference stores uppercase job key", () => {
    const catalog: BisCatalog = { sets: [], preferences: {} };
    const updated = setPreference(catalog, "war", "bis_war_current_0");
    expect(updated.preferences["WAR"]).toBe("bis_war_current_0");
  });

  test("clearPreference removes the key", () => {
    const catalog: BisCatalog = { sets: [], preferences: { WAR: "bis_war_current_0" } };
    const updated = clearPreference(catalog, "WAR");
    expect(updated.preferences["WAR"]).toBeUndefined();
  });
});

describe("loadCatalog / saveCatalog — filesystem", () => {
  test("round-trip: save then load returns identical structure", async () => {
    const tmpRoot = makeTmpRoot();
    const catalog: BisCatalog = {
      sets: [makeEntry("a")],
      preferences: { WAR: "a" },
    };
    await saveCatalog(tmpRoot, catalog);
    const loaded = await loadCatalog(tmpRoot);
    expect(loaded).toEqual(catalog);
  });

  test("missing file → returns empty catalog", async () => {
    const loaded = await loadCatalog(makeTmpRoot());
    expect(loaded).toEqual({ sets: [], preferences: {} });
  });

  test("corrupt JSON → returns empty catalog", async () => {
    const tmpRoot = makeTmpRoot();
    const dir = path.join(tmpRoot, "data", "bis");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "catalog.json"), "this is not json", "utf-8");
    const loaded = await loadCatalog(tmpRoot);
    expect(loaded).toEqual({ sets: [], preferences: {} });
  });
});
