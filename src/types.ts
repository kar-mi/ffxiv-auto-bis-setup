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
  baseParamModifier: number;
}

/** A full gear snapshot from the packet sniffer, keyed by canonical SlotName. */
export interface GearSnapshot {
  characterId?: number;
  classId?: number;
  items: Partial<Record<SlotName, EquipmentPiece>>;
  capturedAt: string;
}

// ---- Comparison / progression types (ported from Teamcraft) -----------------

/**
 * Tracks whether an individual piece or each of its materia slots still needs upgrading.
 * Ported from Teamcraft's EquipmentPieceProgression.
 */
export interface EquipmentPieceProgression {
  item: boolean;
  materias: boolean[];
}

/**
 * Full upgrade-tracking state across all gear slots.
 * Ported from Teamcraft's GearsetProgression.
 */
export type GearsetProgression = Partial<Record<SlotName, EquipmentPieceProgression>>;

/**
 * Stat and materia diff between two gearsets (e.g. current vs BIS).
 * Ported from Teamcraft's GearsetsComparison.
 */
export interface GearsetComparison {
  statsDifferences: { id: number; values: { a: number; b: number } }[];
  materiasDifferences: { id: number; amounts: { a: number; b: number } }[];
  meldingChances: { a: number; b: number };
  piecesDiff: {
    slot: SlotName;
    a: EquipmentPiece | null;
    b: EquipmentPiece | null;
    stats: { id: number; a: number; b: number }[];
  }[];
}

// ---- Item data types (ported from Teamcraft's LazyItemMeldingData) -----------

/**
 * Materia melding metadata for a specific item ID.
 * Ported from Teamcraft's LazyItemMeldingData (modifier/overmeld/slots fields only).
 */
export interface ItemMeldingData {
  modifier: number;
  overmeld: boolean;
  slots: number;
}
