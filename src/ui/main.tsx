import { render } from "preact";
import { logger, el } from "./dom.ts";
import { App } from "./render/App.tsx";
import { loadCatalog } from "./bis/catalog.ts";
import { loadGear, loadCachedJobs } from "./gear-load.ts";
import { loadMateriaStats } from "./materia-stats.ts";
import { startPcapStatusPolling } from "./pcap-status.ts";

logger.info("[app] main.ts loaded");

render(<App />, el("app-root"));

void loadCatalog();
startPcapStatusPolling();
void loadCachedJobs();
void loadGear();
void loadMateriaStats();
