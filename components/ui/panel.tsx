import clsx from 'clsx';
import type { ReactNode } from 'react';

/**
 * A terminal box: 1px amber rule, optional label rendered into the top border
 * and optional `+` corner ticks.
 */
export function Panel({
  label,
  right,
  children,
  className,
  bodyClassName,
  corners = true,
}: {
  label?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  corners?: boolean;
}) {
  return (
    <section className={clsx('relative border border-line bg-base-850', className)}>
      {corners ? <Corners /> : null}
      {label || right ? (
        <header className="flex items-center justify-between gap-3 border-b border-line px-3 py-1.5">
          <span className="text-[11px] uppercase tracking-[0.22em] text-amber-500 glow">{label}</span>
          {right ? <span className="text-[11px] text-content-muted">{right}</span> : null}
        </header>
      ) : null}
      <div className={clsx('p-3', bodyClassName)}>{children}</div>
    </section>
  );
}

function Corners() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 text-amber-700">
      <span className="absolute -left-[3px] -top-[9px] text-[11px] leading-none">+</span>
      <span className="absolute -right-[4px] -top-[9px] text-[11px] leading-none">+</span>
      <span className="absolute -bottom-[3px] -left-[3px] text-[11px] leading-none">+</span>
      <span className="absolute -bottom-[3px] -right-[4px] text-[11px] leading-none">+</span>
    </span>
  );
}
