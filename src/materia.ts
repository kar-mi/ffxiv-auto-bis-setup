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

/**
 * Resolves a raw packet materia type + tier to an FFXIV item ID.
 *
 * Packet materia fields:
 *   - `packetMateriaId` — the materia type (stat category)
 *   - `packetTier`      — 0-indexed tier from the packet (add 1 to match data tier)
 *
 * Returns 0 if no match is found (empty or unknown slot).
 *
 * Usage: call once per materia slot when processing itemInfo packets that include
 * `materia[]` and `materiaTiers[]` arrays.
 */
export function resolveMateriaItemId(
  packetMateriaId: number,
  packetTier: number,
  materiaData: MateriaEntry[],
): number {
  return materiaData.find(
    m => m.id === packetMateriaId && m.tier === packetTier + 1,
  )?.itemId ?? 0;
}
