import { API_BASE } from "./constants.ts";
import { logger } from "./dom.ts";
import { pcapStatus } from "./state.ts";
import type { PcapStatus } from "../pcap/status.ts";

const GAME_NOT_RUNNING_MESSAGE =
  "Game not detected. Start FFXIV, log in to your character, then open this app again so packet capture can attach.";
const WAITING_FOR_NETWORK_MESSAGE =
  "FFXIV was open when capture started, but no network data has arrived yet. Change areas or teleport once, then refresh.";

export function pcapWarningMessage(status: PcapStatus | null): string | null {
  if (!status?.warning) return null;
  if (status.warning === "game-not-running") return GAME_NOT_RUNNING_MESSAGE;
  return WAITING_FOR_NETWORK_MESSAGE;
}

export async function refreshPcapStatus(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/pcap/status`);
    if (!res.ok) return;
    pcapStatus.value = await res.json() as PcapStatus;
  } catch (err) {
    logger.debug(err, "[pcap-status] refresh failed");
  }
}

export function startPcapStatusPolling(): void {
  void refreshPcapStatus();
  window.setInterval(() => void refreshPcapStatus(), 5000);
}
