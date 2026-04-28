import type { GearSnapshot, InventorySnapshot } from '../types.ts';

export interface WindowControls {
  minimize(): void;
  maximize(): void;
  close(): void;
  getFrame(): { x: number; y: number; width: number; height: number };
  setFrame(x: number, y: number, width: number, height: number): void;
}

export interface ServerCtx {
  projectRoot: string;
  getLatestPcapGear(): GearSnapshot | null;
  setLatestPcapGear(snap: GearSnapshot): void;
  getSelectedGear(): GearSnapshot | null;
  setSelectedGear(snap: GearSnapshot): void;
  getLatestInventory(): InventorySnapshot | null;
  setLatestInventory(snap: InventorySnapshot): void;
  isGearLive(): boolean;
  isInventoryLive(): boolean;
  windowControls: WindowControls;
}
