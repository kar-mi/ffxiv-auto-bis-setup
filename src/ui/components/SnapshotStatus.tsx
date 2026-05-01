import { pcapStatus, snapshotMeta } from "../state.ts";
import { pcapWarningMessage } from "../pcap-status.ts";

export function SnapshotStatus() {
  const meta = snapshotMeta.value;
  const warning = pcapWarningMessage(pcapStatus.value);
  if (!meta && !warning) return null;
  return (
    <div class="mb-4 space-y-1">
      {warning && <p class="text-xs text-yellow-300">{warning}</p>}
      {meta && <p class="text-xs text-gray-500">{meta}</p>}
    </div>
  );
}
