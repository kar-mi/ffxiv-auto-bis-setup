import { describe, expect, test } from "bun:test";
import { compareGear } from "./comparison.ts";
import type { GearSnapshot, BisGearSet } from "../types.ts";

function makeSnapshot(items: GearSnapshot["items"] = {}): GearSnapshot {
  return { capturedAt: "2026-01-01T00:00:00.000Z", items };
}

function makeBis(items: BisGearSet["items"] = {}): BisGearSet {
  return { name: "Test", job: "WAR", source: "https://xivgear.app/", items };
}

describe("compareGear", () => {
  test("empty BIS + empty snapshot — all bis-empty", () => {
    const result = compareGear(makeSnapshot(), makeBis());
    expect(result.matchCount).toBe(0);
    expect(result.wrongItemCount).toBe(0);
    expect(result.wrongMateriaCount).toBe(0);
    expect(result.missingCount).toBe(0);
    expect(result.slots.every(s => s.status === "bis-empty")).toBe(true);
  });

  test("single-slot match", () => {
    const result = compareGear(
      makeSnapshot({ mainHand: { itemId: 100, hq: false, materias: [1, 2], materiaSlots: 2, canOvermeld: false } }),
      makeBis({ mainHand: { itemId: 100, materias: [1, 2] } }),
    );
    const slot = result.slots.find(s => s.slot === "mainHand")!;
    expect(slot.status).toBe("match");
    expect(result.matchCount).toBe(1);
  });

  test("single-slot mismatch — wrong item", () => {
    const result = compareGear(
      makeSnapshot({ mainHand: { itemId: 99, hq: false, materias: [], materiaSlots: 2, canOvermeld: false } }),
      makeBis({ mainHand: { itemId: 100, materias: [] } }),
    );
    const slot = result.slots.find(s => s.slot === "mainHand")!;
    expect(slot.status).toBe("wrong-item");
    expect(result.wrongItemCount).toBe(1);
  });

  test("single-slot mismatch — wrong materia", () => {
    const result = compareGear(
      makeSnapshot({ mainHand: { itemId: 100, hq: false, materias: [1, 3], materiaSlots: 2, canOvermeld: false } }),
      makeBis({ mainHand: { itemId: 100, materias: [1, 2] } }),
    );
    const slot = result.slots.find(s => s.slot === "mainHand")!;
    expect(slot.status).toBe("wrong-materia");
    expect(result.wrongMateriaCount).toBe(1);
  });
});
