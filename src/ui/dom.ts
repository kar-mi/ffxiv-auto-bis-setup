import { statusMsg, statusIsError } from "./state.ts";

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
  statusMsg.value   = msg;
  statusIsError.value = isError;
}

export function clearStatus(): void {
  statusMsg.value     = null;
  statusIsError.value = false;
}
