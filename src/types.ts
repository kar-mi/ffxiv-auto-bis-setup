/**
 * Canonical gear slot names.
 * Matches @ffxiv-teamcraft/pcap-ffxiv packet field naming and Teamcraft's getPropertyName().
 *
 * Note: `belt` was removed from FFXIV in Endwalker but is retained here because packet
 * slot index 5 still exists. It is excluded from all comparison and display logic and
 * will never appear in a BisGearSet.
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

// ---- Inventory types --------------------------------------------------------

/** A single item stack in a player inventory container. */
export interface InventoryItem {
  itemId: number;
  quantity: number;
  hq: boolean;
  containerId: number;
  slot: number;
}

/** A snapshot of the player's bag and currency/crystal inventory. */
export interface InventorySnapshot {
  characterId?: number;
  /** All known items across player bags (containers 0–3) and crystals (container 2000). */
  items: InventoryItem[];
  capturedAt: string;
}

// ---- Needs types ------------------------------------------------------------

/** A slot where the player needs to obtain a different item. */
export interface ItemNeed {
  slot: SlotName;
  reason: 'wrong-item' | 'missing';
  bisItemId: number;
  equippedItemId?: number;
  /** How many of this BIS item the player already has in their bags. */
  quantityInBags: number;
}

/** A slot where the correct item is equipped but materia needs to change. */
export interface MateriaChange {
  slot: SlotName;
  bisItemId: number;
  /** Materia item IDs in BIS but not equipped — need to be added. */
  toAdd: number[];
  /** Materia item IDs equipped but not in BIS — need to be removed first. */
  toRemove: number[];
  /** For each materia in toAdd, how many the player has in bags. */
  quantityInBags: Record<number, number>;
}

/** What a player needs to acquire or re-meld to complete a BIS set. */
export interface GearNeeds {
  itemNeeds: ItemNeed[];
  materiaChanges: MateriaChange[];
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

