Repository & Release Strategy Analysis — ffxiv_gear_setup                                                                                                                                                                     
                                    
Context

User asked for an analysis of the repo and its release strategy. This file is the deliverable: a snapshot of how the project ships today, what's working, and where the release pipeline has rough edges. No code changes are
proposed unless the user asks for a follow-up.

Follow-up status (2026-05-01)

The highest-priority release recommendations from this snapshot have been implemented:
- `package.json` now owns the app version, and `electrobun.config.ts` reads it.
- Release tags must match `package.json`'s version.
- Portable ZIP artifacts are versioned as `FFXIVGearSetup-portable-win-x64-v<version>.zip`.
- Portable layout verification moved into `scripts/verify-portable.ts` and is called by both packaging and release CI.
- Release CI now runs `bun test`; pull requests and pushes to `main` run type-check + tests.
- `CHANGELOG.md` tracks user-facing release history and GitHub Releases reference it.
- `README.md` documents the Windows portable-first support target.
- `public/index.html` already uses local `public/styles.css`; no CDN Tailwind reference remains.
- `.github/workflows/release.yml` supports manual `workflow_dispatch` dry runs that build and verify the portable ZIP without creating a GitHub Release. See `docs/RELEASE.md`.

Remaining follow-up:
- Consider pinning the exact Bun version in CI once the project chooses a supported range.

---
1. Repository Overview

Purpose. A web/desktop tool that compares a FFXIV character's currently equipped gear (sniffed live via @ffxiv-teamcraft/pcap-ffxiv) against Best-In-Slot sets imported from xivgear.app / The Balance FFXIV.

Stack.
- Runtime: Bun for the dev server and build pipeline; Node 22 is bundled in the portable build because pcap-ffxiv ships a native .node addon that needs Node, not Bun.
- UI: Preact + @preact/signals, Tailwind 3 (CLI-built), bundled via bun build to public/bundle.js.
- Desktop wrapper: Electrobun 1.16.0 (current branch swap_to_buntralino suggests an in-progress migration from a previous wrapper).
- Language: TypeScript strict, ESNext, ESM.

Size & maturity. ~5K LOC across ~64 source files (50 .ts, 14 .tsx). 8 test files (*.test.ts) covering core logic (capture, comparison, needs, catalog, acquisition, atomic write). No linter. `bun test` is wired and the agent guidance files now reflect it.

Documentation. Solid for a project this size: docs/WORKFLOW.md, BIS-CATALOG.md, ACQUISITION.md, UI-DESIGN.md, teamcraft_packet_sniffer.md, TODO.md, plus a full openapi.yaml for the HTTP API.

