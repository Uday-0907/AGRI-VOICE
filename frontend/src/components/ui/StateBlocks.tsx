import type { ReactNode } from 'react';
import Button from './Button';

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="av-state-box" role="status" aria-live="polite">
      <span className="av-spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({
  title,
  message,
  retryLabel,
  onRetry,
}: {
  title: string;
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="av-state-box av-state-box--error" role="alert">
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry && retryLabel ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="av-state-box">
      {icon ? <div style={{ fontSize: 28 }}>{icon}</div> : null}
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
