# Changelog

All notable changes to this project will be documented in this file.

This project follows a lightweight [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) style. Release tags use `vMAJOR.MINOR.PATCH` and should match `package.json`.

## [0.2.3] - 2026-05-01

### Added
- Bundled materia resolution data for portable releases.

### Fixed
- Portable release builds now keep required materia data in the packaged app.
- Release and CI workflow build issues from the `0.2.2` release follow-up.

## [0.2.2] - 2026-05-01

### Added
- Pull request CI for type-checking and the Bun test suite.
- Versioned Windows portable artifact names.
- Reusable portable ZIP layout verification script.

### Changed
- `package.json` is the source of truth for app/package version metadata.
- Release tags are validated against `package.json` before packaging.

## [0.2.0] - 2026-05-01

### Added
- Windows portable packaging with bundled runtime assets and top-level launcher.
- Custom frameless desktop chrome and resize handling.
- Gear/inventory snapshot cache support.

### Changed
- Production UI builds use local Tailwind CLI output and a bundled frontend asset.

## [0.1.0] - 2026-04-30

### Added
- Initial desktop/web app foundation for FFXIV BIS comparison.
