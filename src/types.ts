/**
 * Canonical gear slot names.
 * Matches @ffxiv-teamcraft/pcap-ffxiv packet field naming and Teamcraft's getPropertyName().
 */
export type SlotName =
  | 'mainHand' | 'offHand'
  | 'head' | 'chest' | 'gloves' | 'belt' | 'legs' | 'feet'
  | 'earRings' | 'necklace' | 'bracelet' | 'ring1' | 'ring2'
  | 'crystal';

/** Maps packet slot index → canonical SlotName. Matches Teamcraft's getPropertyName(). */
export const SLOT_NAMES: Record<number, SlotName> = {
  0:  'mainHand',
  1:  'offHand',
  2:  'head',
  3:  'chest',
  4:  'gloves',
  5:  'belt',   // removed in Endwalker; kept for packet completeness
  6:  'legs',
  7:  'feet',
  8:  'earRings',
  9:  'necklace',
  10: 'bracelet',
  11: 'ring2',
  12: 'ring1',
  13: 'crystal',
};

// ---- Packet capture types ---------------------------------------------------

/**
 * A single equipped item captured from game packets.
 * Ported from Teamcraft's EquipmentPiece interface.
 */
export interface EquipmentPiece {
  itemId: number;
  hq: boolean;
  /** Resolved materia item IDs (0 = empty slot). Requires materia resolution via resolveMateriaItemId(). */
  materias: number[];
  materiaSlots: number;
  canOvermeld: boolean;
}

/** A full gear snapshot from the packet sniffer, keyed by canonical SlotName. */
export interface GearSnapshot {
  characterId?: number;
  classId?: number;
  items: Partial<Record<SlotName, EquipmentPiece>>;
  capturedAt: string;
}

// ---- BIS types --------------------------------------------------------------

/** A single BIS item from xivgear.app */
export interface BisItem {
  itemId: number;
  slot: SlotName;
  /** Materia item IDs for this slot (0 = empty). */
  materias: number[];
}

/** A normalized BIS gear set fetched from xivgear.app */
export interface BisGearSet {
  name: string;
  job: string;
  items: Partial<Record<SlotName, BisItem>>;
  foodId?: number;
  /** The xivgear.app URL this set was fetched from. */
  source: string;
}

/** A labeled xivgear.app link scraped from The Balance. */
export interface BisLink {
  label: string;
  url: string;
}

// ---- Comparison types -------------------------------------------------------

export type SlotStatus = 'match' | 'wrong-item' | 'wrong-materia' | 'missing' | 'bis-empty';

export interface SlotComparison {
  slot: SlotName;
  status: SlotStatus;
  equippedItemId?: number;
  bisItemId?: number;
  equippedMaterias?: number[];
  bisMaterias?: number[];
}

export interface GearsetComparison {
  slots: SlotComparison[];
  matchCount: number;
  wrongItemCount: number;
  wrongMateriaCount: number;
  missingCount: number;
}

