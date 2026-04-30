import { describe, expect, test } from "bun:test";
import { computeAcquisition } from "./compute.ts";
import type { GearNeeds, GearSnapshot, InventorySnapshot } from "../types.ts";
import type { GearAcquisitionMap } from "./types.ts";

const baseMap: GearAcquisitionMap = {
  label: "Test",
  tomeId: 10,
  tomeName: "Test Tome",
  upgradeOffset: 1000,
  baseILevel: 780,
  upgradeILevel: 790,
  books: [
    { itemId: 20, name: "Test Book" },
  ],
  upgradeMaterials: [
    { key: "mat1", itemId: 30, name: "Test Material", bookIndex: 0, bookCount: 4 },
  ],
  slots: {
    mainHand: {
      cofferItemId: 100,
      bookIndex: 0,
      bookCount: 7,
      tomeCost: 500,
      upgradeMaterialKey: "mat1",
    },
  },
};

const raidNeeds: GearNeeds = {
  itemNeeds: [
    { slot: "mainHand", reason: "wrong-item", bisItemId: 1001, quantityInBags: 0 },
  ],
  materiaChanges: [],
};

function makeInventory(items: InventorySnapshot["items"]): InventorySnapshot {
  return { capturedAt: "2026-01-01T00:00:00.000Z", items };
}

describe("computeAcquisition — raid path", () => {
  test("coffer + book happy path", () => {
    const inv = makeInventory([
      { itemId: 100, quantity: 1, hq: false, containerId: 0, slot: 0 },
      { itemId: 20,  quantity: 7, hq: false, containerId: 0, slot: 1 },
    ]);
    const results = computeAcquisition(raidNeeds, baseMap, inv);
    const result = results[0]!;
    expect(result.coffer?.available).toBe(true);
    expect(result.books?.available).toBe(true);
    expect(result.canAcquireNow).toBe(true);
  });

  test("book index out of range → books is null", () => {
    const mapBadIndex: GearAcquisitionMap = {
      ...baseMap,
      slots: { mainHand: { ...baseMap.slots["mainHand"], bookIndex: 99 } },
    };
    const results = computeAcquisition(raidNeeds, mapBadIndex, null);
    expect(results[0]!.books).toBeNull();
  });
});

describe("computeAcquisition — upgrade path", () => {
  const bisItemId = 1790;
  const baseItemId = bisItemId - baseMap.upgradeOffset; // 790
  const upgradeNeeds: GearNeeds = {
    itemNeeds: [
      { slot: "mainHand", reason: "wrong-item", bisItemId, quantityInBags: 0 },
    ],
    materiaChanges: [],
  };
  const upgradeBisIds = new Set([bisItemId]);

  test("equipped base → haveBaseEquipped = true, haveBase = true", () => {
    const gear: GearSnapshot = {
      capturedAt: "2026-01-01T00:00:00.000Z",
      items: {
        mainHand: { itemId: baseItemId, hq: false, materias: [], materiaSlots: 0, canOvermeld: false },
      },
    };
    const result = computeAcquisition(upgradeNeeds, baseMap, null, upgradeBisIds, gear)[0]!;
    expect(result.upgrade?.base.haveBaseEquipped).toBe(true);
    expect(result.upgrade?.base.haveBase).toBe(true);
  });

  test("base in bags → haveBase = true, haveBaseEquipped = false", () => {
    const inv = makeInventory([
      { itemId: baseItemId, quantity: 1, hq: false, containerId: 0, slot: 0 },
    ]);
    const result = computeAcquisition(upgradeNeeds, baseMap, inv, upgradeBisIds, null)[0]!;
    expect(result.upgrade?.base.haveBase).toBe(true);
    expect(result.upgrade?.base.haveBaseEquipped).toBe(false);
  });

  test("base missing → haveBase = false", () => {
    const result = computeAcquisition(upgradeNeeds, baseMap, null, upgradeBisIds, null)[0]!;
    expect(result.upgrade?.base.haveBase).toBe(false);
  });

  test("upgrade material key not found → fallback 'Unknown upgrade material'", () => {
    const mapNoMat: GearAcquisitionMap = {
      ...baseMap,
      slots: { mainHand: { ...baseMap.slots["mainHand"], upgradeMaterialKey: "nonexistent" } },
    };
    const result = computeAcquisition(upgradeNeeds, mapNoMat, null, upgradeBisIds, null)[0]!;
    expect(result.upgrade?.material.material.name).toBe("Unknown upgrade material");
  });

  test("gear === null → haveBaseEquipped = false", () => {
    const result = computeAcquisition(upgradeNeeds, baseMap, null, upgradeBisIds, null)[0]!;
    expect(result.upgrade?.base.haveBaseEquipped).toBe(false);
  });
});

describe("computeAcquisition — canAcquireNow", () => {
  test("coffer available → true", () => {
    const inv = makeInventory([
      { itemId: 100, quantity: 1, hq: false, containerId: 0, slot: 0 },
    ]);
    expect(computeAcquisition(raidNeeds, baseMap, inv)[0]!.canAcquireNow).toBe(true);
  });

  test("upgrade path complete (base + material) → true", () => {
    const bisItemId = 1790;
    const baseItemId = bisItemId - baseMap.upgradeOffset;
    const upgradeNeeds: GearNeeds = {
      itemNeeds: [{ slot: "mainHand", reason: "wrong-item", bisItemId, quantityInBags: 0 }],
      materiaChanges: [],
    };
    const inv = makeInventory([
      { itemId: baseItemId, quantity: 1, hq: false, containerId: 0, slot: 0 },
      { itemId: 30,         quantity: 1, hq: false, containerId: 0, slot: 1 },
    ]);
    const result = computeAcquisition(upgradeNeeds, baseMap, inv, new Set([bisItemId]), null)[0]!;
    expect(result.upgrade?.available).toBe(true);
    expect(result.canAcquireNow).toBe(true);
  });

  test("all paths unavailable → false", () => {
    const bisItemId = 1790;
    const upgradeNeeds: GearNeeds = {
      itemNeeds: [{ slot: "mainHand", reason: "wrong-item", bisItemId, quantityInBags: 0 }],
      materiaChanges: [],
    };
    const result = computeAcquisition(upgradeNeeds, baseMap, null, new Set([bisItemId]), null)[0]!;
    expect(result.canAcquireNow).toBe(false);
  });
});
