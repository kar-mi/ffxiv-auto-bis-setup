export interface UpgradeItemEntry {
  itemId: number;
  name: string;
  icon: string | null;
  have: number;
}

export interface UpgradeItemsResponse {
  currency:  UpgradeItemEntry[];
  coffers:   UpgradeItemEntry[];
  materials: UpgradeItemEntry[];
  books:     UpgradeItemEntry[];
}
