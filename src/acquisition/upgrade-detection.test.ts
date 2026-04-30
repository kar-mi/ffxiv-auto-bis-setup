import { describe, expect, test } from "bun:test";
import { getBaseItemId, confirmUpgradeMatch, buildUpgradeBisIds } from "./upgrade-detection.ts";
import type { GearNeeds, BisGearSet } from "../types.ts";
import type { GearAcquisitionMap } from "./types.ts";

const baseMap: GearAcquisitionMap = {
  label: "Test",
  tomeId: 10,
  tomeName: "Test Tome",
  upgradeOffset: 1000,
  baseILevel: 780,
  upgradeILevel: 790,
  books: [],
  upgradeMaterials: [],
  slots: {},
};

const baseBis: BisGearSet = {
  name: "Test BIS",
  job: "WAR",
  source: "https://xivgear.app/",
  items: {},
};

describe("getBaseItemId", () => {
  test("happy path", () => {
    expect(getBaseItemId(2000, 1000)).toBe(1000);
  });

  test("returns 0 when offset equals itemId", () => {
    expect(getBaseItemId(1000, 1000)).toBe(0);
  });

  test("returns negative when offset exceeds itemId", () => {
    expect(getBaseItemId(500, 1000)).toBe(-500);
  });
});

describe("confirmUpgradeMatch", () => {
  test("returns true when itemLevel matches", async () => {
    const lookup = async (_id: number) => ({ itemLevel: 780 });
    expect(await confirmUpgradeMatch(100, 780, lookup)).toBe(true);
  });

  test("returns false when itemLevel mismatches", async () => {
    const lookup = async (_id: number) => ({ itemLevel: 790 });
    expect(await confirmUpgradeMatch(100, 780, lookup)).toBe(false);
  });

  test("returns false when lookup throws", async () => {
    const lookup = async (_id: number): Promise<{ itemLevel: number }> => {
      throw new Error("network error");
    };
    expect(await confirmUpgradeMatch(100, 780, lookup)).toBe(false);
  });
});

describe("buildUpgradeBisIds", () => {
  const makeNeeds = (bisItemId: number, slot: "mainHand" | "head" = "mainHand"): GearNeeds => ({
    itemNeeds: [{ slot, reason: "wrong-item", bisItemId, quantityInBags: 0 }],
    materiaChanges: [],
  });

  test("fast path: bisItem.itemLevel === upgradeILevel → included", async () => {
    const needs = makeNeeds(1790);
    const bis: BisGearSet = {
      ...baseBis,
      items: { mainHand: { itemId: 1790, materias: [], itemLevel: 790 } },
    };
    const result = await buildUpgradeBisIds(needs, bis, baseMap);
    expect(result.has(1790)).toBe(true);
  });

  test("fast path: bisItem.itemLevel !== upgradeILevel → excluded", async () => {
    const needs = makeNeeds(1001);
    const bis: BisGearSet = {
      ...baseBis,
      items: { mainHand: { itemId: 1001, materias: [], itemLevel: 780 } },
    };
    const result = await buildUpgradeBisIds(needs, bis, baseMap);
    expect(result.has(1001)).toBe(false);
  });

  test("slow path: lookup confirms match → included", async () => {
    const needs = makeNeeds(1780);
    const bis: BisGearSet = {
      ...baseBis,
      items: { mainHand: { itemId: 1780, materias: [] } }, // no itemLevel
    };
    const lookup = async (_id: number) => ({ itemLevel: 780 });
    const result = await buildUpgradeBisIds(needs, bis, baseMap, lookup);
    expect(result.has(1780)).toBe(true);
  });

  test("slow path: lookup confirms no match → excluded", async () => {
    const needs = makeNeeds(1780);
    const bis: BisGearSet = {
      ...baseBis,
      items: { mainHand: { itemId: 1780, materias: [] } },
    };
    const lookup = async (_id: number) => ({ itemLevel: 700 });
    const result = await buildUpgradeBisIds(needs, bis, baseMap, lookup);
    expect(result.has(1780)).toBe(false);
  });

  test("mixed needs: only upgrade-path slots included", async () => {
    const needs: GearNeeds = {
      itemNeeds: [
        { slot: "mainHand", reason: "wrong-item", bisItemId: 1790, quantityInBags: 0 },
        { slot: "head",     reason: "wrong-item", bisItemId: 200,  quantityInBags: 0 },
      ],
      materiaChanges: [],
    };
    const bis: BisGearSet = {
      ...baseBis,
      items: {
        mainHand: { itemId: 1790, materias: [], itemLevel: 790 },
        head:     { itemId: 200,  materias: [], itemLevel: 750 },
      },
    };
    const result = await buildUpgradeBisIds(needs, bis, baseMap);
    expect(result.has(1790)).toBe(true);
    expect(result.has(200)).toBe(false);
  });

  test("bisItemId <= upgradeOffset → baseId <= 0, slow path skipped", async () => {
    const needs = makeNeeds(500); // baseId = 500 - 1000 = -500
    const bis: BisGearSet = {
      ...baseBis,
      items: { mainHand: { itemId: 500, materias: [] } },
    };
    const lookup = async (_id: number) => ({ itemLevel: 780 });
    const result = await buildUpgradeBisIds(needs, bis, baseMap, lookup);
    expect(result.has(500)).toBe(false);
  });
});
