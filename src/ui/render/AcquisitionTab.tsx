import { acquisitionData } from "../state.ts";
import { SLOT_LABELS } from "../constants.ts";
import { openCompareModal } from "./CompareModal.tsx";
import type { SlotAcquisitionStatus } from "../../acquisition/types.ts";

function Pill({ text, ready }: { text: string; ready: boolean }) {
  const cls = ready
    ? "text-green-400 border-green-700/70"
    : "text-gray-500 border-ffxiv-border";
  return <span class={`px-1.5 py-0.5 text-[10px] border rounded ${cls}`}>{text}</span>;
}

function AcqRow({ s }: { s: SlotAcquisitionStatus }) {
  const label = SLOT_LABELS[s.slot] ?? s.slot;
  const hasPills = s.coffer || s.books || s.upgrade;
  return (
    <div
      class="flex items-center gap-3 bg-ffxiv-panel border border-ffxiv-border rounded px-3 py-2 cursor-pointer hover:border-ffxiv-gold transition-colors"
      onClick={() => openCompareModal(s.slot)}
    >
      <span class="text-xs text-gray-300 w-20 flex-shrink-0">{label}</span>
      <div class="flex gap-1.5 flex-wrap">
        {s.coffer && (
          <Pill text={s.coffer.available ? "Coffer ready" : "Coffer"} ready={s.coffer.available} />
        )}
        {s.books && (
          <Pill
            text={s.books.available ? "Books ready" : `Books ${s.books.book.have}/${s.books.book.need}`}
            ready={s.books.available}
          />
        )}
        {s.upgrade && (
          <Pill text={s.upgrade.available ? "Upgrade ready" : "Upgrade"} ready={s.upgrade.available} />
        )}
        {!hasPills && <span class="text-[10px] text-gray-600 italic">No data yet</span>}
      </div>
    </div>
  );
}

export function AcquisitionTab() {
  const data = acquisitionData.value;

  if (!data || data.length === 0) {
    return (
      <p class="text-xs text-gray-500 italic">
        No data yet — load gear and run a BIS comparison first.
      </p>
    );
  }

  const canNow = data.filter(s => s.canAcquireNow).length;
  const total  = data.length;

  return (
    <>
      <p class="text-xs text-gray-400 mb-3">
        <span class="text-gray-300">{total} slot{total !== 1 ? "s" : ""} need a new item</span>
        {canNow > 0 && <span class="ml-2 text-green-400">— {canNow} can acquire now</span>}
      </p>
      <div class="space-y-2">
        {data.map(s => <AcqRow key={s.slot} s={s} />)}
      </div>
    </>
  );
}
