# Release Testing

This project ships a Windows portable ZIP from `.github/workflows/release.yml`.
Real releases are still tag-driven, but the workflow also supports manual dry
runs from GitHub Actions.

## Manual Dry Run

Use this when you want to test the release pipeline without creating a GitHub
Release.

1. Push the branch that contains the workflow changes.
2. Open GitHub Actions.
3. Select **Build and Release**.
4. Choose **Run workflow**.
5. Select the branch to test.
6. Start the run.

The manual run performs the same build checks as a tag release:

- installs dependencies with Bun
- installs Node 22 for the packet-capture host and portable bundle
- validates TypeScript with `bun tsc --noEmit`
- runs `bun test`
- runs `bun run package:portable`
- runs `bun run verify:portable`

Manual runs intentionally skip release-tag validation and skip the GitHub
Release upload. Instead, they upload a short-lived Actions artifact named
`portable-dry-run-<run-number>` containing the generated portable ZIP.

Download that artifact from the completed workflow run if you want to inspect
the ZIP. It expires after 7 days.

## Real Release

1. Update `package.json` to the new version.
2. Move the matching `CHANGELOG.md` section from `Unreleased` to the release
   date.
3. Run local verification:

   ```bash
   bun tsc --noEmit
   bun test
   bun run package:portable
   bun run verify:portable
   ```

4. Commit the version and changelog changes:

   ```bash
   git status --short
   git add package.json CHANGELOG.md
   git commit -m "chore: release v0.2.2"
   ```

5. Create a tag matching `package.json`, for example `v0.2.2`:

   ```bash
   git tag v0.2.2
   ```

6. Push `main` and the tag:

   ```bash
   git push origin main v0.2.2
   ```

On tag pushes, the workflow validates that `GITHUB_REF_NAME` matches
`package.json`'s version, builds the portable ZIP, verifies its layout, and
uploads `artifacts/FFXIVGearSetup-portable-win-x64-v*.zip` to the GitHub
Release.
