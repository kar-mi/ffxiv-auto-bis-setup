# BIS Catalog

How locally saved BIS sets and per-job preferences work.

---

## Overview

The catalog lets you save xivgear.app BIS sets locally so they can be reused without re-fetching from The Balance each time. You can also pin a preferred set per job, which the UI uses to pre-populate comparison and acquisition views.

The catalog is persisted to `data/bis/catalog.json`. The file is created on first write; missing entries default to an empty catalog.

---

## Data Model

```ts
interface BisCatalog {
  sets: LocalBisEntry[];
  preferences: Record<string, string>; // uppercase job → LocalBisEntry.id
}

interface LocalBisEntry {
  id: string;         // e.g. "bis_war_current_0"  (derived from xivgear page slug + setIndex)
  url: string;        // canonical xivgear.app URL with selectedIndex baked in
  setIndex: number;   // 0-based index of the set within a multi-set xivgear page
  savedAt: string;    // ISO timestamp of when it was saved
  set: BisGearSet;    // the full normalized BIS set (name, job, items, food)
  raidTier: RaidTier; // user-assigned tier: "aac_lw" | "aac_mw" | "aac_hw" | "ultimate" | "criterion" | "other"
}
```

Entry IDs are derived from the xivgear page slug. For example, `https://xivgear.app/?page=bis|war|current&selectedIndex=0` → `"bis_war_current_0"`. This makes IDs stable across re-saves.

---

## HTTP Endpoints

### `GET /bis/catalog`
Returns the full catalog.

**Response:** `BisCatalog`
```json
{
  "sets": [...],
  "preferences": { "WAR": "bis_war_current_0" }
}
```

---

### `POST /bis/catalog/sets`
Fetches a BIS set from xivgear.app and saves it to the catalog. If an entry with the same ID already exists it is replaced.

**Body:**
```json
{
  "url": "https://xivgear.app/?page=bis|war|current",
  "setIndex": 0,       // optional — inferred from URL selectedIndex if omitted, then 0
  "raidTier": "aac_hw"
}
```

**Response:** `LocalBisEntry`

---

### `PATCH /bis/catalog/sets/:id`
Updates mutable fields of a saved entry without re-fetching from xivgear.app.

**Body:** `{ raidTier?: RaidTier, name?: string }`

**Response:** updated `LocalBisEntry`

---

### `DELETE /bis/catalog/sets/:id`
Removes a saved set. If any job preference pointed to this ID, the preference is also cleared.

**Response:** `{ "ok": true }`

---

### `PUT /bis/catalog/preferences/:job`
Sets the preferred BIS set for a job. `:job` is a case-insensitive job abbreviation (e.g. `WAR`, `war`).

**Body:** `{ "id": "bis_war_current_0" }`

**Response:** `{ "ok": true }`

Returns 404 if no catalog entry with that ID exists.

---

### `DELETE /bis/catalog/preferences/:job`
Clears the preferred BIS set for a job.

**Response:** `{ "ok": true }`

---

## Implementation

All catalog I/O lives in `src/bis/local-store.ts`. Key functions:

| Function | Purpose |
|----------|---------|
| `loadCatalog(projectRoot)` | Reads `data/bis/catalog.json`; returns empty catalog if file is missing |
| `saveCatalog(projectRoot, catalog)` | Writes catalog atomically; creates `data/bis/` directory if needed |
| `upsertSet(catalog, entry)` | Returns a new catalog with the entry added or replaced |
| `removeSet(catalog, id)` | Returns a new catalog with the entry removed; also clears any preference pointing to it |
| `setPreference(catalog, job, id)` | Returns a new catalog with the job preference set |
| `clearPreference(catalog, job)` | Returns a new catalog with the job preference removed |
| `makeEntryId(url, setIndex)` | Derives a stable ID from the xivgear page slug + set index |
| `canonicalUrl(url, setIndex)` | Normalizes URL and bakes in `selectedIndex` |

All functions are pure (they return new catalog objects) — the caller is responsible for writing back via `saveCatalog`.
