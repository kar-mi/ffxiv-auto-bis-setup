# Repository Workflow

## Runtime Modes

The project has two ways to run:

| Mode | Entry point | Command |
|------|-------------|---------|
| Standalone HTTP server | `src/index.ts` | `bun run start` |
| Electrobun desktop app | `src/bun/index.ts` | `bun run desktop` |

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
src/pcap.ts  ──  GearPacketCapture (EventEmitter)
  - listens for: itemInfo (container 1000), containerInfo (container 1000),
                 updateClassInfo, playerSetup
  - buffers itemInfo packets slot-by-slot
  - on containerInfo: assembles GearSnapshot and emits 'gearSnapshot'
        │
        ▼
src/pcap-host.ts  (standalone child process — stdout = newline-delimited JSON)
  - wraps GearPacketCapture
  - serialises events to stdout: { type, data? }
  - logs to stderr so stdout stays clean
        │  (stdout pipe)
        ▼
src/bun/index.ts  (parent process — Electrobun desktop entry)
  - builds pcap-host.ts → dist/pcap-host.cjs  (Bun build, CJS, Node target)
  - spawns `node dist/pcap-host.cjs`
  - reads newline-delimited JSON from stdout
  - on 'gearSnapshot': POST /pcap/gear → HTTP server
```

### HTTP Server Path

```
Browser / UI  ──────────────────────────────────────────────────────┐
  GET  /pcap/gear   → returns latest GearSnapshot (or 404)          │
  POST /pcap/gear   → stores incoming GearSnapshot in memory        │
  GET  /            → serves public/index.html                      │
  GET  /*           → serves public/* (static files)               │
        │                                                            │
        ▼                                                            │
src/index.ts  (Bun.serve)                                           │
  - latestPcapGear: GearSnapshot | null  (in-memory; resets on     │
    restart)                                                         │
        │                                                            │
        └────────────────────────────────────────────────────────────┘
```

### UI Path

```
public/index.html  (Tailwind CSS via CDN)
public/app.js
  - user enters a Lodestone ID
  - "Load"    → GET  /user/:id          ⚠ route not yet implemented
  - "Refresh" → POST /user/:id          ⚠ route not yet implemented
  - renders character name, world/DC, level, gear slots with
    item name, item level, materia, glamour, dye
```

> **Note:** The UI's `GET/POST /user/:id` calls have no matching server route yet — this is part of the "Still needed" work in [CLAUDE.md](CLAUDE.md).

---

## Module Map

```
src/
├── types.ts          — canonical types shared by all modules
│                       SlotName, SLOT_NAMES, EquipmentPiece, GearSnapshot,
│                       EquipmentPieceProgression, GearsetProgression,
│                       GearsetComparison, ItemMeldingData
│
├── materia.ts        — resolveMateriaItemId(packetMateriaId, packetTier, data)
│                       converts raw packet materia fields → FFXIV item ID
│
├── materia-data.ts   — loadMateriaData(projectRoot): reads data/materias.json via node:fs/promises
│                       compatible with both Bun and Node (pcap-host runs under Node)
│                       source data: ffxiv-teamcraft/libs/data/src/lib/json/materias.json
│
├── pcap.ts           — GearPacketCapture class
│                       depends on: types.ts, materia.ts, @ffxiv-teamcraft/pcap-ffxiv
│                       setMateriaData() accepts MateriaEntry[] for materia resolution
│
├── pcap-host.ts      — thin runner for GearPacketCapture
│                       depends on: pcap.ts, materia-data.ts
│                       loads materia data first, then starts capture
│                       spawned as a child process by bun/index.ts
│
├── index.ts          — Bun HTTP server (startServer)
│                       depends on: types.ts
│                       also acts as standalone entry point (bun run start)
│
└── bun/
    └── index.ts      — Electrobun desktop entry
                        depends on: index.ts (startServer), types.ts
                        spawns pcap-host.ts as a Node child process
```

---

## Startup Sequence (Desktop Mode)

1. `bun run desktop` → Electrobun launches `src/bun/index.ts`
2. `startServer(3000)` starts the HTTP server in-process
3. A `BrowserWindow` opens pointing to `http://localhost:3000`
4. `pcap-host.ts` is compiled to `dist/pcap-host.cjs` via `bun build`
5. `node dist/pcap-host.cjs` is spawned as a child process
6. The child process initialises `@ffxiv-teamcraft/pcap-ffxiv` and emits `{ type: "started" }` on success
7. As the game sends equipment packets, `GearPacketCapture` accumulates `itemInfo` slots and flushes on `containerInfo`
8. Each `GearSnapshot` is POSTed to `http://localhost:3000/pcap/gear` and stored in `latestPcapGear`
9. The UI can then `GET /pcap/gear` to retrieve the latest snapshot

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
  materias: number[];     // resolved item IDs (empty until materia parsing is wired up)
  materiaSlots: number;
  canOvermeld: boolean;
  baseParamModifier: number;
}
```

---

## What's Not Yet Implemented

| Feature | Notes |
|---------|-------|
| Lodestone scraping | `@xivapi/nodestone` was removed; `GET/POST /user/:id` routes missing |
| BIS scraping | Parse gear tables from `thebalanceffxiv.com` |
| Comparison engine | Diff `GearSnapshot` vs BIS using `GearsetComparison` / `GearsetProgression` |
| Item ID resolution | Map `itemId` integers to item names / stats |
