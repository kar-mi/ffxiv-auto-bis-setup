import type { BisLink } from "../../types.ts";
import { API_BASE, JOBS } from "../constants.ts";
import { el, logger } from "../dom.ts";
import { state } from "../state.ts";
import { addSetFromUrl } from "./catalog.ts";

export async function loadBalanceLinksForModal(): Promise<void> {
  const list = el("balance-links-list");
  if (!state.currentJobAbbrev) {
    list.innerHTML = `<p class="text-xs text-gray-500 italic">Load gear first to detect your job.</p>`;
    return;
  }
  const job = JOBS.find(j => j.abbrev === state.currentJobAbbrev);
  if (!job) return;

  const btn = el("btn-load-balance") as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = "Loading...";
  list.innerHTML = "";

  try {
    const res = await fetch(`${API_BASE}/balance/${job.role}/${job.job}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const links = await res.json() as BisLink[];

    if (!links.length) {
      list.innerHTML = `<p class="text-xs text-gray-500 italic">No sets found for ${job.label}.</p>`;
      return;
    }

    const savedUrls = new Set((state.currentCatalog?.sets ?? []).map(e => e.url));
    list.innerHTML = links.map(link => {
      const saved = savedUrls.has(link.url);
      return `
        <div class="flex items-center gap-2 bg-ffxiv-dark border border-ffxiv-border rounded px-3 py-2">
          <span class="text-xs text-gray-200 flex-1 truncate" title="${link.url}">${link.label}</span>
          ${saved
            ? `<span class="text-[10px] text-gray-500 border border-ffxiv-border rounded px-1.5 py-0.5 flex-shrink-0">Saved</span>`
            : `<button class="text-[10px] text-gray-400 hover:text-ffxiv-gold px-2 py-0.5 border border-ffxiv-border rounded transition-colors flex-shrink-0"
                       data-balance-url="${link.url}">Add</button>`}
        </div>`;
    }).join("");

    list.querySelectorAll<HTMLButtonElement>("[data-balance-url]").forEach(addBtn => {
      addBtn.addEventListener("click", async () => {
        const url = addBtn.dataset["balanceUrl"]!;
        const raidTier = (el("sel-balance-tier") as HTMLSelectElement).value;
        addBtn.disabled = true;
        addBtn.textContent = "Adding...";
        try {
          await addSetFromUrl(url, raidTier, false);
          addBtn.textContent = "Saved ✓";
          addBtn.className = "text-[10px] text-green-400 px-2 py-0.5 border border-green-800/50 rounded flex-shrink-0";
        } catch (err) {
          logger.error(err, "[app] balance add failed");
          addBtn.textContent = "Error";
          addBtn.className = "text-[10px] text-red-400 px-2 py-0.5 border border-red-800 rounded flex-shrink-0";
          addBtn.disabled = false;
        }
      });
    });
  } catch (err) {
    list.innerHTML = `<p class="text-xs text-red-400">Failed to load: ${(err as Error)?.message ?? String(err)}</p>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Load from The Balance";
  }
}
