import { snapshotMeta } from "../state.ts";

export function SnapshotStatus() {
  const meta = snapshotMeta.value;
  if (!meta) return null;
  return <p class="text-xs text-gray-500 mb-4">{meta}</p>;
}
