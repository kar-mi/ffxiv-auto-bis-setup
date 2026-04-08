/**
 * Locates FFXIV's per-character data directory so ITEMODR.DAT can be read.
 *
 * Default paths (overridable via FFXIV_DATA_DIR env var):
 *   Global:  %USERPROFILE%\Documents\My Games\FINAL FANTASY XIV - A Realm Reborn
 *   KR:      %USERPROFILE%\Documents\My Games\FINAL FANTASY XIV - KOREA
 *   CN:      C:\Program Files (x86)\...\My Games\FINAL FANTASY XIV - A Realm Reborn
 */

import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const CHR_PATTERN = /^FFXIV_CHR/i;

/** Returns the root FFXIV user-data directory (contains FFXIV_CHR* subdirs). */
export function getFfxivDataDir(): string {
  const override = process.env['FFXIV_DATA_DIR'];
  if (override) return override;
  // Default: Global client on Windows
  return path.join(os.homedir(), 'Documents', 'My Games', 'FINAL FANTASY XIV - A Realm Reborn');
}

/**
 * Finds the ITEMODR.DAT path for the active character.
 *
 * - If exactly one FFXIV_CHR* directory exists, uses it.
 * - If multiple exist (multi-character), picks the one whose ITEMODR.DAT was
 *   most recently modified (i.e. the character the player was last on).
 *
 * Returns null if the directory cannot be read or no FFXIV_CHR* folders exist.
 */
export async function findItemodrPath(dataDir: string): Promise<string | null> {
  let entries: string[];
  try {
    entries = await readdir(dataDir);
  } catch {
    return null;
  }

  const chrDirs = entries.filter(e => CHR_PATTERN.test(e));
  if (chrDirs.length === 0) return null;

  if (chrDirs.length === 1) {
    return path.join(dataDir, chrDirs[0], 'ITEMODR.DAT');
  }

  // Multiple characters: pick the most recently touched ITEMODR.DAT
  let best: { filePath: string; mtime: number } | null = null;
  for (const dir of chrDirs) {
    const filePath = path.join(dataDir, dir, 'ITEMODR.DAT');
    try {
      const s = await stat(filePath);
      if (!best || s.mtimeMs > best.mtime) {
        best = { filePath, mtime: s.mtimeMs };
      }
    } catch {
      // File doesn't exist for this character — skip
    }
  }
  return best?.filePath ?? null;
}
