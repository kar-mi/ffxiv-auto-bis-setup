# Repository Workflow

## Runtime Modes

The project has two ways to run:

| Mode | Entry point | Command |
|------|-------------|---------|
| Standalone HTTP server | `src/server/index.ts` | `bun run start` |
| Electrobun desktop app | `src/desktop/index.ts` | `bun run desktop` |

Both modes start the same HTTP server. The desktop mode additionally manages the packet capture child process.

---

## Data Flow

### Packet Capture Path

```
FFXIV game client
        │  (network packets)
        ▼
@ffxiv-teamcraft/pcap-ffxiv   (native .node addon — must run under Node, not Bun)
        │
        ▼
src/pcap/capture.ts  ──  GearPacketCapture (EventEmitter)
  - listens for: itemInfo (container 1000), containerInfo (container 1000),
                 updateClassInfo, playerSetup, updateInventorySlot
  - buffers itemInfo packets slot-by-slot
  - on containerInfo (container 1000): assembles GearSnapshot and emits 'gearSnapshot'
  - on containerInfo (bags/armory): assembles InventorySnapshot and emits 'inventorySnapshot'
        │
        ▼
src/pcap/host.ts  (standalone child process — stdout = newline-delimited JSON)
  - wraps GearPacketCapture
  - serialises events to stdout: { type, data? }
  - logs to stderr so stdout stays clean
        │  (stdout pipe)
        ▼
src/desktop/index.ts  (parent process — Electrobun desktop entry)
  - builds pcap/host.ts → dist/pcap-host.cjs  (Bun build, CJS, Node target)
  - spawns `node dist/pcap-host.cjs`
  - reads newline-delimited JSON from stdout
  - on 'gearSnapshot':     POST /pcap/gear      → HTTP server
  - on 'inventorySnapshot': POST /pcap/inventory → HTTP server
```

### HTTP Server Path

```
Browser / UI  ──────────────────────────────────────────────────────────────┐
  GET  /pcap/gear          → returns latest GearSnapshot (or 404)           │
  POST /pcap/gear          → stores incoming GearSnapshot in memory         │
  GET  /pcap/inventory     → returns latest InventorySnapshot (or 404)      │
  POST /pcap/inventory     → stores incoming InventorySnapshot in memory    │
  GET  /item/:id           → fetches item data from XIVAPI (cached)         │
  GET  /balance/:role/:job → scrapes BIS links from The Balance FFXIV       │
  GET  /bis/sets?url=      → lists set names for a xivgear.app URL          │
  GET  /bis?url=&set=      → fetches a normalized BIS set from xivgear.app  │
  GET  /compare?url=&set=  → compares gear snapshot against a BIS set       │
  GET  /needs?url=&set=    → lists items/materia still needed for BIS        │
  GET  /acquisition?url=   → per-slot acquisition paths cross-ref'd against  │
                             inventory (coffer / books / upgrade)             │
  GET  /upgrade-items      → all upgrade-related items for the active tier   │
  GET  /bis/catalog        → returns the saved BIS catalog                  │
  POST /bis/catalog/sets   → fetches + saves a BIS set to the catalog       │
  PATCH/DELETE /bis/catalog/sets/:id   → update or remove a catalog entry   │
  PUT/DELETE /bis/catalog/preferences/:job  → set or clear job preference   │
  GET  /debug/inventory    → inventory grouped/sorted by ITEMODR.DAT order  │
  POST /window/minimize    → window controls (desktop mode only)            │
  GET  /*                  → serves public/* (static files)                 │
        │                                                                    │
        ▼                                                                    │
src/server/index.ts  (Bun.serve)                                            │
  - latestPcapGear: GearSnapshot | null      (in-memory; resets on restart) │
  - latestInventory: InventorySnapshot | null (in-memory; resets on restart)│
  - BIS catalog persisted to data/bis/catalog.json                          │
        │                                                                    │
        └────────────────────────────────────────────────────────────────────┘
```

### UI Path

