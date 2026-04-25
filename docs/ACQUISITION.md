# Gear Acquisition

How the gear acquisition system works and how it maps to the `gear-acquisition.json` data file for each raid tier.

TODO - add alternative methods of getting upgrade items through hunts

---

## The Two Gear Types

Every BIS slot will use one of two item variants. The BIS set (from xivgear.app) determines which one applies per slot — we never override it.

### Raid gear (ilvl 790)
- Drops from **savage raid** as a **coffer** (slot-specific item that opens to give the piece).
- Can also be purchased directly by trading **books** at the vendor — no coffer required.
- **Cannot be upgraded.** The raid piece is the final form.

### Upgraded tome gear (ilvl 790)
- Starts as **tome gear** (ilvl 780), purchased with **Allagan Tomestones of Aesthetics**.
- Upgraded to ilvl 790 by trading the 780 piece + one **upgrade material** at the vendor.
- The upgrade materials are obtained by trading **books** (separate exchange from buying raid gear).
- **Cannot be acquired from a coffer.** If the BIS item is the upgraded tome variant, coffers and direct book purchases don't apply.

---

## What Books Are Used For

Books (**AAC Illustrated: HW Edition 1–4**) have exactly two uses:

| Exchange | What you get |
|---|---|
| N books of Edition X | 1 raid piece for that slot |
| N books of Edition X | 1 upgrade material (Twine / Glaze / Solvent) |

Books are **not** used to buy tome gear — that's strictly a tomestone purchase.

---

## Upgrade Materials

Three materials are used to upgrade 780 tome gear to 790. Each applies to a specific category of slots:

| Material | Slots | Books needed |
|---|---|---|
| Thundersteeped Twine | Head, Chest, Gloves, Legs, Feet | 4 × Edition 4 |
| Thundersteeping Glaze | Earrings, Necklace, Bracelet, Ring | 3 × Edition 3 |
| Thundersteeped Solvent | Main Hand (weapon) | 4 × Edition 4 |

---

## Slot Notes

### Main Hand (weapon)
- The weapon can be acquired via coffer, book exchange (8 × Edition 4), or the tome+upgrade route.
- Whether a given BIS weapon is the raid variant or the upgraded tome variant is determined at runtime via XIVAPI (the same `upgradeOffset`/`baseILevel` check used for all other slots).
- Tome weapons require a specific **tomestone weapon item** for the purchase, and the upgrade material is the Solvent (not Twine or Glaze).

### Off Hand (shield — Paladin only)
- The shield cannot be purchased separately.
- It is acquired together with the main hand at no additional cost.
- The `offHand` slot in the JSON has no acquisition fields for this reason.

---

## Acquisition Logic (how the code uses this)

For each slot where the player's equipped item does not match BIS (`computeAcquisition` in `src/acquisition/compute.ts`):

1. **Identify the BIS item type** via XIVAPI iLevel check:
   - Subtract `upgradeOffset` from `bisItemId` → call XIVAPI for the resulting item ID.
   - If XIVAPI reports `itemLevel === baseILevel` (e.g. 780), the BIS item is an **upgraded tome piece** → show only the upgrade path.
   - Otherwise it's a **raid piece** → show coffer and book paths.

2. **Upgrade path** (tome piece slots):
   - Base item ID = `bisItemId - upgradeOffset` (the 780 tome piece)
   - Check bags/armory for the base item; if absent, check tomestone count vs `tomeCost`
   - Check bags for the upgrade material; if absent, check book count vs material's `bookCount`

3. **Raid path** (non-upgrade slots):
   - Check bags for the coffer item (`cofferItemId`)
   - Check bags for the book edition (`books[bookIndex]`) vs `bookCount`

4. **Cross-reference inventory** via `buildCounts()` which sums quantities across all tracked containers (bags + armory, containers 0–3 and 3200–3500).

5. `canAcquireNow` is true when at least one path is fully satisfiable from current inventory.

---

## JSON Schema Reference (`gear-acquisition.json`)

