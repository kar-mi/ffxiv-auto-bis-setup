import { signal } from "@preact/signals";
import {
  APP_DEFAULT_TAB_LABELS,
  APP_DEFAULT_TABS,
  type AppSettings,
  type AppDefaultTab,
} from "../../types.ts";
import { appSettings, saveSettings } from "../settings.ts";

export const settingsOpen = signal(false);
const settingsSaving = signal(false);
const settingsStatus = signal("");

async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  const previous = appSettings.value;
  const next = { ...previous, ...patch };
  appSettings.value = next;
  settingsSaving.value = true;
  settingsStatus.value = "";
  try {
    await saveSettings(next);
    settingsStatus.value = "Saved";
  } catch (err) {
    appSettings.value = previous;
    settingsStatus.value = `Could not save: ${(err as Error)?.message ?? String(err)}`;
  } finally {
    settingsSaving.value = false;
  }
}

export function SettingsModal() {
  if (!settingsOpen.value) return null;

  const close = (): void => { settingsOpen.value = false; };
  const settings = appSettings.value;

  return (
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div class="modal-card bg-ffxiv-panel border border-ffxiv-border rounded-xl w-[420px] max-w-[90vw] max-h-[85vh] overflow-y-auto p-5 relative shadow-xl">
        <button
          class="absolute top-3 right-3 text-gray-500 hover:text-gray-200 text-lg leading-none"
          onClick={close}
        >
          &#x2715;
        </button>
        <h2 class="font-cinzel text-sm font-semibold text-ffxiv-gold uppercase tracking-wide mb-4">Settings</h2>
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-[10px] text-gray-500 uppercase tracking-wide">Open On Launch</label>
            <select
              value={settings.defaultTab}
              class="bg-ffxiv-dark border border-ffxiv-border text-gray-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-ffxiv-gold"
              onChange={(e) => {
                const defaultTab = (e.currentTarget as HTMLSelectElement).value as AppDefaultTab;
                void updateSettings({ defaultTab });
              }}
            >
              {APP_DEFAULT_TABS.map(tab => (
                <option key={tab} value={tab}>{APP_DEFAULT_TAB_LABELS[tab]}</option>
              ))}
            </select>
          </div>

          <p class={`text-xs ${settingsStatus.value.startsWith("Could not") ? "text-red-400" : "text-gray-500"}`}>
            {settingsSaving.value ? "Saving..." : settingsStatus.value || "Changes are saved automatically."}
          </p>
        </div>
      </div>
    </div>
  );
}