```
public/index.html  (Tailwind CSS via CDN)
public/app.js
  - renders gear slots, comparison overlay, BIS catalog, acquisition status
  - uses /pcap/gear, /compare, /needs, /acquisition, /bis/catalog, etc.
```

---

## Module Map

```
src/
├── types.ts                 — canonical types shared by all modules
│                              SlotName, SLOT_NAMES, EquipmentPiece, GearSnapshot,
│                              InventoryItem, InventorySnapshot,
│                              BisItem, BisGearSet, BisLink, RaidTier, BisCatalog,
│                              ItemNeed, MateriaChange, GearNeeds,
│                              SlotComparison, GearsetComparison, SlotStatus
│
├── acquisition/
│   ├── types.ts             — acquisition data + computed status types
│   │                          GearAcquisitionMap, SlotAcquisition, BookDef,
│   │                          UpgradeMaterialDef, SlotAcquisitionStatus,
│   │                          CofferStatus, BookExchangeStatus, UpgradePathStatus,
│   │                          BaseItemStatus, UpgradeMaterialStatus, ItemCount
│   ├── loader.ts            — loadGearAcquisitionMap(projectRoot)
│   │                          reads raidinfo/index.json → raidinfo/<tier>/gear-acquisition.json
│   │                          process-lifetime cache (invalidate by restarting)
│   └── compute.ts           — computeAcquisition(needs, map, inventory, upgradeBisIds)
│                              buildCounts(inventory) → Map<itemId, quantity>
│
├── bis/
│   ├── balance.ts           — fetchBisLinks(role, job)
│   │                          scrapes xivgear.app links from thebalanceffxiv.com
│   ├── comparison.ts        — compareGear(snapshot, bisSet) → GearsetComparison
│   ├── local-store.ts       — BisCatalog CRUD persisted to data/bis/catalog.json
│   │                          loadCatalog, saveCatalog, upsertSet, removeSet,
│   │                          setPreference, clearPreference, makeEntryId, canonicalUrl
│   ├── needs.ts             — computeNeeds(comparison, bis, inventory) → GearNeeds
│   └── xivgear.ts           — fetchBisSet(url, setIndex) → BisGearSet
│                              fetchSetNames(url) → string[]
│                              resolveSetIndex(url, setParam?) → number
│
├── dat/
│   ├── finder.ts            — getFfxivDataDir() → string
│   │                          findItemodrPath(dataDir) → string | null
│   │                          Supports FFXIV_DATA_DIR env var override.
│   │                          Auto-selects by most-recently-modified ITEMODR.DAT
│   │                          when multiple FFXIV_CHR* directories exist.
│   └── itemodr.ts           — parseItemOdr(buf) → ItemOdr
│                              buildPosMap(odr) → Map<"containerId:slot", position>
│                              Parses FFXIV's XOR-obfuscated binary item order file.
│
├── debug/
│   └── inventory-log.ts     — logInventorySnapshot(snapshot)
│                              Appends to logs/inventory.jsonl when INVENTORY_LOG=1.
│
├── desktop/
│   └── index.ts             — Electrobun desktop entry
│                              depends on: server/index.ts (startServer)
│                              spawns pcap/host.ts as a Node child process
│
├── pcap/
│   ├── capture.ts           — GearPacketCapture class
│   │                          depends on: types.ts, pcap/materia.ts, @ffxiv-teamcraft/pcap-ffxiv
│   │                          emits 'gearSnapshot' and 'inventorySnapshot'
│   ├── host.ts              — thin runner for GearPacketCapture
│   │                          depends on: pcap/capture.ts, pcap/materia-data.ts
│   │                          spawned as a child process by desktop/index.ts
│   ├── materia.ts           — resolveMateriaItemId(type, tier, data)
│   │                          converts raw packet materia fields → FFXIV item ID
│   └── materia-data.ts      — loadMateriaData(projectRoot)
│                              reads data/materias.json via node:fs/promises
│                              compatible with both Bun and Node
│
├── server/
│   └── index.ts             — startServer(port, publicDir, projectRoot)
│                              Bun HTTP server; also the standalone entry point
│
└── xivapi/
    └── item-data.ts         — fetchItemData(itemId) → ItemData
                               peekItemData(itemId) → ItemData | undefined  (cache-only, no fetch)
                               Process-lifetime in-memory cache.
```

