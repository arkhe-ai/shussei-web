/**
 * The slow bright band travelling down a phosphor tube. Decorative only, and
 * separate from the `body::before` scanlines because both pseudo-elements on
 * body are already spoken for.
 */
export function CrtOverlay() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[48] overflow-hidden">
      <div className="animate-sweep h-[14vh] w-full bg-gradient-to-b from-transparent via-amber-500/[0.045] to-transparent" />
    </div>
  );
}
