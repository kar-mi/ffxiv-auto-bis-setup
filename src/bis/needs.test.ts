import { describe, expect, test } from "bun:test";
import { computeNeeds } from "./needs.ts";
import type { GearsetComparison, BisGearSet, InventorySnapshot } from "../types.ts";

describe("computeNeeds", () => {
  test("multi-slot: itemNeeds + materiaChanges with toAdd and toRemove", () => {
    const comparison: GearsetComparison = {
      slots: [
        {
          slot: "mainHand",
          status: "wrong-item",
          equippedItemId: 999,
          bisItemId: 1001,
          equippedMaterias: [],
          bisMaterias: [],
        },
        {
          slot: "head",
          status: "wrong-materia",
          equippedItemId: 200,
          bisItemId: 200,
          equippedMaterias: [1, 3],
          bisMaterias: [1, 2],
        },
      ],
      matchCount: 0,
      wrongItemCount: 1,
      wrongMateriaCount: 1,
      missingCount: 0,
    };

    const bis: BisGearSet = {
      name: "Test",
      job: "WAR",
      source: "https://xivgear.app/",
      items: {
        mainHand: { itemId: 1001, materias: [] },
        head:     { itemId: 200,  materias: [1, 2] },
      },
    };

    const inventory: InventorySnapshot = {
      capturedAt: "2026-01-01T00:00:00.000Z",
      items: [
        { itemId: 1001, quantity: 1, hq: false, containerId: 0, slot: 0 },
        { itemId: 2,    quantity: 2, hq: false, containerId: 0, slot: 1 },
      ],
    };

    const result = computeNeeds(comparison, bis, inventory);

    expect(result.itemNeeds).toHaveLength(1);
    expect(result.itemNeeds[0]!.slot).toBe("mainHand");
    expect(result.itemNeeds[0]!.bisItemId).toBe(1001);
    expect(result.itemNeeds[0]!.quantityInBags).toBe(1);

    expect(result.materiaChanges).toHaveLength(1);
    const change = result.materiaChanges[0]!;
    expect(change.slot).toBe("head");
    expect(change.toAdd).toContain(2);
    expect(change.toRemove).toContain(3);
    expect(change.quantityInBags[2]).toBe(2);
  });
});
