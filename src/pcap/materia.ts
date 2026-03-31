/**
 * Materia resolution utilities.
 * Ported from Teamcraft's MateriaService.getMateriaItemIdFromPacketMateria().
 */

/** Minimal materia entry shape needed for packet resolution. */
export interface MateriaEntry {
  /** Materia type ID as sent in the itemInfo packet. */
  id: number;
  /** Tier (1-indexed) as stored in the data source. */
  tier: number;
  /** FFXIV item ID for this type+tier combination. */
  itemId: number;
}

/** Pre-built lookup map from `"${id},${tier}"` → itemId for O(1) resolution. */
export type MateriaLookup = Map<string, number>;

export function buildMateriaLookup(materiaData: MateriaEntry[]): MateriaLookup {
  const map: MateriaLookup = new Map();
  for (const { id, tier, itemId } of materiaData) {
    map.set(`${id},${tier}`, itemId);
  }
  return map;
}

/**
 * Resolves a raw packet materia type + tier to an FFXIV item ID.
 *
 * Packet materia fields:
 *   - `packetMateriaId` — the materia type (stat category)
 *   - `packetTier`      — 0-indexed tier from the packet (add 1 to match data tier)
 *
 * Returns 0 if no match is found (empty or unknown slot).
 *
 * Usage: build a lookup once with buildMateriaLookup(), then call this per slot.
 */
export function resolveMateriaItemId(
  packetMateriaId: number,
  packetTier: number,
  lookup: MateriaLookup,
): number {
  return lookup.get(`${packetMateriaId},${packetTier + 1}`) ?? 0;
}
