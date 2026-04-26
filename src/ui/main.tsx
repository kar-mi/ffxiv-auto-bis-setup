import type { RaidTier } from "../types.ts";
import { logger, el } from "./dom.ts";
import { state } from "./state.ts";
import { switchTab, switchManageSetsTab } from "./tabs.ts";
import { loadGear } from "./gear-load.ts";
import { closeModal } from "./render/modal.ts";
import { renderUpgradesTab } from "./render/upgrades.ts";
import { loadCatalog, addSetFromUrl, renderSavedSetsTab } from "./bis/catalog.ts";
import { loadBalanceLinksForModal } from "./bis/balance.ts";
import { runComparison, onBisLinkChange, clearComparison } from "./bis/comparison.ts";
import { initResize } from "./window/resize.ts";
import { initWindowControls } from "./window/controls.ts";

logger.info("[app] main.ts loaded");

// ---- Manual add (bridges catalog + tabs, lives here to avoid circular dep) ----

async function confirmManualAdd(): Promise<void> {
  const url = (el("input-xivgear-url") as HTMLInputElement).value.trim();
  if (!url) return;
  const raidTier = (el("sel-manual-tier") as HTMLSelectElement).value as RaidTier;
  const setDefault = (el("chk-manual-default") as HTMLInputElement).checked;

  const btn = el("btn-manual-add") as HTMLButtonElement;
  const statusEl = el("manual-add-status");
  btn.disabled = true;
  btn.textContent = "Adding...";
  statusEl.classList.add("hidden");

  try {
    await addSetFromUrl(url, raidTier, setDefault);
    (el("input-xivgear-url") as HTMLInputElement).value = "";
    statusEl.textContent = "Set added to catalog.";
    statusEl.className = "text-xs text-green-400";
    statusEl.classList.remove("hidden");
    switchManageSetsTab("saved");
    renderSavedSetsTab();
  } catch (err) {
    logger.error(err, "[app] manual add failed");
    statusEl.textContent = (err as Error)?.message ?? String(err);
    statusEl.className = "text-xs text-red-400";
    statusEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Add Set";
  }
}

// ---- Event listeners ----

el("sel-bis-link").addEventListener("change", onBisLinkChange);

el("sel-bis-job-filter").addEventListener("change", () => {
  state.bisJobFilter = (el("sel-bis-job-filter") as HTMLSelectElement).value;
  renderSavedSetsTab();
});

el("btn-compare").addEventListener("click",       () => { void runComparison(); });
el("btn-manage-sets").addEventListener("click",   () => switchTab("bis"));
el("btn-clear-compare").addEventListener("click", clearComparison);
el("btn-manual-add").addEventListener("click",    () => { void confirmManualAdd(); });
el("btn-load-balance").addEventListener("click",  () => { void loadBalanceLinksForModal(); });
el("btn-refresh").addEventListener("click",         () => { void loadGear(); });
el("btn-refresh-upgrades").addEventListener("click", () => { void renderUpgradesTab(); });

el("tab-btn-saved").addEventListener("click",   () => switchManageSetsTab("saved"));
el("tab-btn-manual").addEventListener("click",  () => switchManageSetsTab("manual"));
el("tab-btn-balance").addEventListener("click", () => switchManageSetsTab("balance"));

document.querySelectorAll<HTMLElement>(".main-tab-btn").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset["tab"] ?? "gear"));
});

el("modal-close").addEventListener("click", closeModal);
el("compare-modal").addEventListener("click", e => {
  if (e.target === el("compare-modal")) closeModal();
});

// ---- Init ----

initWindowControls();
initResize();

void loadCatalog();
void loadGear();
