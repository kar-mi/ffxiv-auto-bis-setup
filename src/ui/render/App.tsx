import { signal } from "@preact/signals";
import type { RaidTier } from "../../types.ts";
import { RAID_TIER_LABELS } from "../../types.ts";
import { logger } from "../dom.ts";
import {
  activeTab,
  bisLinkEntries, bisLinkVisible, bisLinkUrl,
  compareVisible, clearVisible,
  statusMsg, statusIsError,
  currentJobAbbrev, cachedJobs,
} from "../state.ts";
import { loadGear, loadGearForClassId } from "../gear-load.ts";
import { runComparison, clearComparison } from "../bis/comparison.ts";
import { JOBS, JOB_ABBREV_TO_CLASS_ID } from "../constants.ts";
import { addSetFromUrl } from "../bis/catalog.ts";
import {
  balanceTier, balanceLoading, balanceLinks, balanceError, balanceJobAbbrev,
  loadBalanceLinks, addBalanceLink,
} from "../bis/balance.ts";
import { loadUpgradeItems, UpgradesTab } from "./UpgradesTab.tsx";
import { AcquisitionTab } from "./AcquisitionTab.tsx";
import { GearTab } from "./GearTab.tsx";
import { SavedSetsTab } from "./BisTab.tsx";
import { CompareModal } from "./CompareModal.tsx";
import { SettingsModal } from "./SettingsModal.tsx";
import { Corners } from "../components/Corners.tsx";
import { SnapshotStatus } from "../components/SnapshotStatus.tsx";

// ---- Sub-tab and manual-add form state (local to this module) ---------------

type ManageTab = "saved" | "manual" | "balance";
const manageSetsTab    = signal<ManageTab>("saved");
const manualUrl        = signal("");
const manualTier       = signal<RaidTier>("aac_hw");
const manualSetDefault = signal(true);
const manualAdding     = signal(false);
const manualStatusText = signal("");
const manualStatusOk   = signal(false);

const TIER_ORDER: RaidTier[] = ["aac_hw", "aac_mw", "aac_lw", "ultimate", "criterion", "other"];

async function confirmManualAdd(): Promise<void> {
  const url = manualUrl.value.trim();
  if (!url) return;
  manualAdding.value     = true;
  manualStatusText.value = "";
  try {
    await addSetFromUrl(url, manualTier.value, manualSetDefault.value);
    manualUrl.value        = "";
    manualStatusText.value = "Set added to catalog.";
    manualStatusOk.value   = true;
    manageSetsTab.value    = "saved";
  } catch (err) {
    logger.error(err, "[app] manual add failed");
    manualStatusText.value = (err as Error)?.message ?? String(err);
    manualStatusOk.value   = false;
  } finally {
    manualAdding.value = false;
  }
}

// ---- Shared tier options ----------------------------------------------------

function TierOptions() {
  return (
    <>
      {TIER_ORDER.map(v => <option key={v} value={v}>{RAID_TIER_LABELS[v]}</option>)}
    </>
  );
}

// ---- Tab bar ----------------------------------------------------------------

const MAIN_TABS: { id: string; label: string; onActivate?: () => void }[] = [
  { id: "gear",        label: "Gear" },
  { id: "bis",         label: "BIS Sets" },
  { id: "upgrades",    label: "Items",    onActivate: () => void loadUpgradeItems() },
  { id: "acquisition", label: "Upgrades" },
];

const MANAGE_TABS: { id: ManageTab; label: string }[] = [
  { id: "saved",   label: "Saved Sets" },
  { id: "manual",  label: "Paste URL"  },
  { id: "balance", label: "The Balance" },
];

