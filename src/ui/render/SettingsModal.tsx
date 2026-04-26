import { signal } from "@preact/signals";

export const settingsOpen = signal(false);

export function SettingsModal() {
  if (!settingsOpen.value) return null;

  const close = (): void => { settingsOpen.value = false; };

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
        <p class="text-xs text-gray-500 italic">No settings yet — more options coming soon.</p>
      </div>
    </div>
  );
}
