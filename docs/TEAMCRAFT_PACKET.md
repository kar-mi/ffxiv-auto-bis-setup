# Packet Sniffer: Gear Sets and Inventory

This document explains how Teamcraft's packet sniffer captures and processes in-game data to populate gear sets and inventory state.

---

## Overview

The packet sniffer is an optional feature (enabled via the Machina toggle in the desktop app) that intercepts FFXIV's network traffic and parses structured game messages. The pipeline has three layers:

1. **Capture** (`apps/electron`) — intercepts raw packets and forwards them to the renderer
2. **IPC bridge** (`ipc.service.ts`) — converts Electron IPC messages into RxJS observables
3. **Domain services** — consume those observables and build application state

---

## Capture Layer

**`apps/electron/src/pcap/packet-capture.ts`**

On startup, `PacketCapture` instantiates a `CaptureInterface` from the `@ffxiv-teamcraft/pcap-ffxiv` library. Only packets whose type appears in the `ACCEPTED_PACKETS` whitelist are forwarded. Relevant entries for gear/inventory:

| Packet Type | Purpose |
|---|---|
| `itemInfo` | Bulk slot data for any container, including the currently equipped gear set |
| `containerInfo` | Signals the end of a container batch; links back to preceding `itemInfo` packets |
| `currencyCrystalInfo` | Variant of `itemInfo` for currency/crystal containers |
| `updateInventorySlot` | Single-slot change (add, remove, quantity update) |
| `inventoryModifyHandler` | Inventory manipulation (move, swap, split, merge, discard) |
| `inventoryTransaction` | External inventory transactions |
| `itemMarketBoardInfo` | Per-slot retainer market listing prices |
| `clientTrigger` | Market board price updates (commandId 400) |
| `playerSetup` | Provides the character's `contentId` |
| `updateClassInfo` | Provides `classId` and level |
| `playerStats` | Provides crafting stats (cp, control, craftsmanship) |

Each accepted packet is sent to the Angular renderer via `win.webContents.send('packet', packet)`.

---

## IPC Bridge

**`apps/client/src/app/core/electron/ipc.service.ts`**

The Angular side exposes a central `packets$` Subject. The `on('packet', ...)` listener pushes every incoming packet into it. Typed observables are then derived by filtering on packet type name:

```ts
itemInfoPackets$           // itemInfo
updateInventorySlotPackets$ // updateInventorySlot
playerSetupPackets$         // playerSetup
updateClassInfoPackets$     // updateClassInfo
playerStatsPackets$         // playerStats
```

---

## Gear Set Detection

### Container ID 1000

The FFXIV protocol represents the character's currently equipped gear as a container with ID `1000` (`ContainerType.GearSet0`). When the game sends a full equipment snapshot (e.g., on login or zone change), it emits a sequence of `itemInfo` packets for this container, followed by a `containerInfo` packet.

### Slot-to-property mapping

`GearsetsFacade.getPropertyName(slot)` (`apps/client/src/app/modules/gearsets/+state/gearsets.facade.ts:324`) maps the numeric slot index from the packet to a named property on `TeamcraftGearset`:

| Slot | Property |
|---|---|
| 0 | `mainHand` |
| 1 | `offHand` |
| 2 | `head` |
| 3 | `chest` |
| 4 | `gloves` |
| 5 | `belt` |
| 6 | `legs` |
| 7 | `feet` |
| 8 | `earRings` |
| 9 | `necklace` |
| 10 | `bracelet` |
| 11 | `ring2` |
| 12 | `ring1` |
| 13 | `crystal` |

### Manual import

**`apps/client/src/app/modules/gearsets/import-from-pcap-popup/import-from-pcap-popup.component.ts`**

The user triggers "Import gearset via packet sniffer." The component:
1. Subscribes to `ipc.itemInfoPackets$` with a 2-second debounce buffer, combined with `updateClassInfoPackets$`.
2. Filters packets where `containerId === 1000`.
3. Reads `catalogId` (item ID), `hqFlag`, `materia[]`, and `materiaTiers[]` from each packet.
4. Resolves materia item IDs via `MateriaService.getMateriaItemIdFromPacketMateria()`.
5. Populates a `TeamcraftGearset` and closes the dialog.

### Continuous sync

**`apps/client/src/app/modules/gearsets/sync-from-pcap-popup/sync-from-pcap-popup.component.ts`**

The sync variant follows the same subscription pattern but also cross-references `equipmentData` to validate items for the detected job, and creates or updates a "sync" flagged gearset in the store rather than prompting the user.

### Crafting stats from packets

**`apps/client/src/app/modules/eorzea/+state/eorzea.facade.ts:69`**

`classJobSet$` combines `playerStatsPackets$`, `updateClassInfoPackets$`, and the soul crystal `itemInfo` to build a stats object `{ cp, control, craftsmanship, level, specialist }`. When `autoUpdateStats` is enabled in `PacketCaptureTrackerService`, this is compared to saved sets and `authFacade.saveSet()` is called if anything changed.

---

## Inventory Detection

### State machine in `InventoryService`

**`apps/client/src/app/modules/inventory/inventory.service.ts`**

The inventory is built using an RxJS `scan()` operator that accumulates a `InventoryState` object from an action stream. The state type is:

