import { describe, expect, test } from "bun:test";
import { WAITING_FOR_NETWORK_MS, withPcapWarning } from "./status.ts";
import type { PcapStatus } from "./status.ts";

describe("withPcapWarning", () => {
  test("warns when the game was not running at capture startup", () => {
    const status: PcapStatus = {
      phase: "game-not-running",
      updatedAt: "2026-05-01T00:00:00.000Z",
    };

    expect(withPcapWarning(status).warning).toBe("game-not-running");
  });

  test("warns when capture starts but no network data arrives", () => {
    const startedAt = Date.parse("2026-05-01T00:00:00.000Z");
    const status: PcapStatus = {
      phase: "capturing",
      startedAt: new Date(startedAt).toISOString(),
      updatedAt: new Date(startedAt).toISOString(),
    };

    expect(withPcapWarning(status, startedAt + WAITING_FOR_NETWORK_MS).warning).toBe("waiting-for-network");
  });

  test("does not warn once network data has arrived", () => {
    const startedAt = Date.parse("2026-05-01T00:00:00.000Z");
    const status: PcapStatus = {
      phase: "capturing",
      startedAt: new Date(startedAt).toISOString(),
      lastNetworkAt: new Date(startedAt + 1000).toISOString(),
      updatedAt: new Date(startedAt + 1000).toISOString(),
    };

    expect(withPcapWarning(status, startedAt + WAITING_FOR_NETWORK_MS).warning).toBeUndefined();
  });
});
