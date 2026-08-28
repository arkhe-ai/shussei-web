/**
 * Single source of truth for "should this animate?".
 *
 * The CSS already neutralises keyframes under `prefers-reduced-motion`, but
 * JS-driven effects (scramble, typewriter, boot log) reveal text one character
 * at a time — under reduced motion they must not run at all, or the text would
 * simply appear late instead of appearing whole.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
