import { useCallback, useEffect, useState, type FormEvent } from 'react';
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
  fetchExtensionBulletins,
  fetchFieldQueries,
  submitFieldQuery,
  type ExtensionBulletinItem,
  type FarmerFieldQueryItem,
} from '../../services/pillarService';

export default function ResearchPage() {
  const { session, signInDemo, logout } = useAuth();
  const { navigate } = useRouter();

  const [bulletins, setBulletins] = useState<ExtensionBulletinItem[]>([]);
  const [queries, setQueries] = useState<FarmerFieldQueryItem[]>([]);
  const [cropFilter, setCropFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [crop, setCrop] = useState('');
  const [topic, setTopic] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const [bRes, qRes] = await Promise.all([
        fetchExtensionBulletins(session, cropFilter.trim() || undefined),
        fetchFieldQueries(session),
      ]);
      setBulletins(bRes);
      setQueries(qRes);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        return;
      }
      setError(err instanceof Error ? err.message : 'Unable to load research bulletins.');
    }
  }, [session, cropFilter, logout]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (!session) {
    return (
      <div className="page-container">
        <EmptyState
          icon="📚"
          title="Sign in to access Agriculture Research & Extension"
          description="Browse ICAR/KVK crop advisories and submit field queries."
          action={
            <div className="row-wrap">
              <Button variant="primary" onClick={() => navigate('/login')}>Farmer Login →</Button>
              <Button variant="secondary" onClick={() => signInDemo()}>Try Demo Mode</Button>
            </div>
          }
        />
      </div>
    );
  }

  const handleQuerySubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await submitFieldQuery(session, {
        crop: crop.trim(),
        topic: topic.trim(),
        questionText: questionText.trim(),
      });
      setCrop('');
      setTopic('');
      setQuestionText('');
      setNotice('Field query submitted to extension desk.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit field query.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container stack-lg">
      <SectionHeading
        eyebrow="Pillar 6 · Agriculture Research & Extension"
        title="ICAR / KVK Extension Bulletins & Field Queries"
        description="Evidence-based agronomy advisories and direct farmer field question tracking."
        as="h1"
        action={
          <StatusBadge tone={session.mode === 'live' ? 'success' : 'warning'}>
            {session.mode === 'live' ? 'Live Account' : 'Demo Preview'}
          </StatusBadge>
        }
      />

      {notice ? <div className="av-alert av-alert--success" role="status">{notice}</div> : null}
      {error ? <ErrorState title="Research Error" message={error} onRetry={() => void loadData()} /> : null}

      <Card>
        <CardHeader
          title="Extension Bulletins"
          action={
            <input
              aria-label="Filter bulletins by crop"
              className="av-input"
              placeholder="Filter by crop (e.g. Paddy)"
              value={cropFilter}
              onChange={(e) => setCropFilter(e.target.value)}
            />
          }
        />
        <div className="stack-md">
          {bulletins.map((b) => (
            <Card key={b.id} tone="muted">
              <CardHeader
                title={b.title}
                subtitle={`${b.crop} · ${b.sourceAuthority}`}
                action={<StatusBadge tone="info">{b.category}</StatusBadge>}
              />
              <p style={{ margin: '0 0 6px' }}>{b.summary}</p>
              <p style={{ margin: 0, fontSize: 13.5 }}><strong>Recommendation:</strong> {b.recommendationText}</p>
            </Card>
          ))}
        </div>
      </Card>

      <div className="grid-2">
        <Card>
          <CardHeader title="Ask an Extension Specialist" />
          <form className="stack-sm" onSubmit={handleQuerySubmit}>
            <div className="av-field">
              <label htmlFor="res-crop">Crop</label>
              <input id="res-crop" className="av-input" required placeholder="e.g. Paddy" value={crop} onChange={(e) => setCrop(e.target.value)} />
            </div>
            <div className="av-field">
              <label htmlFor="res-topic">Topic</label>
              <input id="res-topic" className="av-input" required placeholder="e.g. Leaf yellowing" value={topic} onChange={(e) => setTopic(e.target.value)} />
            </div>
            <div className="av-field">
              <label htmlFor="res-question">Field Question</label>
              <textarea id="res-question" className="av-input" rows={3} required placeholder="Describe field symptoms and crop stage..." value={questionText} onChange={(e) => setQuestionText(e.target.value)} />
            </div>
            <Button type="submit" variant="primary" loading={submitting}>Submit Field Query</Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="My Field Queries" />
          {queries.length > 0 ? (
            <div className="stack-sm">
              {queries.map((q) => (
                <Card key={q.id} tone="muted">
                  <div className="row-between">
                    <strong>{q.crop} · {q.topic}</strong>
                    <StatusBadge tone={q.status === 'answered' ? 'success' : 'warning'}>{q.status}</StatusBadge>
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 13.5 }}>{q.questionText}</p>
                </Card>
              ))}
            </div>
          ) : (
            <p className="av-card-subtitle">No field queries submitted yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
