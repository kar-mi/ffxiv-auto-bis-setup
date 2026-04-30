import { describe, expect, test } from "bun:test";
import path from "node:path";
import os from "node:os";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { writeJsonAtomic } from "./atomic-write.ts";

function tmpDir(): string {
  return path.join(os.tmpdir(), `atomic-write-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

describe("writeJsonAtomic", () => {
  test("writes the value as JSON", async () => {
    const dir = tmpDir();
    await mkdir(dir, { recursive: true });
    const target = path.join(dir, "out.json");
    try {
      await writeJsonAtomic(target, { hello: "world" });
      const raw = await readFile(target, "utf-8");
      expect(JSON.parse(raw)).toEqual({ hello: "world" });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("creates the parent directory if missing", async () => {
    const dir = tmpDir();
    const target = path.join(dir, "nested", "deeper", "out.json");
    try {
      await writeJsonAtomic(target, { ok: true });
      const raw = await readFile(target, "utf-8");
      expect(JSON.parse(raw)).toEqual({ ok: true });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("concurrent writes to the same path do not race on the tmp file", async () => {
    // Regression test: a fixed `.tmp` suffix made parallel writes fail with
    // ENOENT when one rename ran after another had already moved the tmp file.
    const dir = tmpDir();
    await mkdir(dir, { recursive: true });
    const target = path.join(dir, "out.json");
    try {
      const writes = Array.from({ length: 16 }, (_, i) =>
        writeJsonAtomic(target, { i }),
      );
      await Promise.all(writes);

      const raw = await readFile(target, "utf-8");
      const parsed = JSON.parse(raw) as { i: number };
      expect(typeof parsed.i).toBe("number");

      // No leftover .tmp files in the directory.
      const remaining = await readdir(dir);
      expect(remaining.filter(f => f.endsWith(".tmp"))).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("cleans up tmp file when serialization fails", async () => {
    const dir = tmpDir();
    await mkdir(dir, { recursive: true });
    const target = path.join(dir, "out.json");
    try {
      const circular: Record<string, unknown> = {};
      circular["self"] = circular;
      await expect(writeJsonAtomic(target, circular)).rejects.toThrow();

      const remaining = await readdir(dir);
      expect(remaining).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
