# Preact Migration Plan

Migrating the UI from static HTML + imperative DOM manipulation to Preact components with `@preact/signals` for reactive state.

## Motivation

- Tab shells are hardcoded in `public/index.html`; TypeScript drives them by fragile string IDs
- `innerHTML` template literals have no type safety and embed unsanitised strings
- Post-render `querySelectorAll` loops attach events after the fact
- Global `state` object is mutated directly by every module with no reactivity

## Tech choices

- **Preact** — 3 KB runtime, identical API to React, first-class TypeScript/JSX support
- **`@preact/signals`** — reactive primitives that work inside and outside components; fits the existing async fetch → update flow without restructuring around `useEffect`
- **No additional state library** — signals replace the `state` object directly

---

## Phase 1 — Foundation

- `bun add preact @preact/signals`
- `tsconfig.json`: add `"jsx": "react-jsx"` and `"jsxImportSource": "preact"`
- `package.json`: update `build:ui` entry point to `src/ui/main.tsx`
- Rename `src/ui/main.ts` → `src/ui/main.tsx`
- Verify `bun run build:ui` produces a working bundle

## Phase 2 — State → signals

Convert `state.ts` from a plain mutable object to `@preact/signals`.

- Each property becomes `signal<T>(initialValue)`
- `mergedItemDataMap()` becomes a `computed()`
- Export names stay identical so existing modules compile without changes
- Async fetch functions (`loadGear`, `runComparison`) update signals directly — no `useEffect` needed

## Phase 3 — Tab components, leaf-first

Replace each `innerHTML`-writing render function with a `.tsx` component rendered into the existing container div. Least-coupled first:

| Order | Component | Replaces | Signals consumed |
|-------|-----------|----------|-----------------|
| 1 | `<UpgradesTab />` | `renderUpgradesTab()` | none (fetches own data) |
| 2 | `<AcquisitionTab />` | `renderAcquisitionPanel()` | `acquisitionData` |
| 3 | `<GearTab />` | `renderGear()` | `currentSnapshot`, `comparisonData` |
| 4 | `<BisTab />` | `renderSavedSetsTab()`, `loadBalanceLinksForModal()` | `currentCatalog`, `currentJobAbbrev` |

Each component owns its event handlers inline in JSX — no post-render `querySelectorAll` loops.

## Phase 4 — Modals

- `<CompareModal />` — controlled by `selectedSlot = signal<SlotName | null>(null)`; replaces `openCompareModal()` / `closeModal()`
- `<SettingsModal />` — straightforward conversion, already trivial

## Phase 5 — Tab bar + app root

- `<TabBar />` driven by `activeTab` signal; replaces `switchTab()` and class-toggling in `tabs.ts`
- `<App />` root component assembles all tabs and modals; rendered into `#app-shell` from `main.tsx`
- Strip tab panel `<div>` blocks from `index.html` — they become empty mount points, then disappear once `<App />` renders the full content area

## Phase 6 — Cleanup

- Delete `tabs.ts` (absorbed into `<TabBar />`)
- Slim `dom.ts` — `el()` / `setStatus()` no longer needed once components own their DOM
- Update `docs/WORKFLOW.md` — UI Path diagram and module map
- Update `CLAUDE.md` — stack section and module list
- Remove "Component rendering" row from `docs/TODO.md`

---

## Key invariants

- Each phase produces a working build — no big-bang rewrite
- XSS fix is a natural byproduct — JSX escapes interpolated values; template-literal `innerHTML` does not
- `.tsx` extension only on files that contain JSX markup; pure logic/types stay `.ts`
- `<Type>value` cast syntax is banned in `.tsx` — use `value as Type` (already the codebase standard)