```ts
{
  itemInfoQueue: ItemInfo[];          // buffered itemInfo packets awaiting containerInfo
  retainerInventoryQueue: {...}[];    // containers deferred until RetainerSpawn
  retainerUpdateSlotQueue: ...[];     // slot updates deferred until RetainerSpawn
  retainerMarketboardInfoQueue: ...; // MB info deferred until RetainerSpawn
  inventory: UserInventory;           // the live inventory model
  retainer: string;                   // current retainer name
}
```

### `itemInfo` + `containerInfo` pairing

The game always sends one or more `itemInfo` packets followed by a single `containerInfo` for the same sequence number. The service buffers all `itemInfo` packets into `itemInfoQueue`. When a `containerInfo` arrives, `handleContainerInfo()` drains the queue and builds `InventoryItem` objects:

```ts
{
  itemId, containerId, retainerName,
  quantity, slot, hq, spiritBond,
  materias: number[],  // resolved item IDs
  price, unitMbPrice
}
```

### Retainer containers

Retainer packet data arrives before the game confirms which retainer is active. The service defers all retainer containers, slot updates, and market board info into separate queues. When a `RetainerSpawn` event arrives carrying the retainer's name, the queues are flushed and the name is applied.

### Single-slot updates

`updateInventorySlot` and `inventoryTransaction` packets trigger `handleUpdateInventorySlot()`, which calls `inventory.updateInventorySlot()` on the `UserInventory` model and emits an `InventoryPatch` describing the change.

### `inventoryTransaction` flag

The flag value that identifies `inventoryTransaction` packets is not hardcoded. On startup, the service fetches `InventoryOperationBaseValue` from a per-region constants file:

- Global: `https://raw.githubusercontent.com/karashiiro/FFXIVOpcodes/master/constants.min.json`
- CN: `https://opcodes.xivcdn.com/constants.min.json`

The effective flag is `InventoryOperationBaseValue - 1`.

### Inventory manipulation

`inventoryModifyHandler` packets are routed to `inventory.operateTransaction()`, which handles the following sub-operations:

- `swap` — exchange two slots
- `merge` — combine stacks
- `move` — relocate an item
- `split` — divide a stack
- `transferGil` / `transferCrystal` — currency/crystal movements
- `discard` — remove an item

### Container ID reference

`ContainerType` (`apps/client/src/app/model/user/inventory/container-type.ts`) maps numeric IDs to semantic names:

| Range | Container |
|---|---|
| 0–3 | Player bags |
| 1000–1001 | Equipped gear sets |
| 2000 | Currency/crystals |
| 3200–3500 | Armory chest slots |
| 4000–4001 | Saddlebag |
| 4100–4101 | Premium saddlebag |
| 10000–10006 | Retainer bags |
| 20000–20010 | Free Company chest |
| -10 | Island sanctuary bag |

### Inventory patches and list auto-completion

**`apps/client/src/app/core/electron/packet-capture-tracker.service.ts:98`**

`inventoryService.inventoryPatches$` is subscribed with a debounce. When an item in a player bag, crystal pouch, or armory chest changes, the service checks if any open list items can be marked complete based on the new inventory totals.

---

## DAT File Fallback (Item Sort Order)

**`apps/electron/src/dat/dat-files-watcher.ts`**

A separate, non-packet mechanism watches the local `ITEMODR.DAT` files in the FFXIV user data directory. These binary files encode the display-order positions of items within each container. The watcher:

1. Detects filesystem changes via a directory watcher on the `FFXIV_CHR<hex>` folders.
2. Parses the DAT format by XOR-decoding each field (`XOR8 = 0x73`, `XOR16 = 0x7373`, `XOR32 = 0x73737373`).
3. Dispatches the parsed order as `dat:item-odr` and `dat:all-odr` IPC events.
 
This gives the UI the ability to display items in the same order as the in-game inventory, independent of the packet sniffer.

---

## OpCodes

https://cdn.jsdelivr.net/gh/karashiiro/FFXIVOpcodes@latest/opcodes.min.json

https://xiv.dev/network/packet-structure

## Data Flow Diagram

```
Game Process
    │
    │  Network packets (TCP)
    ▼
@ffxiv-teamcraft/pcap-ffxiv (CaptureInterface)
    │
    │  Filter: ACCEPTED_PACKETS whitelist
    ▼
PacketCapture.sendToRenderer()
    │
    │  Electron IPC  win.webContents.send('packet', packet)
    ▼
IpcService.packets$  (RxJS Subject)
    │
    ├── itemInfoPackets$ ──────────────────► InventoryService (scan state machine)
    ├── containerInfoPackets$ ─────────────► InventoryService
    ├── updateInventorySlotPackets$ ───────► InventoryService
    ├── inventoryModifyHandlerPackets$ ────► InventoryService
    │                                            │
    │                                            ▼
    │                                       UserInventory model
    │                                            │
    │                                            ▼
    │                                       inventoryPatches$ ──► list auto-completion
    │
    ├── itemInfoPackets$ (containerId=1000) ► ImportFromPcapPopupComponent
    ├── updateClassInfoPackets$ ───────────► ImportFromPcapPopupComponent
    │                                            │
    │                                            ▼
    │                                       TeamcraftGearset
    │
    ├── playerStatsPackets$ ───────────────┐
    ├── updateClassInfoPackets$ ───────────┼► EorzeaFacade.classJobSet$
    └── itemInfoPackets$ (soul crystal) ──┘       │
                                                   ▼
                                           PacketCaptureTrackerService
                                           (autoUpdateStats → authFacade.saveSet)
```