Modules undocumented in CLAUDE.md (worth adding when convenient):
- src/acquisition/upgrade-detection.ts
- src/bis/multiset.ts
- src/inventory/counts.ts
- src/util/atomic-write.ts
- src/server/ctx.ts, helpers.ts, routes/*
- UI: Titlebar.tsx, ResizeHandles.tsx, ItemIcon.tsx, MateriaCircles.tsx, SnapshotStatus.tsx, materia-stats.ts

---
2. Release Strategy — How It Ships Today

Trigger: Push a git tag matching v*.*.*. Tags so far: v0.1.0, v0.2.0.

Pipeline: .github/workflows/release.yml (single job, windows-latest):
1. Checkout, setup Bun (latest) + Node 22.
2. bun install
3. bun tsc --noEmit (type-check gate)
4. bun run package:portable → scripts/package-portable.ts
5. PowerShell verification step that asserts the produced ZIP contains a hardcoded list of files (FFXIVAutoBIS.exe, bin/launcher.exe, bin/bun.exe, Resources/main.js, Resources/app/data/materias.json,
Resources/app/dist/pcap-host.cjs, Resources/app/runtime/node/node.exe) and rejects a list of obsolete artifacts.
6. softprops/action-gh-release@v2 uploads artifacts/FFXIVGearSetup-portable-win-x64-v*.zip with auto-generated release notes.

What package:portable actually does (scripts/package-portable.ts):
- Builds the UI (build:ui:prod, minified).
- Builds the pcap host as CommonJS so Node can require it.
- Runs electrobun build --env=stable to produce a zstd-compressed tar payload.
- Extracts and flattens the Electrobun payload into a staging dir.
- Seeds runtime files (Node 22 node.exe, data/materias.json, public assets).
- Compiles a tiny C# launcher (scripts/build-portable-launcher.ps1) into FFXIVAutoBIS.exe.
- Writes a README.txt with paths to user-state files (window-state.json, bis/catalog.json, etc.).
- Zips the staging dir with PowerShell Compress-Archive.

Output: A single versioned Windows x64 portable ZIP (for example, FFXIVGearSetup-portable-win-x64-v0.2.1.zip) attached to a GitHub Release.

---
3. Strengths

- Deterministic gating. Tag-driven release is simple and intentional — no accidental "nightly" pushes.
- Type-check gate before packaging stops obvious breakage.
- Layout assertion step. The pwsh verification block is a real check, not a smoke test — it would catch a regression where the packager silently drops a required file.
- Self-contained artifact. Bundling Node 22 + Bun + native addons + UI bundle into one ZIP means end users don't install runtimes. Good fit for a niche tool whose audience is FFXIV players, not developers.
- Portable-first. No installer, no registry, no admin elevation. Easy to delete; respects users who dislike installed software.
- OpenAPI spec maintained. Means external integrations or a future packaged API stay coherent.

---
4. Gaps & Risks

Listed roughly by severity.

[Resolved] Version drift between sources of truth.
- `package.json` now has the source-of-truth version.
- `electrobun.config.ts` reads that version for app metadata.
- The release workflow validates that the tag matches `package.json`.

[Resolved] Artifact filename has no version.
- Portable ZIPs are now named `FFXIVGearSetup-portable-win-x64-v<version>.zip`.

[Resolved] Brittle layout assertion.
- Required/forbidden portable layout checks now live in `scripts/verify-portable.ts`, next to the packager.
- The packager and release workflow both call the verifier.

[Medium] Single platform.
- runs-on: windows-latest, pcap-ffxiv is Windows-only in practice for this use case (capturing the FFXIV game client), and Electrobun is configured for win-x64. macOS/Linux aren't pursued. That's a defensible product
choice — but it should be stated in the README so downstream forks don't waste time.

[Resolved] No automated testing in CI.
- The release workflow now runs `bun test`.
- `.github/workflows/ci.yml` runs type-check + tests for pull requests and pushes to `main`.

[Resolved] No CHANGELOG.
- `CHANGELOG.md` now exists in a lightweight Keep-a-Changelog style.
- GitHub Releases now include a pointer to the curated changelog alongside auto-generated notes.

[Low] node.exe discovery is environment-dependent.
- findNodeExe() (scripts/package-portable.ts:70-85) prefers PORTABLE_NODE_EXE env var, falls back to where.exe node (i.e. whatever Node is on PATH). On the GitHub runner this is fine because actions/setup-node@v4 with:
node-version: 22 sets PATH — but locally a developer with Node 18 on PATH would silently produce a non-functional portable build. Worth either pinning the Node version explicitly or asserting node --version in the script.

[Low] Electrobun build error swallowing.
- runElectrobunBuild() (scripts/package-portable.ts:29-48) treats a non-zero exit code as success if the payload tar exists and is fresh. This was probably added to work around a known electrobun quirk but it's brittle:
if electrobun starts emitting partial payloads on failure, the packager will happily ship them. Worth a comment naming the specific electrobun bug being worked around so the code can be deleted when fixed upstream.

[Resolved] CDN Tailwind in public/index.html (per docs/TODO.md).
- `public/index.html` already uses local `public/styles.css`; no CDN Tailwind reference remains.

[Resolved] CLAUDE.md says bun test isn't configured but package.json has "test": "bun test".
- `AGENTS.md` and `CLAUDE.md` now both document `bun test`.

---
5. Recommended Improvements (Prioritized)

If the user wants a follow-up plan for any of these, I can produce one. Listed in the order I'd tackle them:

1. Done: Single source of truth for version. `package.json` owns it; Electrobun reads it; CI asserts tag matches.
2. Done: Version the artifact filename as `FFXIVGearSetup-portable-win-x64-v<version>.zip`.
3. Done: Add a pull_request CI workflow running `bun install`, `bun tsc --noEmit`, and `bun test`.
4. Done: Move the layout assertion from release.yml into `scripts/verify-portable.ts`, called by both the packager and release CI.
5. Done: Start a `CHANGELOG.md` and reference it from GitHub release notes.
6. Done: Document Windows-only portable intent in `README.md`.
7. Done: Confirm local Tailwind output only; no CDN Tailwind reference remains in `public/index.html`.
8. Done: Update `CLAUDE.md` module list and the test-runner guidance.

---
6. Critical Files Referenced

- .github/workflows/release.yml
- scripts/package-portable.ts
- scripts/build-portable-launcher.ps1
- electrobun.config.ts
- package.json
- docs/TODO.md
- CLAUDE.md

7. Verification (if any change is later applied)

- bun tsc --noEmit — must pass.
- bun run package:portable locally → unzip artifact → run FFXIVAutoBIS.exe and confirm the app starts, captures a gear snapshot, and loads a saved BIS set.
- Push a throwaway tag (e.g. v0.0.0-test) on a branch to a fork to validate the release workflow end-to-end without polluting the main repo's releases.
