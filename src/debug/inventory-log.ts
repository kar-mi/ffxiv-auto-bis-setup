/**
 * Debug logging for inventory snapshots.
 * Enabled by setting INVENTORY_LOG=1 in the environment.
 * Writes newline-delimited JSON to logs/inventory.jsonl in the project root.
 *
 * Each line is one complete InventorySnapshot so you can track what changed
 * over time and look up item IDs for items you know you have in-game.
 */

import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { InventorySnapshot } from '../types.ts';

export const INVENTORY_LOG_ENABLED = process.env['INVENTORY_LOG'] === '1';

const LOG_PATH = path.join(process.cwd(), 'logs', 'inventory.jsonl');
let dirReady = false;

async function ensureDir(): Promise<void> {
  if (dirReady) return;
  await mkdir(path.dirname(LOG_PATH), { recursive: true });
  dirReady = true;
}

export async function logInventorySnapshot(snapshot: InventorySnapshot): Promise<void> {
  if (!INVENTORY_LOG_ENABLED) return;
  try {
    await ensureDir();
    await appendFile(LOG_PATH, JSON.stringify(snapshot) + '\n', 'utf-8');
  } catch (err) {
    console.error('[inventory-log] Failed to write log:', err);
  }
}
