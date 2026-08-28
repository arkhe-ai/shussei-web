/**
 * Whether the CRT has already warmed up in this document.
 *
 * Module scope, not component state: the boot log and the power-on belong to
 * loading the page, not to mounting a component. Anything that remounts the
 * shell mid-session must not replay them, and a real reload must.
 */
let booted = false;

export function isFirstBoot(): boolean {
  return !booted;
}

export function markBooted(): void {
  booted = true;
}
