# Repository Workflow

## Runtime Modes

The project has two ways to run:

| Mode | Entry point | Command |
|------|-------------|---------|
| Standalone HTTP server | `src/server/index.ts` | `bun run start` |
| Electrobun desktop app | `src/desktop/index.ts` | `bun run desktop` |
| Stable desktop payload | `src/desktop/index.ts` | `bun run desktop:build:stable` |
| Windows portable zip | `scripts/package-portable.ts` | `bun run package:portable` |
| Portable zip verifier | `scripts/verify-portable.ts` | `bun run verify:portable` |

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
  - uses prebuilt dist/pcap-host.cjs when present, otherwise builds pcap/host.ts
    → dist/pcap-host.cjs  (Bun build, CJS, Node target)
  - spawns bundled runtime/node/node.exe when present, otherwise `node`
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
src/server/index.ts  (Bun.serve — async startServer())                      │
  - latestPcapGear: GearSnapshot | null      (in-memory; resets on restart) │
  - latestInventory: InventorySnapshot | null (in-memory; resets on restart)│
  - awaits cache restore before first request (no startup race)             │
  - BIS catalog persisted to data/bis/catalog.json                          │
  - routes delegated to src/server/routes/*                                 │
        │                                                                    │
        └────────────────────────────────────────────────────────────────────┘
```

### UI Path

```
src/ui/main.tsx  (entry point — built to public/bundle.js via bun build:ui)
  │   render(<App />, #app-root)
  │   loadCatalog(), loadGear()
  │
  ├── state.ts              @preact/signals — all reactive state
  │                         signals: currentSnapshot, comparisonData, bisLinkEntries,
  │                                  bisLinkUrl, compareVisible, clearVisible,
  │                                  statusMsg, snapshotMeta, selectedSlot, …
  │                         state{} compat shim for non-component modules
  │                         mergedItemDataMap() — combines gear + BIS item caches
  │
  ├── gear-load.ts          loadGear() — fetches /pcap/gear, resolves item IDs,
  │                         updates currentSnapshot / snapshotMeta signals,
  │                         calls autoDetectJob → runComparison if a BIS set is selected
  │
  ├── api.ts                fetchItemData() — proxies GET /item/:id (process-lifetime cache)
  ├── constants.ts          SLOT_LABELS, JOBS, LEFT/RIGHT_SLOTS, API_BASE
  ├── dom.ts                el(), setStatus() → statusMsg signal, clearStatus(), logger
  ├── types.ts              UpgradeItemsResponse, UpgradeItemEntry (frontend-only shapes)
  │
  ├── render/               Preact components (all .tsx)
  │   ├── App.tsx           <App /> — root; <TabBar /> + 4 tab panels + modals
  │   │                     module-level signals: manageSetsTab, manual-add form state
  │   ├── GearTab.tsx       <GearTab /> — reads currentSnapshot, comparisonData signals
  │   ├── AcquisitionTab.tsx <AcquisitionTab /> — reads acquisitionData signal
  │   ├── UpgradesTab.tsx   <UpgradesTab /> — owns upgrade fetch; loadUpgradeItems()
  │   ├── BisTab.tsx        <SavedSetsTab /> — reads currentCatalog, bisJobFilter signals
  │   ├── CompareModal.tsx  <CompareModal /> — reads selectedSlot signal
  │   │                     openCompareModal(slot), closeModal()
  │   ├── SettingsModal.tsx <SettingsModal /> — settingsOpen signal
  │   ├── Titlebar.tsx      <Titlebar /> — custom desktop chrome controls + drag
  │   ├── ResizeHandles.tsx <ResizeHandles /> — 8 invisible edge/corner hit zones
  │   └── components/
  │       └── Corners.tsx   <Corners /> — decorative corner spans
  │
  ├── bis/
  │   ├── catalog.ts        loadCatalog(), addSetFromUrl(), patchSet(),
  │   │                     refreshBisDropdown() → updates bisLinkEntries/bisLinkUrl signals
  │   ├── balance.ts        loadBalanceLinksForModal() — fetches GET /balance/:role/:job
  │   └── comparison.ts     runComparison(), autoDetectJob() → updates BIS link signals,
  │                         clearComparison()
  │
  └── window/
      ├── resize.ts         startMove(), startResize() — pointer-event custom chrome
      └── controls.ts       close/minimize/maximize/setFrame HTTP wrappers

public/index.html  (<div id="app-root"> mount inside the square app shell;
                    native DWM owns any real outer corner rounding)
public/styles.css  (generated; dark page backdrop, corner decoration + modal animations)
public/bundle.js   (built output — gitignored)
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
│   ├── compute.ts           — computeAcquisition(needs, map, inventory, upgradeBisIds)
│   │                          buildCounts(inventory) → Map<itemId, quantity>
│   └── upgrade-detection.ts — buildUpgradeBisIds(needs, bis, acquisitionMap, lookup?)
│                              getBaseItemId(bisItemId, upgradeOffset) → number
│                              confirmUpgradeMatch(baseItemId, baseILevel, lookup?) → Promise<boolean>
│
├── bis/
│   ├── balance.ts           — fetchBisLinks(role, job)
│   │                          scrapes xivgear.app links from thebalanceffxiv.com
│   ├── comparison.ts        — compareGear(snapshot, bisSet) → GearsetComparison
│   ├── local-store.ts       — BisCatalog CRUD persisted to data/bis/catalog.json
│   │                          loadCatalog, saveCatalog, upsertSet, removeSet,
│   │                          setPreference, clearPreference, makeEntryId, canonicalUrl
│   ├── multiset.ts          — multisetEquals(a, b) — order-independent array comparison
│   ├── needs.ts             — computeNeeds(comparison, bis, inventory) → GearNeeds
│   └── xivgear.ts           — fetchBisSet(url, setIndex) → BisGearSet
│                              fetchSetNames(url) → string[]
│                              resolveSetIndex(url, setParam?) → number
│
├── inventory/
│   └── counts.ts            — buildItemCounts(inventory) → Map<itemId, quantity>
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
│                              uses frameless titleBarStyle: "hidden" with an
│                              opaque window background for stable WebView2
│                              hit-testing on Windows
│                              requests native DWM rounded corners as a
│                              best-effort Windows 11 enhancement
│                              spawns pcap/host.ts as a Node child process
│
├── pcap/
│   ├── capture.ts           — GearPacketCapture class
│   │                          depends on: types.ts, pcap/materia.ts, @ffxiv-teamcraft/pcap-ffxiv
│   │                          emits 'gearSnapshot' and 'inventorySnapshot'
│   ├── host.ts              — thin runner for GearPacketCapture
│   │                          depends on: pcap/capture.ts, pcap/materia-data.ts
│   │                          spawned as a child process by desktop/index.ts
│   ├── snapshot-cache.ts    — saveGearCache / loadGearCache / saveInventoryCache
│   │                          / loadInventoryCache / saveJobGearCache / loadJobGearCache
│   │                          / listJobGearCaches — persists snapshots to data/cache/
│   │                          uses writeJsonAtomic for crash-safe writes
│   ├── materia.ts           — resolveMateriaItemId(type, tier, data)
│   │                          converts raw packet materia fields → FFXIV item ID
│   └── materia-data.ts      — loadMateriaData(projectRoot)
│                              reads data/materias.json via node:fs/promises
│                              compatible with both Bun and Node
│
├── server/
│   ├── index.ts             — startServer(port, publicDir, projectRoot) [async]
│   │                          Bun HTTP server; standalone entry point
│   │                          Awaits cache restore; delegates to routes/*
│   ├── ctx.ts               — ServerCtx interface + WindowControls
│   ├── helpers.ts           — json(), notFound() response helpers
│   └── routes/
│       ├── window.ts        — POST /window/minimize|maximize|close|setFrame, GET /window/frame
│       ├── pcap.ts          — GET|POST /pcap/gear|inventory
│       │                      GET /pcap/gear-cache, GET /pcap/gear-cache/:classId
│       │                      POST /pcap/gear-selected
│       ├── item.ts          — GET /item/:id
│       ├── bis.ts           — GET /balance/:role/:job, GET /bis/sets, GET /bis
│       │                      GET|POST /bis/catalog, POST /bis/catalog/sets
│       │                      PATCH|DELETE /bis/catalog/sets/:id
│       │                      PUT|DELETE /bis/catalog/preferences/:job
│       │                      GET /bis/full, GET /needs, GET /compare
│       ├── acquisition.ts   — GET /acquisition, GET /upgrade-items
│       └── debug.ts         — GET /debug/inventory
│
├── ui/                      — frontend TypeScript; built to public/bundle.js
│   ├── main.tsx             — entry point; mounts <App />, calls loadCatalog + loadGear
│   ├── constants.ts         — SLOT_LABELS, JOBS, LEFT/RIGHT_SLOTS, API_BASE
│   ├── types.ts             — frontend-only interfaces (UpgradeItemsResponse, UpgradeItemEntry)
│   ├── styles.css           — Tailwind source; #0d0d0d page backdrop avoids white
│   │                          fill around the opaque frameless desktop surface
│   ├── state.ts             — @preact/signals signals + state{} compat shim + mergedItemDataMap()
│   ├── dom.ts               — el(), setStatus() / clearStatus() (write signals), logger
│   ├── api.ts               — fetchItemData(id); proxies GET /item/:id with in-memory cache
│   ├── gear-load.ts         — loadGear(); fetches snapshot, resolves item data, updates signals
│   ├── render/
│   │   ├── App.tsx          — <App />; TabBar + tab panels + modals; manual-add form signals
│   │   ├── GearTab.tsx      — <GearTab />; gear card grid; reads snapshot/comparison signals
│   │   ├── AcquisitionTab.tsx — <AcquisitionTab />; acquisition rows; reads acquisitionData signal
│   │   ├── UpgradesTab.tsx  — <UpgradesTab />; upgrade item grid; loadUpgradeItems()
│   │   ├── BisTab.tsx       — <SavedSetsTab />; catalog CRUD with inline event handlers
│   │   ├── CompareModal.tsx — <CompareModal />; slot modal; openCompareModal() / closeModal()
│   │   ├── SettingsModal.tsx — <SettingsModal />; settingsOpen signal
│   │   └── components/
│   │       └── Corners.tsx  — <Corners />; decorative corner spans
│   ├── bis/
│   │   ├── catalog.ts       — loadCatalog(), addSetFromUrl(), patchSet(), refreshBisDropdown()
│   │   ├── balance.ts       — loadBalanceLinksForModal()
│   │   └── comparison.ts    — runComparison(), autoDetectJob(), clearComparison()
│   └── window/
│       ├── resize.ts        — startMove(), startResize(); pointer-event custom chrome
│       └── controls.ts      — close/minimize/maximize/setFrame wrappers
│
├── util/
│   └── atomic-write.ts      — writeJsonAtomic(absPath, value)
│                              write-to-tmp + rename; crash-safe on same filesystem
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
4. If `dist/pcap-host.cjs` is missing, `pcap/host.ts` is compiled to it via `bun build`
5. `dist/pcap-host.cjs` is spawned as a child process under bundled `runtime/node/node.exe` when present, otherwise `node`
6. The child process initialises `@ffxiv-teamcraft/pcap-ffxiv` and emits `{ type: "started" }` on success
7. As the game sends equipment packets, `GearPacketCapture` accumulates `itemInfo` slots and flushes on `containerInfo`
8. Each `GearSnapshot` is POSTed to `http://localhost:3000/pcap/gear` and stored in `latestPcapGear`
9. Each `InventorySnapshot` is POSTed to `http://localhost:3000/pcap/inventory` and stored in `latestInventory`
10. The UI reads `/pcap/gear` and `/pcap/inventory` to drive comparison and acquisition views

---

## Portable Packaging

`bun run package:portable` creates a versioned artifact such as
`artifacts/FFXIVGearSetup-portable-win-x64-v0.2.1.zip`. The version comes from
`package.json`, which is also read by `electrobun.config.ts` for app metadata.

The script:

1. Builds production UI assets (`public/bundle.js`, `public/styles.css`).
2. Builds `dist/pcap-host.cjs` for Node with `@ffxiv-teamcraft/pcap-ffxiv` external.
3. Runs the stable Electrobun build.
4. Extracts the stable Electrobun payload into a portable staging folder.
5. Adds runtime files under `Resources/app/`: `public/`, `raidinfo/`, `data/materias.json`,
   `dist/pcap-host.cjs`, a minimal `package.json`, the native capture dependencies, and
   `runtime/node/node.exe`.
6. Flattens the extracted Electrobun payload into the portable root.
7. Builds a top-level `FFXIVAutoBIS.exe` launcher with `scripts/build-portable-launcher.ps1`.
   The launcher starts `bin/launcher.exe` with `bin/` as the working directory, matching
   Electrobun's runtime expectations without requiring users to run a command script.
8. Adds `README.txt` with launch instructions and the generated data/config file locations.
9. Runs `scripts/verify-portable.ts` to expand the ZIP and assert required files, forbidden
   obsolete files, and README guidance.

The portable app writes runtime data under its own `Resources/app/data/` tree, so it should be
unzipped to a user-writable location.

## Release Workflow

GitHub releases are tag-driven from `.github/workflows/release.yml` on `v*.*.*` tags. The tag
must match `package.json`'s version. The release job installs Bun + Node 22, runs
`bun tsc --noEmit`, runs `bun test`, builds the portable ZIP, verifies it with
`bun run verify:portable`, and uploads `artifacts/FFXIVGearSetup-portable-win-x64-v*.zip`.

Pull requests and pushes to `main` run `.github/workflows/ci.yml`, which installs dependencies,
type-checks, and runs the Bun test suite.

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
