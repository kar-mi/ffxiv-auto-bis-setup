export type PcapStatusPhase =
  | "unavailable"
  | "starting"
  | "capturing"
  | "live"
  | "game-not-running"
  | "error"
  | "stopped";

export type PcapWarningKind = "game-not-running" | "waiting-for-network";

export interface PcapStatus {
  phase: PcapStatusPhase;
  updatedAt: string;
  startedAt?: string;
  lastNetworkAt?: string;
  lastSnapshotAt?: string;
  message?: string;
  warning?: PcapWarningKind;
}

export const WAITING_FOR_NETWORK_MS = 15_000;

export function withPcapWarning(status: PcapStatus, now = Date.now()): PcapStatus {
  if (status.phase === "game-not-running") {
    return { ...status, warning: "game-not-running" };
  }

  const startedAt = status.startedAt ? Date.parse(status.startedAt) : NaN;
  const hasWaited = Number.isFinite(startedAt) && now - startedAt >= WAITING_FOR_NETWORK_MS;
  if (
    status.phase === "capturing" &&
    hasWaited &&
    !status.lastNetworkAt &&
    !status.lastSnapshotAt
  ) {
    return { ...status, warning: "waiting-for-network" };
  }

  if (!status.warning) return status;
  const next = { ...status };
  delete next.warning;
  return next;
}
