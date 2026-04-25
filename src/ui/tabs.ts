import { el } from "./dom.ts";
import { state } from "./state.ts";
import { loadCatalog, renderSavedSetsTab } from "./bis/catalog.ts";
import { renderUpgradesTab } from "./render/upgrades.ts";
import { renderAcquisitionPanel } from "./render/acquisition.ts";

const MAIN_TABS   = ["gear", "bis", "upgrades", "acquisition"] as const;
const MANAGE_TABS = ["saved", "manual", "balance"] as const;

type MainTab   = typeof MAIN_TABS[number];
type ManageTab = typeof MANAGE_TABS[number];

export function switchTab(name: string): void {
  state.activeTab = name;
  for (const t of MAIN_TABS) {
    const isActive = t === name;
    el(`main-tab-${t}`).classList.toggle("hidden", !isActive);
    const btn = el(`main-tab-btn-${t}`);
    btn.classList.toggle("text-gray-200",      isActive);
    btn.classList.toggle("border-ffxiv-gold",  isActive);
    btn.classList.toggle("text-gray-500",      !isActive);
    btn.classList.toggle("border-transparent", !isActive);
  }
  if (name === "bis") {
    if (!state.currentCatalog) void loadCatalog().then(() => renderSavedSetsTab());
    else renderSavedSetsTab();
  }
  if (name === "upgrades")    void renderUpgradesTab();
  if (name === "acquisition") renderAcquisitionPanel();
}

export function switchManageSetsTab(tab: string): void {
  for (const t of MANAGE_TABS) {
    const isActive = t === tab;
    const panel = el(`tab-panel-${t}`);
    panel.classList.toggle("hidden", !isActive);
    panel.classList.toggle("flex",   isActive);
    const btn = el(`tab-btn-${t}`);
    btn.classList.toggle("text-gray-200",      isActive);
    btn.classList.toggle("border-ffxiv-gold",  isActive);
    btn.classList.toggle("text-gray-500",      !isActive);
    btn.classList.toggle("border-transparent", !isActive);
  }
}

// Suppress unused-type warnings — these are kept for documentation.
export type { MainTab, ManageTab };