function TabBar() {
  const current = activeTab.value;
  return (
    <div
      class="shrink-0 flex justify-center border-b border-ffxiv-border bg-ffxiv-panel"
      style={{ borderBottomColor: "rgba(200,168,75,0.15)" }}
    >
      {MAIN_TABS.map(({ id, label, onActivate }) => {
        const isActive = current === id;
        return (
          <button
            key={id}
            class={`px-4 h-8 text-xs border-b-2 -mb-px font-cinzel tracking-wide transition-colors ${
              isActive
                ? "border-ffxiv-gold text-gray-200"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
            onClick={() => { activeTab.value = id; onActivate?.(); }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ---- Tab panels -------------------------------------------------------------

function GearTabPanel() {
  const isActive = activeTab.value === "gear";
  return (
    <div class={isActive ? "max-w-3xl mx-auto px-4 py-6" : "hidden"}>
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="font-cinzel text-3xl font-bold text-ffxiv-gold tracking-wide">FFXIV Gear Setup</h1>
          <p class="text-gray-400 text-sm mt-1">Gear captured from the game client</p>
        </div>
        <button
          class="relative px-4 py-2 text-sm rounded bg-ffxiv-panel border border-ffxiv-border text-gray-300 hover:border-ffxiv-gold hover:text-ffxiv-gold transition-colors"
          onClick={() => void loadGear()}
        >
          <Corners />
          Refresh
        </button>
      </div>

      <div class="mb-4 flex flex-wrap items-end gap-3">
        {(() => {
          const cached = cachedJobs.value;
          const cachedClassIds = new Set(cached.map(c => c.classId));
          const visibleJobs = cached.length > 0
            ? JOBS.filter(j => {
                const cid = JOB_ABBREV_TO_CLASS_ID[j.abbrev];
                return cid !== undefined && cachedClassIds.has(cid);
              })
            : [];
          if (visibleJobs.length === 0) return null;
          const roles: Array<{ label: string; key: string }> = [
            { key: "tanks",   label: "Tanks"   },
            { key: "healers", label: "Healers" },
            { key: "melee",   label: "Melee"   },
            { key: "ranged",  label: "Ranged"  },
            { key: "casters", label: "Casters" },
          ];
          return (
            <div class="flex flex-col gap-1">
              <label class="text-[10px] text-gray-500 uppercase tracking-wide">Job</label>
              <select
                value={currentJobAbbrev.value ?? ""}
                class="bg-ffxiv-panel border border-ffxiv-border text-gray-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-ffxiv-gold"
                onChange={(e) => {
                  const abbrev = (e.currentTarget as HTMLSelectElement).value;
                  if (!abbrev) return;
                  const classId = JOB_ABBREV_TO_CLASS_ID[abbrev];
                  if (classId === undefined) return;
                  void loadGearForClassId(classId, abbrev);
                }}
              >
                <option value="">— Job —</option>
                {roles.map(({ key, label }) => {
                  const roleJobs = visibleJobs.filter(j => j.role === key);
                  if (roleJobs.length === 0) return null;
                  return (
                    <optgroup key={key} label={label}>
                      {roleJobs.map(j => <option key={j.abbrev} value={j.abbrev}>{j.label}</option>)}
                    </optgroup>
                  );
                })}
              </select>
            </div>
          );
        })()}
        {bisLinkVisible.value && (
          <div class="flex flex-col gap-1">
            <label class="text-[10px] text-gray-500 uppercase tracking-wide">BIS Set</label>
            <select
              value={bisLinkUrl.value}
              class="bg-ffxiv-panel border border-ffxiv-border text-gray-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-ffxiv-gold"
              onChange={(e) => {
                bisLinkUrl.value = (e.currentTarget as HTMLSelectElement).value;
              }}
            >
              <option value="">— Select —</option>
              {bisLinkEntries.value.map(({ url, label }) => (
                <option key={url} value={url}>{label}</option>
              ))}
            </select>
          </div>
        )}
        {compareVisible.value && (
          <button
            class="px-3 py-1.5 text-xs rounded bg-ffxiv-panel border border-ffxiv-border text-gray-300 hover:border-ffxiv-gold hover:text-ffxiv-gold transition-colors"
            onClick={() => void runComparison()}
          >
            Compare
          </button>
        )}
        <button
          class="px-3 py-1.5 text-xs rounded bg-ffxiv-panel border border-ffxiv-border text-gray-400 hover:border-ffxiv-gold hover:text-ffxiv-gold transition-colors"
          onClick={() => { activeTab.value = "bis"; }}
        >
          Manage Sets
        </button>
        {clearVisible.value && (
          <button
            class="px-3 py-1.5 text-xs rounded bg-ffxiv-panel border border-ffxiv-border text-gray-400 hover:text-gray-200 transition-colors"
            onClick={clearComparison}
          >
            Clear
          </button>
        )}
      </div>

      {statusMsg.value && (
        <p class={`text-sm mb-6 ${statusIsError.value ? "text-red-400" : "text-gray-400"}`}>
          {statusMsg.value}
        </p>
      )}
      <SnapshotStatus />
      <GearTab />
    </div>
  );
}

function BisTabPanel() {
  const isActive  = activeTab.value === "bis";
  const manageTab = manageSetsTab.value;
  return (
    <div class={isActive ? "max-w-3xl mx-auto px-4 py-6" : "hidden"}>
      <h2 class="font-cinzel text-sm font-semibold text-ffxiv-gold uppercase tracking-wide mb-4">BIS Sets</h2>
      <SnapshotStatus />

      <div class="flex gap-0 border-b border-ffxiv-border mb-4">
        {MANAGE_TABS.map(({ id, label }) => {
          const isMActive = manageTab === id;
          return (
            <button
              key={id}
              class={`px-3 pb-2 text-xs border-b-2 -mb-px transition-colors ${
                isMActive
                  ? "text-gray-200 border-ffxiv-gold"
                  : "text-gray-500 border-transparent hover:text-gray-300"
              }`}
              onClick={() => { manageSetsTab.value = id; }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Saved Sets */}
      <div class={manageTab === "saved" ? "flex flex-col gap-2" : "hidden"}>
        <SavedSetsTab />
      </div>

      {/* Paste URL */}
      <div class={manageTab === "manual" ? "flex flex-col gap-3" : "hidden"}>
        <div class="flex flex-col gap-1">
          <label class="text-[10px] text-gray-500 uppercase tracking-wide">xivgear.app URL</label>
          <input
            type="text"
            value={manualUrl.value}
            placeholder="https://xivgear.app/?page=bis|war|current&amp;selectedIndex=0"
            class="bg-ffxiv-dark border border-ffxiv-border text-gray-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-ffxiv-gold w-full"
            onInput={(e) => { manualUrl.value = (e.currentTarget as HTMLInputElement).value; }}
          />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-[10px] text-gray-500 uppercase tracking-wide">Raid Tier</label>
          <select
            value={manualTier.value}
            class="bg-ffxiv-dark border border-ffxiv-border text-gray-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-ffxiv-gold"
            onChange={(e) => { manualTier.value = (e.currentTarget as HTMLSelectElement).value as RaidTier; }}
          >
            <TierOptions />
          </select>
        </div>
        <label class="flex items-center gap-2">
          <input
            type="checkbox"
            checked={manualSetDefault.value}
            class="accent-ffxiv-gold w-3 h-3"
            onChange={(e) => { manualSetDefault.value = (e.currentTarget as HTMLInputElement).checked; }}
          />
          <span class="text-xs text-gray-300">Set as default for this job</span>
        </label>
        <button
          class="px-3 py-1.5 text-xs rounded bg-ffxiv-panel border border-ffxiv-gold text-ffxiv-gold hover:bg-ffxiv-gold/10 transition-colors disabled:opacity-50"
          disabled={manualAdding.value}
          onClick={() => void confirmManualAdd()}
        >
          {manualAdding.value ? "Adding..." : "Add Set"}
        </button>
        {manualStatusText.value && (
          <p class={`text-xs ${manualStatusOk.value ? "text-green-400" : "text-red-400"}`}>
            {manualStatusText.value}
          </p>
        )}
      </div>

      {/* The Balance */}
      <div class={manageTab === "balance" ? "flex flex-col gap-3" : "hidden"}>
        <div class="flex flex-col gap-1">
          <label class="text-[10px] text-gray-500 uppercase tracking-wide">
            Raid Tier (applied to all additions)
          </label>
          <select
            value={balanceTier.value}
            class="bg-ffxiv-dark border border-ffxiv-border text-gray-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-ffxiv-gold"
            onChange={(e) => { balanceTier.value = (e.currentTarget as HTMLSelectElement).value as RaidTier; }}
          >
            <TierOptions />
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-[10px] text-gray-500 uppercase tracking-wide">Job</label>
          <select
            value={balanceJobAbbrev.value}
            class="bg-ffxiv-dark border border-ffxiv-border text-gray-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-ffxiv-gold"
            onChange={(e) => { balanceJobAbbrev.value = (e.currentTarget as HTMLSelectElement).value; }}
          >
            <option value="">— Auto-detect from gear —</option>
            {[
              { key: "tanks",   label: "Tanks"   },
              { key: "healers", label: "Healers" },
              { key: "melee",   label: "Melee"   },
              { key: "ranged",  label: "Ranged"  },
              { key: "casters", label: "Casters" },
            ].map(({ key, label }) => {
              const roleJobs = JOBS.filter(j => j.role === key);
              return (
                <optgroup key={key} label={label}>
                  {roleJobs.map(j => <option key={j.abbrev} value={j.abbrev}>{j.label}</option>)}
                </optgroup>
              );
            })}
          </select>
        </div>
        <button
          class="px-3 py-1.5 text-xs rounded bg-ffxiv-panel border border-ffxiv-border text-gray-300 hover:border-ffxiv-gold hover:text-ffxiv-gold transition-colors self-start disabled:opacity-50"
          disabled={balanceLoading.value}
          onClick={() => void loadBalanceLinks()}
        >
          {balanceLoading.value ? "Loading..." : "Load from The Balance"}
        </button>
        {balanceError.value && (
          <p class="text-xs text-gray-500 italic">{balanceError.value}</p>
        )}
        <div class="flex flex-col gap-1.5 max-h-[50vh] overflow-y-auto">
          {(balanceLinks.value ?? []).map(link => (
            <div key={link.url} class="flex items-center gap-2 bg-ffxiv-dark border border-ffxiv-border rounded px-3 py-2">
              <span class="text-xs text-gray-200 flex-1 truncate" title={link.url}>{link.label}</span>
              {link.saved ? (
                <span class="text-[10px] text-gray-500 border border-ffxiv-border rounded px-1.5 py-0.5 flex-shrink-0">Saved</span>
              ) : link.adding ? (
                <span class="text-[10px] text-gray-400 px-2 py-0.5 border border-ffxiv-border rounded flex-shrink-0">Adding...</span>
              ) : link.addError ? (
                <button
                  class="text-[10px] text-red-400 px-2 py-0.5 border border-red-800 rounded flex-shrink-0"
                  onClick={() => void addBalanceLink(link.url)}
                >
                  Error — retry
                </button>
              ) : (
                <button
                  class="text-[10px] text-gray-400 hover:text-ffxiv-gold px-2 py-0.5 border border-ffxiv-border rounded transition-colors flex-shrink-0"
                  onClick={() => void addBalanceLink(link.url)}
                >
                  Add
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function UpgradesTabPanel() {
  const isActive = activeTab.value === "upgrades";
  return (
    <div class={isActive ? "max-w-3xl mx-auto px-4 py-6" : "hidden"}>
      <SnapshotStatus />
      <div class="flex items-center justify-between mb-6">
        <h2 class="font-cinzel text-sm font-semibold text-ffxiv-gold uppercase tracking-wide">Items</h2>
        <button
          class="relative px-3 py-1.5 text-xs rounded bg-ffxiv-panel border border-ffxiv-border text-gray-300 hover:border-ffxiv-gold hover:text-ffxiv-gold transition-colors"
          onClick={() => void loadUpgradeItems()}
        >
          <Corners />
          Refresh
        </button>
      </div>
      <UpgradesTab />
    </div>
  );
}

function AcquisitionTabPanel() {
  const isActive = activeTab.value === "acquisition";
  return (
    <div class={isActive ? "max-w-3xl mx-auto px-4 py-6" : "hidden"}>
      <SnapshotStatus />
      <AcquisitionTab />
    </div>
  );
}

// ---- App root ---------------------------------------------------------------

export function App() {
  return (
    <>
      <TabBar />
      <div class="flex-1 overflow-y-auto pb-2">
        <GearTabPanel />
        <BisTabPanel />
        <UpgradesTabPanel />
        <AcquisitionTabPanel />
      </div>
      <CompareModal />
      <SettingsModal />
    </>
  );
}