```jsonc
{
  "label": "human-readable tier name",
  "tomeId": 49,             // item ID of the tomestone currency
  "tomeName": "Allagan Tomestone of Aesthetics",
  "upgradeOffset": 77,      // subtracted from a BIS item ID to get the 780 base tome item ID
  "baseILevel": 780,        // expected iLevel of the base tome item (used to confirm upgrade path via XIVAPI)
  "books": [
    { "itemId": 49760, "name": "AAC Illustrated: HW Edition 1" },
    // index 0 = Edition 1, index 1 = Edition 2, ...
  ],
  "upgradeMaterials": [
    {
      "key": "twine",       // referenced by slots[*].upgradeMaterialKey
      "itemId": 49758,
      "name": "Thundersteeped Twine",
      "bookIndex": 2,       // 0-based index into books[]
      "bookCount": 4        // books needed to buy 1 of this material
    }
  ],
  "slots": {
    "head": {
      "cofferItemId": 49739,    // coffer item that opens to give this slot's raid piece
      "bookIndex": 1,           // which book edition buys this raid piece (0-based into books[])
      "bookCount": 4,           // how many books are needed
      "tomeCost": 495,          // tomestones to purchase the 780 base tome item
      "upgradeMaterialKey": "twine"  // key into upgradeMaterials[]
    },
    // offHand has no fields when it's bundled with mainHand (Paladin shield)
  }
}
```

**How upgrade vs. raid path is determined at runtime:**
The JSON does not label each slot as raid or upgrade. Instead, `computeAcquisition` subtracts `upgradeOffset` from the BIS item ID and queries XIVAPI. If the resulting item's `itemLevel` equals `baseILevel`, the slot is treated as an upgrade path; otherwise it's a raid path.

To add a new raid tier: create `raidinfo/<tier_key>/gear-acquisition.json` and set `"activeTier": "<tier_key>"` in `raidinfo/index.json`. The `loadGearAcquisitionMap` loader is cached per process — restart the server after switching tiers.

---

## Inventory Slot Order (`ITEMODR.DAT`)

The `slot` field in packet data is an **internal storage index**, not the visual position shown in the in-game bag UI. The display order is controlled by a local binary file written by the game client:

```
%Documents%\My Games\FINAL FANTASY XIV - A Realm Reborn\FFXIV_CHR<contentId_hex>\ITEMODR.DAT
```

### What the file contains

An ordered list of `{ slot, container }` pairs per inventory section. Array index = visual position in the UI. Sections appear in this order:

`Player`, `ArmoryMain`, `ArmoryHead`, `ArmoryBody`, `ArmoryHand`, `ArmoryWaist`, `ArmoryLegs`, `ArmoryFeet`, `ArmoryOff`, `ArmoryEar`, `ArmoryNeck`, `ArmoryWrist`, `ArmoryRing`, `ArmorySoulCrystal`, `SaddleBag`, `PremiumSaddlebag`

### Encoding

All fields are XOR-obfuscated:

| Width | XOR constant |
|---|---|
| 1 byte | `0x73` |
| 2 bytes (LE) | `0x7373` |
| 4 bytes (LE) | `0x73737373` |

The parser loops over identifier bytes (XOR-decoded), where `0x6E` starts an inventory section and `0x73` signals end-of-file. Each slot record is: `identifier(0x69)` → `size(4)` → `slot(uint16 LE)` → `container(uint16 LE)`.

### Current status

**Implemented.** `src/dat/itemodr.ts` parses the binary file and `src/dat/finder.ts` locates it automatically.

- `getFfxivDataDir()` returns the Global Windows path by default; override with `FFXIV_DATA_DIR` env var.
- `findItemodrPath(dataDir)` picks the single `FFXIV_CHR*` directory, or the one with the most recently modified `ITEMODR.DAT` when multiple characters exist.
- `parseItemOdr(buf)` returns an `ItemOdr` map (section name → ordered `SlotCoord[]`).
- `buildPosMap(odr)` converts this to a `Map<"containerId:slot", visualPosition>`.

The `/debug/inventory` endpoint re-reads `ITEMODR.DAT` on every request so item moves are reflected immediately. Items without an ODR entry (e.g. armory pieces the player has never moved) show `location: null` and sort to the end of their group.