---

## Startup Sequence (Desktop Mode)

1. `bun run desktop` → Electrobun launches `src/desktop/index.ts`
2. `startServer(3000)` starts the HTTP server in-process
3. A `BrowserWindow` opens pointing to `http://localhost:3000`
4. `pcap/host.ts` is compiled to `dist/pcap-host.cjs` via `bun build`
5. `node dist/pcap-host.cjs` is spawned as a child process
6. The child process initialises `@ffxiv-teamcraft/pcap-ffxiv` and emits `{ type: "started" }` on success
7. As the game sends equipment packets, `GearPacketCapture` accumulates `itemInfo` slots and flushes on `containerInfo`
8. Each `GearSnapshot` is POSTed to `http://localhost:3000/pcap/gear` and stored in `latestPcapGear`
9. Each `InventorySnapshot` is POSTed to `http://localhost:3000/pcap/inventory` and stored in `latestInventory`
10. The UI reads `/pcap/gear` and `/pcap/inventory` to drive comparison and acquisition views

---

## Key Types

### `GearSnapshot`
Emitted by the packet capture pipeline when a full gear load is detected (container 1000 flush).

```ts
interface GearSnapshot {
  characterId?: number;   // from playerSetup packet
  classId?: number;       // from updateClassInfo packet
  items: Partial<Record<SlotName, EquipmentPiece>>;
  capturedAt: string;     // ISO timestamp
}
```

### `EquipmentPiece`
One equipped item slot as captured from packets.

```ts
interface EquipmentPiece {
  itemId: number;         // catalog ID from itemInfo packet
  hq: boolean;            // hqFlag from itemInfo packet
  materias: number[];     // resolved item IDs (0 = empty slot)
  materiaSlots: number;
  canOvermeld: boolean;
}
```

### `InventorySnapshot`
Emitted when the capture pipeline flushes a bag or armory container.

```ts
interface InventorySnapshot {
  characterId?: number;
  items: InventoryItem[];
  capturedAt: string;
}

interface InventoryItem {
  itemId: number;
  quantity: number;
  hq: boolean;
  containerId: number;
  slot: number;
}
```

### `GearNeeds`
What a player still needs to acquire or re-meld for a BIS set.

```ts
interface GearNeeds {
  itemNeeds: ItemNeed[];          // slots needing a different item
  materiaChanges: MateriaChange[]; // slots needing re-melds
}

interface ItemNeed {
  slot: SlotName;
  reason: 'wrong-item' | 'missing';
  bisItemId: number;
  equippedItemId?: number;
  quantityInBags: number;         // how many the player already has in bags
}

interface MateriaChange {
  slot: SlotName;
  bisItemId: number;
  toAdd: number[];                // materia item IDs to meld
  toRemove: number[];             // materia item IDs to strip first
  quantityInBags: Record<number, number>; // inventory counts for toAdd materias
}
```

### `BisCatalog`
Locally persisted BIS sets with per-job preferences.

```ts
interface BisCatalog {
  sets: LocalBisEntry[];
  preferences: Record<string, string>; // uppercase job → LocalBisEntry.id
}

interface LocalBisEntry {
  id: string;          // e.g. "bis_war_current_0"
  url: string;         // canonical xivgear.app URL with selectedIndex baked in
  setIndex: number;
  savedAt: string;
  set: BisGearSet;
  raidTier: RaidTier;
}
```

---

## What's Not Yet Implemented

| Feature | Notes |
|---------|-------|
| Lodestone scraping | No `GET/POST /user/:id` routes; character data is not fetched |
| Bundler | Replace CDN Tailwind with a proper build step; convert `public/app.js` to ESM modules |
