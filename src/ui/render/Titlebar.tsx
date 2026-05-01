import { signal } from "@preact/signals";
import type { ComponentChildren } from "preact";
import { minimizeWindow, toggleMaximizeWindow, closeWindow } from "../window/controls.ts";
import { startMove } from "../window/resize.ts";

export const windowMaximized = signal(false);

function DiamondEmblem() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 1L13 7L7 13L1 7L7 1Z" stroke="#c8a84b" stroke-width="1.25" stroke-linejoin="round" />
      <path d="M7 3.5L10.5 7L7 10.5L3.5 7L7 3.5Z" stroke="#c8a84b" stroke-width="0.75" stroke-linejoin="round" stroke-opacity="0.5" />
    </svg>
  );
}

function MinimizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <line x1="2" y1="7" x2="8" y2="7" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <rect x="1.5" y="1.5" width="7" height="7" stroke="currentColor" stroke-width="1.25" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <rect x="2.5" y="0.5" width="6" height="6" stroke="currentColor" stroke-width="1.25" />
      <rect x="0.5" y="2.5" width="6" height="6" stroke="currentColor" stroke-width="1.25" fill="#1a1a2e" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <line x1="2" y1="2" x2="8" y2="8" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
      <line x1="8" y1="2" x2="2" y2="8" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
    </svg>
  );
}

interface CtrlButtonProps {
  onClick: () => void;
  label: string;
  isClose?: boolean;
  children: ComponentChildren;
}

function CtrlButton({ onClick, label, isClose, children }: CtrlButtonProps) {
  return (
    <button
      class={[
        "relative no-drag flex items-center justify-center w-[46px] h-8 group transition-colors",
        "text-ffxiv-gold/70",
        isClose
          ? "hover:bg-[rgba(220,38,38,0.18)] hover:text-red-300"
          : "hover:bg-[rgba(200,168,75,0.04)] hover:text-ffxiv-gold",
      ].join(" ")}
      aria-label={label}
      onClick={onClick}
    >
      <span class="absolute top-0 left-0 w-1 h-1 border-t border-l border-ffxiv-gold opacity-0 group-hover:opacity-100 transition-opacity" />
      <span class="absolute top-0 right-0 w-1 h-1 border-t border-r border-ffxiv-gold opacity-0 group-hover:opacity-100 transition-opacity" />
      <span class="absolute bottom-0 left-0 w-1 h-1 border-b border-l border-ffxiv-gold opacity-0 group-hover:opacity-100 transition-opacity" />
      <span class="absolute bottom-0 right-0 w-1 h-1 border-b border-r border-ffxiv-gold opacity-0 group-hover:opacity-100 transition-opacity" />
      {children}
    </button>
  );
}

export function Titlebar() {
  const maximized = windowMaximized.value;
  return (
    <div
      class="titlebar shrink-0 h-8 flex items-center bg-ffxiv-panel border-b relative"
      style={{ borderBottomColor: "rgba(200,168,75,0.15)" }}
      onPointerDown={(e) => startMove(e as PointerEvent)}
    >
      {/* Decorative top-corner accents */}
      <span class="absolute top-0 left-0 w-1 h-1 border-t border-l border-ffxiv-gold/40 pointer-events-none" />
      <span class="absolute top-0 right-0 w-1 h-1 border-t border-r border-ffxiv-gold/40 pointer-events-none" />

      {/* Left: emblem + title (draggable) */}
      <div class="flex items-center gap-2 pl-3 shrink-0">
        <DiamondEmblem />
        <span
          class="font-cinzel text-gray-300 font-semibold"
          style={{ fontSize: "11px", letterSpacing: "0.18em" }}
        >
          FFXIV&nbsp;&nbsp;GEAR&nbsp;&nbsp;SETUP
        </span>
      </div>

      {/* Center: drag region spacer */}
      <div class="flex-1" />

      {/* Right: window controls */}
      <div class="flex items-center">
        <CtrlButton onClick={() => void minimizeWindow()} label="Minimize">
          <MinimizeIcon />
        </CtrlButton>
        <CtrlButton
          onClick={() => {
            windowMaximized.value = !maximized;
            void toggleMaximizeWindow();
          }}
          label={maximized ? "Restore" : "Maximize"}
        >
          {maximized ? <RestoreIcon /> : <MaximizeIcon />}
        </CtrlButton>
        <CtrlButton onClick={() => void closeWindow()} label="Close" isClose>
          <CloseIcon />
        </CtrlButton>
      </div>
    </div>
  );
}
