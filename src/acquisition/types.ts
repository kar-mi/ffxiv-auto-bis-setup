// ---- Data file types --------------------------------------------------------

export interface BookDef {
  itemId: number;
  name: string;
}

export interface UpgradeMaterialDef {
  key: string;
  itemId: number;
  name: string;
  /** 0-based index into GearAcquisitionMap.books. */
  bookIndex: number;
  /** Number of books of that edition needed to buy 1 of this material. */
  bookCount: number;
}

/** Acquisition data for one gear slot in the JSON mapping file. */
export interface SlotAcquisition {
  /** Coffer item that can be opened for this slot's raid piece. Omit or 0 = no coffer. */
  cofferItemId?: number;
  /** 0-based index into GearAcquisitionMap.books for the book→raid-piece exchange. */
  bookIndex?: number;
  /** Number of books needed to buy the raid piece. */
  bookCount?: number;
  /** Tomestone cost for the 780 base item. */
  tomeCost?: number;
  /** Must match a key in GearAcquisitionMap.upgradeMaterials. */
  upgradeMaterialKey?: string;
}

export interface GearAcquisitionMap {
  label: string;
  /** Tomestone item ID (e.g., Allagan Tomestone of Aesthetics). 0 = placeholder. */
  tomeId: number;
  tomeName: string;
  /** Offset subtracted from upgradeItemId to derive the 780 base tome item ID. */
  upgradeOffset: number;
  /** iLevel of the base tome piece (e.g. 780). Used to confirm a BIS item is an upgrade-path piece. */
  baseILevel: number;
  books: BookDef[];
  upgradeMaterials: UpgradeMaterialDef[];
  /** Keyed by SlotName string. Missing slots are unknown/not tracked. */
  slots: Partial<Record<string, SlotAcquisition>>;
}

// ---- Computed status types --------------------------------------------------

/** How many of an item the player has vs. how many are needed. */
export interface ItemCount {
  itemId: number;
  name: string;
  have: number;
  need: number;
}

export interface CofferStatus {
  coffer: ItemCount;
  available: boolean;
}

export interface BookExchangeStatus {
  book: ItemCount;
  available: boolean;
}

export interface UpgradeMaterialStatus {
  material: ItemCount;
  available: boolean;
  /** How to get this material via book exchange if not already in bags. */
  bookCost: BookExchangeStatus;
}

export interface BaseItemStatus {
  /** The 780 currency piece — checked in bags AND armory. */
  baseItem: ItemCount;
  haveBase: boolean;
  /** Tomestone cost to purchase the 780 base item. */
  tomes: ItemCount;
  canBuyWithTomes: boolean;
}

export interface UpgradePathStatus {
  upgradeItemId: number;
  base: BaseItemStatus;
  material: UpgradeMaterialStatus;
  /** True if all requirements (base + material) can be satisfied. */
  available: boolean;
}

/** Full acquisition picture for one needed BIS slot. */
export interface SlotAcquisitionStatus {
  slot: string;
  bisItemId: number;
  /** Null when cofferItemId is 0 (placeholder) in the data file. */
  coffer: CofferStatus | null;
  /** Null when book data is missing or book item ID is 0. */
  books: BookExchangeStatus | null;
  /** Null when neither currencyItemId nor upgradeItemId is filled in. */
  upgrade: UpgradePathStatus | null;
  /** True if at least one path is immediately satisfiable from current inventory. */
  canAcquireNow: boolean;
}
