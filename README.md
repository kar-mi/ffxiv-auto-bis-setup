# FFXIV Automatic BIS Finder

An app that compares a character's equipped gear against Best-In-Slot (BIS) recommendations from [The Balance FFXIV](https://thebalanceffxiv.com), with real-time packet capture from the FFXIV game client.

## Setup

```bash
bun install
```

## Running

| Mode | Command | Description |
|------|---------|-------------|
| Standalone HTTP server | `bun run start` | Runs the HTTP server only (no packet capture) |
| Desktop app | `bun run desktop` | Electrobun window + packet capture child process |

The desktop mode builds `src/pcap/host.ts` → `dist/pcap-host.cjs` and spawns it under Node (required because `@ffxiv-teamcraft/pcap-ffxiv` is a native Node addon). Both modes serve the UI at `http://localhost:3000`.

## Frontend

```bash
bun run build:ui        # Build frontend bundle (development)
bun run build:ui:prod   # Build frontend bundle (minified)
bun run watch:ui        # Rebuild on file change
bun run build:css       # Compile Tailwind CSS
bun run watch:css       # Rebuild CSS on file change
```

## Development

```bash
bun test                # Run test suite
bun tsc --noEmit        # Type-check all source files
```

## Data Sources

- **Character gear** — FFXIV game client via packet capture (`@ffxiv-teamcraft/pcap-ffxiv`)
- **BIS sets** — [The Balance FFXIV](https://thebalanceffxiv.com) → [xivgear.app](https://xivgear.app)
- **Item metadata** — XIVAPI v2 (cached per process)
- **Item display order** — `ITEMODR.DAT` binary file from the FFXIV client data directory

## Architecture

See [`docs/WORKFLOW.md`](docs/WORKFLOW.md) for the full data-flow diagrams and module map.

### Runtime Modes

```
FFXIV game client
    │ (network packets)
    ▼
@ffxiv-teamcraft/pcap-ffxiv  (native Node addon)
    ▼
src/pcap/capture.ts          (GearPacketCapture)
    ▼
src/pcap/host.ts             (child process — stdout newline-delimited JSON)
    ▼
src/desktop/index.ts         (parent — POSTs snapshots to HTTP server)
    ▼
src/server/index.ts          (Bun HTTP server — serves UI + API)
```

### Key HTTP Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET/POST` | `/pcap/gear` | Latest `GearSnapshot` |
| `GET/POST` | `/pcap/inventory` | Latest `InventorySnapshot` |
| `GET` | `/item/:id` | XIVAPI item data (cached) |
| `GET` | `/compare?url=&set=` | Gear vs BIS comparison |
| `GET` | `/needs?url=&set=` | Items/materia still needed |
| `GET` | `/acquisition?url=` | Per-slot acquisition paths cross-referenced against inventory |
| `GET` | `/upgrade-items` | Upgrade materials for the active raid tier |
| `GET/POST` | `/bis/catalog` | BIS catalog management |
| `POST` | `/bis/catalog/sets` | Fetch + save a BIS set |
| `PATCH/DELETE` | `/bis/catalog/sets/:id` | Update or remove a catalog entry |
| `PUT/DELETE` | `/bis/catalog/preferences/:job` | Set or clear per-job BIS preference |
| `GET` | `/debug/inventory` | Inventory sorted by `ITEMODR.DAT` visual order |

Full endpoint documentation is in [`openapi.yaml`](openapi.yaml).

## Features

### BIS Catalog
Save xivgear.app BIS sets locally for reuse. Pin a preferred set per job so comparison and acquisition views pre-populate automatically. Persisted to `data/bis/catalog.json`. See [`docs/BIS-CATALOG.md`](docs/BIS-CATALOG.md).

### Gear Acquisition
For each slot where equipped gear doesn't match BIS, shows all available acquisition paths: savage coffer drops, book exchanges, or the tome gear + upgrade material route. Cross-referenced against current inventory to show what's already on hand. See [`docs/ACQUISITION.md`](docs/ACQUISITION.md).

### Raid Tier Configuration
Add a new tier by creating `raidinfo/<tier_key>/gear-acquisition.json` and updating `raidinfo/index.json`. Restart the server to apply.

## Stack

- **Runtime**: [Bun](https://bun.sh)
- **Language**: TypeScript (strict mode, ESNext)
- **UI**: Preact + `@preact/signals`
- **Desktop**: Electrobun
