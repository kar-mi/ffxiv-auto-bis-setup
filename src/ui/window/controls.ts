import { el } from "../dom.ts";

export function initWindowControls(): void {
  el("btn-win-close").addEventListener("click",    () => { void fetch("/window/close",    { method: "POST" }); });
  el("btn-win-minimize").addEventListener("click", () => { void fetch("/window/minimize", { method: "POST" }); });
  el("btn-win-maximize").addEventListener("click", () => { void fetch("/window/maximize", { method: "POST" }); });

  const settingsModal = el("settings-modal");
  el("btn-settings").addEventListener("click", () => { settingsModal.classList.remove("hidden"); });
  el("settings-modal-close").addEventListener("click", () => { settingsModal.classList.add("hidden"); });
  settingsModal.addEventListener("click", e => {
    if (e.target === settingsModal) settingsModal.classList.add("hidden");
  });
}
