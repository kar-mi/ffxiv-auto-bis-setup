import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { GearAcquisitionMap } from './types.ts';

interface RaidIndex {
  activeTier: string;
  tiers: { key: string; label: string; fullName: string }[];
}

let cached: GearAcquisitionMap | null = null;

export async function loadGearAcquisitionMap(projectRoot: string): Promise<GearAcquisitionMap> {
  if (cached) return cached;
  const indexPath = path.join(projectRoot, 'raidinfo', 'index.json');
  const { activeTier } = JSON.parse(await readFile(indexPath, 'utf-8')) as RaidIndex;
  const mapPath = path.join(projectRoot, 'raidinfo', activeTier, 'gear-acquisition.json');
  cached = JSON.parse(await readFile(mapPath, 'utf-8')) as GearAcquisitionMap;
  return cached;
}
