import { render } from "preact";
import { logger, el } from "./dom.ts";
import { App } from "./render/App.tsx";
import { loadCatalog } from "./bis/catalog.ts";
import { loadGear, loadCachedJobs } from "./gear-load.ts";
import { loadMateriaStats } from "./materia-stats.ts";
import { startPcapStatusPolling } from "./pcap-status.ts";
import { activeTab } from "./state.ts";
import { loadSettings } from "./settings.ts";
import { loadUpgradeItems } from "./render/UpgradesTab.tsx";

logger.info("[app] main.ts loaded");

async function boot(): Promise<void> {
  const settings = await loadSettings();
  activeTab.value = settings.defaultTab;

  render(<App />, el("app-root"));

  void loadCatalog();
  startPcapStatusPolling();
  void loadCachedJobs();
  void loadGear();
  void loadMateriaStats();
  if (settings.defaultTab === "upgrades") void loadUpgradeItems();
}

void boot();
