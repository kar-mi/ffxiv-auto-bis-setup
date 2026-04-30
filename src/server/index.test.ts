import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { startServer } from "./index.ts";
import { mkdir, writeFile, rm } from "node:fs/promises";
import os from "os";
import path from "path";

const PORT = 59873;
const tmpPublic = path.join(os.tmpdir(), `ffxiv-test-public-${process.pid}`);
let server: Awaited<ReturnType<typeof startServer>>;

beforeAll(async () => {
  await mkdir(tmpPublic, { recursive: true });
  await writeFile(path.join(tmpPublic, "index.html"), "<html>test</html>");
  server = await startServer(PORT, tmpPublic);
});

afterAll(async () => {
  server.stop();
  await rm(tmpPublic, { recursive: true, force: true });
});

describe("serveStatic", () => {
  test("GET / serves index.html", async () => {
    const res = await fetch(`http://localhost:${PORT}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("<html>test</html>");
  });

  test("GET /index.html serves index.html", async () => {
    const res = await fetch(`http://localhost:${PORT}/index.html`);
    expect(res.status).toBe(200);
  });

  test("GET /nonexistent returns 404", async () => {
    const res = await fetch(`http://localhost:${PORT}/nonexistent.txt`);
    expect(res.status).toBe(404);
  });

  test("path traversal via encoded separator is blocked", async () => {
    const res = await fetch(`http://localhost:${PORT}/%2F..%2Fpackage.json`);
    expect(res.status).toBe(404);
  });
});
