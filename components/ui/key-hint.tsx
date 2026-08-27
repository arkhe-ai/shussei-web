import type { ReactNode } from 'react';

export function KeyHint({ keys, children }: { keys: string; children: ReactNode }) {
  return (
    <span className="whitespace-nowrap text-[11px] text-content-muted">
      <span className="text-amber-600">[{keys}]</span> {children}
    </span>
  );
}
