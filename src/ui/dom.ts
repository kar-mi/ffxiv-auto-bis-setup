export const logger = {
  debug: (...a: unknown[]): void => { console.debug(...a); },
  info:  (...a: unknown[]): void => { console.info(...a); },
  warn:  (...a: unknown[]): void => { console.warn(...a); },
  error: (...a: unknown[]): void => { console.error(...a); },
};

export function el(id: string): HTMLElement {
  return document.getElementById(id) as HTMLElement;
}

export function setStatus(msg: string, isError = false): void {
  const s = el("status");
  s.textContent = msg;
  s.className = `text-sm mb-6 ${isError ? "text-red-400" : "text-gray-400"}`;
  s.classList.remove("hidden");
}

export function clearStatus(): void {
  el("status").classList.add("hidden");
}
