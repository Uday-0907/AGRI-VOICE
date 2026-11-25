import type { ReactNode } from 'react';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export function StatusBadge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`av-badge av-badge--${tone} ${className}`.trim()}>
      {children}
    </span>
  );
}

export default StatusBadge;
