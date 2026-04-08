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
- Tome weapons require a specific **tomestone weapon item** for the purchase (not just raw tomes).
- There is **no book path** for buying the weapon directly — only the tome/upgrade route or a coffer drop.
- In the JSON, `bookIndex: 4` (out of bounds) is used as a sentinel meaning "no book exchange available."

### Off Hand (shield — Paladin only)
- The shield cannot be purchased separately.
- It is acquired together with the main hand at no additional cost.
- The `offHand` slot in the JSON has no acquisition fields for this reason.

---

## Acquisition Logic (how the code uses this)

For each slot where the player's equipped item does not match BIS:

1. **Identify the BIS item type** by matching `bisItemId` against `raidItemId` or `upgradeItemId` in the slot's data.
   - Match on `raidItemId` → only **coffer** and **book** paths apply.
   - Match on `upgradeItemId` → only the **upgrade** path applies (tome purchase + material).
   - No match (IDs still 0 / not filled) → all paths shown with placeholder state.

2. **Cross-reference inventory** (bags + armory) for:
   - The coffer item
   - The relevant book edition
   - The upgrade material
   - The 780 base piece (bags or armory)
   - The tomestone currency

3. **Surface** which paths are immediately satisfiable and which are partially complete.

---

## JSON Schema Reference (`gear-acquisition.json`)

```jsonc
{
  "label": "human-readable tier name",
  "tomeId": 0,            // item ID of the tomestone currency (0 = placeholder)
  "tomeName": "...",
  "books": [
    { "itemId": 0, "name": "AAC Illustrated: HW Edition 1" },
    // index 0 = Edition 1, index 1 = Edition 2, ...
  ],
  "upgradeMaterials": [
    {
      "key": "twine",     // referenced by slots[*].upgradeMaterialKey
      "itemId": 0,
      "name": "...",
      "bookIndex": 3,     // 0-based index into books[]
      "bookCount": 4      // books needed to buy 1 of this material
    }
  ],
  "slots": {
    "head": {
      "raidItemId": 0,          // 790 raid piece
      "cofferItemId": 0,        // coffer that drops this slot's raid piece
      "bookIndex": 2,           // which book edition buys this raid piece
      "bookCount": 4,           // how many books
      "currencyItemId": 0,      // 780 tome piece (upgrade input)
      "tomeCost": 495,          // tomestones to buy the 780 piece
      "upgradeItemId": 0,       // 790 upgraded piece (upgrade output)
      "upgradeMaterialKey": "twine"
    }
    // bookIndex >= books.length → no book exchange for that slot (weapon sentinel)
    // offHand → omit all fields if bundled with another slot
  }
}
```

To add a new raid tier: create `raidinfo/<tier_key>/gear-acquisition.json` and set `"activeTier": "<tier_key>"` in `raidinfo/index.json`.

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

**Not implemented.** The `/debug/inventory` endpoint aggregates items by `itemId` rather than by position, so visual order is not needed for the current debugging workflow.

If visual position matching is added in the future, the implementation would need:
- The FFXIV user data directory path (configurable per region — Global/KR/CN paths differ)
- A sequential binary reader (Teamcraft uses `buffer-reader`; Node's `Buffer` API is sufficient)
- A filesystem watcher to pick up changes when the player moves items in-game

Reference implementation: `apps/electron/src/dat/dat-files-watcher.ts` in the `ffxiv-teamcraft` repo.

item ids
```
49758 - twine
49759 - glaze
49757 - solvent
49760 - book 1
49761 - book 2
49763 - book 3
49764 - book 4

49739 - head coffer
49743 - feet coffer

49745 - necklace coffer
49747 - ring coffer