import { el } from "../dom.ts";
import { settingsOpen } from "../render/SettingsModal.tsx";

export function initWindowControls(): void {
  el("btn-win-close").addEventListener("click",    () => { void fetch("/window/close",    { method: "POST" }); });
  el("btn-win-minimize").addEventListener("click", () => { void fetch("/window/minimize", { method: "POST" }); });
  el("btn-win-maximize").addEventListener("click", () => { void fetch("/window/maximize", { method: "POST" }); });

  el("btn-settings").addEventListener("click", () => { settingsOpen.value = true; });
}
