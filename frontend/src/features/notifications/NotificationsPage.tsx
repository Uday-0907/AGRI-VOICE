import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../app/providers/AuthProvider';
import { useRouter } from '../../app/routes/routes';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  SectionHeading,
  StatusBadge,
} from '../../components/ui';
import { ApiError } from '../../services/apiClient';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '../../services/buyerService';

export default function NotificationsPage() {
  const { session, logout } = useAuth();
  const { navigate } = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const data = await fetchNotifications(session);
      setItems(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load notifications.');
    }
  }, [session, logout]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!session) {
    return (
      <div className="page-container">
        <EmptyState
          icon="🔔"
          title="Sign in to view Notifications"
          description="Your account notifications and activity updates are private to your authenticated session."
          action={<Button variant="primary" onClick={() => navigate('/login')}>Sign In →</Button>}
        />
      </div>
    );
  }

  return (
    <div className="page-container stack-lg">
      <SectionHeading
        eyebrow="Account Activity"
        title="Notifications & History"
        description="Real-time alerts for produce enquiries, farmer responses, and account milestones."
        as="h1"
        action={
          items.some((i) => !i.isRead) ? (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await markAllNotificationsRead(session);
                await load();
              }}
            >
              Mark All Read
            </Button>
          ) : null
        }
      />

      {error ? <ErrorState title="Notification Error" message={error} onRetry={() => void load()} /> : null}

      <Card>
        <CardHeader title="Recent Notifications" />
        {items.length > 0 ? (
          <div className="stack-sm">
            {items.map((n) => (
              <Card key={n.id} tone={n.isRead ? 'muted' : 'accent'}>
                <div className="row-between">
                  <strong>{n.title}</strong>
                  <div className="row-wrap">
                    <StatusBadge tone={n.isRead ? 'neutral' : 'info'}>{n.category}</StatusBadge>
                    {!n.isRead ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await markNotificationRead(session, n.id);
                          await load();
                        }}
                      >
                        Mark Read
                      </Button>
                    ) : null}
                  </div>
                </div>
                <p style={{ margin: '6px 0 4px' }}>{n.message}</p>
                <small className="av-card-subtitle">{new Date(n.createdAt).toLocaleString()}</small>
              </Card>
            ))}
          </div>
        ) : (
          <p className="av-card-subtitle">No notifications yet.</p>
        )}
      </Card>
    </div>
  );
}
