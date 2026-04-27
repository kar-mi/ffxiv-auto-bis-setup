# Post-HTML→TSX Migration: Cleanup & Optimization Plan

## Status legend
- [ ] pending
- [x] done

---

## 1. Convert `ui/bis/balance.ts` to a signal-driven Preact component

**Files:** `src/ui/bis/balance.ts`, `src/ui/render/App.tsx`

The only module not migrated during the HTML→TSX transition. It writes `innerHTML`
and attaches `addEventListener` against three hard-coded element IDs
(`balance-links-list`, `btn-load-balance`, `sel-balance-tier`) that `App.tsx`
creates as dumb placeholder elements. The other two sub-tabs in the same panel
("Saved Sets", "Paste URL") are fully declarative Preact.

**Action:** Add signals (`balanceLinks`, `balanceLoading`, `balanceError`) inside
`balance.ts`, replace the imperative function body with signal mutations, then
replace the three ID-bearing elements in `App.tsx`'s `BisTabPanel` with a reactive
component. Remove `id=` props from those three elements. Potentially remove the
`el()` export from `dom.ts` if no other callers remain.

---

## 2. Merge duplicate import in `balance.ts` [x]

**File:** `src/ui/bis/balance.ts:2-3`

`API_BASE` and `JOBS` are imported from `../constants.ts` in two separate lines.
Merge into one `import { API_BASE, JOBS } from "../constants.ts"`.

---

## 3. Fix `buildBagCounts` / `buildCounts` inconsistency [x]

**Files:** `src/bis/needs.ts:67`, `src/acquisition/compute.ts:14`

Both functions build a `Map<itemId, totalQuantity>` from inventory, but `compute.ts`
filters out `itemId === 0 || quantity === 0` sentinel values while `needs.ts` does
not. If inventory contains sentinels, `needs.ts` over-counts.

**Action:** Add the same guard (`if (item.itemId === 0 || item.quantity === 0) continue`)
to `needs.ts`'s `buildBagCounts`, or extract a single shared helper into a utility
module that both files import.

---

## 4. Remove `state` compat shim from `state.ts` [ ]

**File:** `src/ui/state.ts`

`state.ts` exports both named signals (`currentSnapshot`, etc.) and a `state`
object wrapping them all with getters/setters so non-component modules can write
`state.X = v` instead of `currentSnapshot.value = v`. After #1 is done, all callers
(`gear-load.ts`, `bis/comparison.ts`, `bis/catalog.ts`) can be migrated to named
signals directly and the shim (~20 lines) removed.

**Dependency:** Complete #1 first, then migrate remaining callers.
