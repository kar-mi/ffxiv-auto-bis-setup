export interface UpgradeItemEntry {
  itemId: number;
  name: string;
  icon: string | null;
  have: number;
}

export interface UpgradeBaseGearEntry {
  slot: string;
  itemId: number;
  name: string;
  icon: string | null;
  haveEquipped: boolean;
  haveInBags: number;
  haveInArmory: number;
}

export interface UpgradeItemsResponse {
  currency:  UpgradeItemEntry[];
  coffers:   UpgradeItemEntry[];
  materials: UpgradeItemEntry[];
  allianceTradeIn?: UpgradeItemEntry[];
  materia?:  UpgradeItemEntry[];
  books:     UpgradeItemEntry[];
  baseGear?: UpgradeBaseGearEntry[];
}
