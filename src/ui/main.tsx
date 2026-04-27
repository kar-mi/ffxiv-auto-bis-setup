import { render } from "preact";
import { logger, el } from "./dom.ts";
import { App } from "./render/App.tsx";
import { loadCatalog } from "./bis/catalog.ts";
import { loadGear, loadCachedJobs } from "./gear-load.ts";
import { initResize } from "./window/resize.ts";
import { initWindowControls } from "./window/controls.ts";

logger.info("[app] main.ts loaded");

initWindowControls();
initResize();
render(<App />, el("app-root"));

void loadCatalog();
void loadCachedJobs();
void loadGear();
