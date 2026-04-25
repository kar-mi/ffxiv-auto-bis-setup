import { SLOT_LABELS } from "../constants.ts";
import { el } from "../dom.ts";
import { state } from "../state.ts";
import { openCompareModal } from "./modal.ts";

export function pill(text: string, ready: boolean): string {
  const cls = ready ? "text-green-400 border-green-700/70" : "text-gray-500 border-ffxiv-border";
  return `<span class="px-1.5 py-0.5 text-[10px] border rounded ${cls}">${text}</span>`;
}

export function renderAcquisitionPanel(): void {
  const summaryEl = el("acquisition-summary");
  const listEl    = el("acquisition-list");

  if (!state.acquisitionData || state.acquisitionData.length === 0) {
    summaryEl.innerHTML = "";
    listEl.innerHTML = `<p class="text-xs text-gray-500 italic">No data yet — load gear and run a BIS comparison first.</p>`;
    return;
  }

  const canNow = state.acquisitionData.filter(s => s.canAcquireNow).length;
  const total  = state.acquisitionData.length;
  summaryEl.innerHTML =
    `<span class="text-gray-300">${total} slot${total !== 1 ? "s" : ""} need a new item</span>` +
    (canNow > 0 ? `<span class="ml-2 text-green-400">&mdash; ${canNow} can acquire now</span>` : "");

  listEl.innerHTML = state.acquisitionData.map(s => {
    const label = SLOT_LABELS[s.slot] ?? s.slot;
    const pills: string[] = [];

    if (s.coffer) {
      pills.push(pill(s.coffer.available ? "Coffer ready" : "Coffer", s.coffer.available));
    }
    if (s.books) {
      const ok = s.books.available;
      pills.push(pill(ok ? "Books ready" : `Books ${s.books.book.have}/${s.books.book.need}`, ok));
    }
    if (s.upgrade) {
      pills.push(pill(s.upgrade.available ? "Upgrade ready" : "Upgrade", s.upgrade.available));
    }
    if (pills.length === 0) {
      pills.push(`<span class="text-[10px] text-gray-600 italic">No data yet</span>`);
    }

    return `
      <div class="flex items-center gap-3 bg-ffxiv-panel border border-ffxiv-border rounded px-3 py-2 cursor-pointer hover:border-ffxiv-gold transition-colors" data-acq-slot="${s.slot}">
        <span class="text-xs text-gray-300 w-20 flex-shrink-0">${label}</span>
        <div class="flex gap-1.5 flex-wrap">${pills.join("")}</div>
      </div>`;
  }).join("");

  listEl.querySelectorAll<HTMLElement>("[data-acq-slot]").forEach(row => {
    row.addEventListener("click", () => {
      if (row.dataset["acqSlot"]) openCompareModal(row.dataset["acqSlot"]);
    });
  });
}
