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
  fetchInstitutionalSchemes,
  fetchSchemeApplications,
  submitSchemeApplication,
  type InstitutionalSchemeItem,
  type SchemeApplicationItem,
} from '../../services/pillarService';

export default function InstitutionsPage() {
  const { session, signInDemo, logout } = useAuth();
  const { navigate } = useRouter();

  const [schemes, setSchemes] = useState<InstitutionalSchemeItem[]>([]);
  const [applications, setApplications] = useState<SchemeApplicationItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!session) return;
    setError(null);
    try {
      const [sRes, aRes] = await Promise.all([
        fetchInstitutionalSchemes(session),
        fetchSchemeApplications(session),
      ]);
      setSchemes(sRes);
      setApplications(aRes);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        return;
      }
      setError(err instanceof Error ? err.message : 'Unable to load institutional schemes.');
    }
  }, [session, logout]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (!session) {
    return (
      <div className="page-container">
        <EmptyState
          icon="🏛️"
          title="Sign in to access Institutional & Financial Services"
          description="Explore public-reference government schemes (PM-KISAN, PMFBY, KCC) and track your applications."
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

  const handleApply = async (scheme: InstitutionalSchemeItem) => {
    setError(null);
    setNotice(null);
    try {
      await submitSchemeApplication(session, {
        schemeCode: scheme.schemeCode,
        schemeTitle: scheme.title,
        category: scheme.category,
        farmId: session.selectedFarmId || undefined,
        notes: 'Submitted via AgriVoice Institutions portal',
      });
      setNotice(`Application recorded for ${scheme.title}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application.');
    }
  };

  return (
    <div className="page-container stack-lg">
      <SectionHeading
        eyebrow="Pillar 5 · Institutions & Financial Inclusion"
        title="Government Schemes, Credit & Crop Insurance"
        description="Public-reference agricultural schemes (PM-KISAN, PMFBY, KCC) with application tracking."
        as="h1"
        action={
          <StatusBadge tone={session.mode === 'live' ? 'success' : 'warning'}>
            {session.mode === 'live' ? 'Live Account' : 'Demo Preview'}
          </StatusBadge>
        }
      />

      {notice ? <div className="av-alert av-alert--success" role="status">{notice}</div> : null}
      {error ? <ErrorState title="Institutions Error" message={error} onRetry={() => void loadData()} /> : null}

      <div className="grid-2">
        {schemes.map((scheme) => (
          <Card key={scheme.id}>
            <CardHeader
              title={scheme.title}
              subtitle={`${scheme.authority} · ${scheme.source}`}
              action={<StatusBadge tone="info">{scheme.category}</StatusBadge>}
            />
            <p style={{ margin: '0 0 8px' }}><strong>Eligibility:</strong> {scheme.eligibilitySummary}</p>
            <p style={{ margin: '0 0 12px' }}><strong>Benefits:</strong> {scheme.benefitSummary}</p>
            <div className="row-wrap">
              <Button variant="primary" size="sm" onClick={() => void handleApply(scheme)}>
                Track / Submit Application
              </Button>
              {scheme.applicationUrl ? (
                <a className="av-btn av-btn--outline av-btn--sm" href={scheme.applicationUrl} target="_blank" rel="noreferrer">
                  Official Portal ↗
                </a>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="My Scheme Applications" />
        {applications.length > 0 ? (
          <div className="table-scroll">
            <table className="av-table">
              <thead>
                <tr>
                  <th>Scheme</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id}>
                    <td>{app.schemeTitle}</td>
                    <td>{app.category}</td>
                    <td><StatusBadge tone="success">{app.status}</StatusBadge></td>
                    <td>{new Date(app.submittedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="av-card-subtitle">No scheme applications tracked yet.</p>
        )}
      </Card>
    </div>
  );
}
