import { pcapWarningModalMsg } from "../state.ts";

export function PcapWarningModal() {
  const message = pcapWarningModalMsg.value;
  if (!message) return null;

  const close = (): void => { pcapWarningModalMsg.value = null; };

  return (
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div class="modal-card bg-ffxiv-panel border border-ffxiv-border rounded-xl w-[420px] max-w-[90vw] p-5 relative shadow-xl">
        <button
          class="absolute top-3 right-3 text-gray-500 hover:text-gray-200 text-lg leading-none"
          onClick={close}
        >
          &#x2715;
        </button>
        <h2 class="font-cinzel text-sm font-semibold text-ffxiv-gold uppercase tracking-wide mb-4">
          Capture Needs Attention
        </h2>
        <p class="text-xs text-gray-300 leading-relaxed pr-4">{message}</p>
        <button
          class="mt-5 px-3 py-1.5 text-xs rounded bg-ffxiv-panel border border-ffxiv-border text-gray-300 hover:border-ffxiv-gold hover:text-ffxiv-gold transition-colors"
          onClick={close}
        >
          OK
        </button>
      </div>
    </div>
  );
}
