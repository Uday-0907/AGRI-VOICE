import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../app/providers/AuthProvider';
import { useRouter } from '../../app/routes/routes';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeading,
  StatusBadge,
  type BadgeTone,
} from '../../components/ui';
import { ApiError } from '../../services/apiClient';
import {
  fetchSoilDashboard,
  listInputVerifications,
  listSoilReports,
  lookupSoilCard,
  refreshSoilReport,
  submitManualSoilReport,
  verifyInputProduct,
} from '../../services/soilService';
import type {
  InputCategory,
  InputVerificationRecord,
  SoilDashboardData,
  SoilReport,
} from '../../types/api';

type SoilTab = 'overview' | 'lookup' | 'reports' | 'verify';

function verificationTone(status: string): BadgeTone {
  switch (status) {
    case 'verified':
      return 'success';
    case 'recall_alert':
    case 'expired':
    case 'not_verified':
      return 'danger';
    case 'demo':
    case 'inconclusive':
    case 'not_found':
      return 'warning';
    default:
      return 'neutral';
  }
}

function formatEvidenceText(
  evidence: string | Record<string, unknown> | null | undefined,
  notes: string | null | undefined
): string {
  if (typeof evidence === 'string' && evidence.trim()) {
    return evidence;
  }
  if (evidence && typeof evidence === 'object') {
    const obj = evidence as Record<string, unknown>;
    const summary =
      (typeof obj.officialNotice === 'string' && obj.officialNotice) ||
      (typeof obj.disclaimer === 'string' && obj.disclaimer) ||
      (typeof obj.message === 'string' && obj.message) ||
      (typeof obj.licensedManufacturer === 'string' && `Manufacturer: ${obj.licensedManufacturer}`);
    if (summary) return summary;
    return JSON.stringify(evidence);
  }
  return notes || 'Verification completed.';
}

export default function SoilManagementPage() {
  const { t } = useTranslation('common');
  const { navigate } = useRouter();
  const { session, signInDemo, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<SoilTab>('overview');
  const [dashboard, setDashboard] = useState<SoilDashboardData | null>(null);
  const [reports, setReports] = useState<SoilReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<SoilReport | null>(null);
  const [verifications, setVerifications] = useState<InputVerificationRecord[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SHC lookup form state
  const [cardId, setCardId] = useState('SHC-AP-1001');
  const [lookupMode, setLookupMode] = useState<'auto' | 'government' | 'demo'>('auto');
  const [lookupSubmitting, setLookupSubmitting] = useState(false);
  const [lookupNotice, setLookupNotice] = useState<string | null>(null);

  // Manual soil test entry state
  const [manualCardId, setManualCardId] = useState('');
  const [manualSoilType, setManualSoilType] = useState('Alluvial / Loamy');
  const [manualPh, setManualPh] = useState('');
  const [manualEc, setManualEc] = useState('');
  const [manualOc, setManualOc] = useState('');
  const [manualN, setManualN] = useState('');
  const [manualP, setManualP] = useState('');
  const [manualK, setManualK] = useState('');
  const [manualZn, setManualZn] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);

  // Input verification form state
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState<InputCategory>('fertilizer');
  const [brand, setBrand] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [verifyMode, setVerifyMode] = useState<'auto' | 'official' | 'demo'>('auto');
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [latestVerification, setLatestVerification] = useState<InputVerificationRecord | null>(null);

  const loadSoilData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const [dashRes, reportsRes, verifyRes] = await Promise.all([
        fetchSoilDashboard(session),
        listSoilReports(session),
        listInputVerifications(session),
      ]);
      setDashboard(dashRes);
      setReports(reportsRes.data);
      setSelectedReport(dashRes.latestReport ?? reportsRes.data[0] ?? null);
      setVerifications(verifyRes.data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        return;
      }
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [session, logout, t]);

  useEffect(() => {
    void loadSoilData();
  }, [loadSoilData]);

  const handleLookupSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!session || cardId.trim().length < 3) return;
    setLookupSubmitting(true);
    setLookupNotice(null);
    setError(null);
    try {
      const report = await lookupSoilCard(session, {
        cardId: cardId.trim(),
        farmId: session.selectedFarmId || undefined,
        providerMode: lookupMode,
      });
      setSelectedReport(report);
      setLookupNotice(`Imported report ${report.reportId} (${report.status}).`);
      await loadSoilData();
      setActiveTab('overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLookupSubmitting(false);
    }
  };

  const handleManualSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!session) return;
    setManualSubmitting(true);
    setLookupNotice(null);
    setError(null);
    try {
      const report = await submitManualSoilReport(session, {
        cardId: manualCardId.trim() || undefined,
        farmId: session.selectedFarmId || undefined,
        soilType: manualSoilType.trim() || undefined,
        ph: manualPh ? Number(manualPh) : undefined,
        ec: manualEc ? Number(manualEc) : undefined,
        organicCarbon: manualOc ? Number(manualOc) : undefined,
        nitrogen: manualN ? Number(manualN) : undefined,
        phosphorus: manualP ? Number(manualP) : undefined,
        potassium: manualK ? Number(manualK) : undefined,
        zinc: manualZn ? Number(manualZn) : undefined,
      });
      setSelectedReport(report);
      setLookupNotice(`Saved farmer-submitted soil report ${report.reportId} (${report.source}).`);
      await loadSoilData();
      setActiveTab('overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleRefreshReport = async (reportId: string) => {
    if (!session) return;
    setLoading(true);
    try {
      const refreshed = await refreshSoilReport(session, reportId);
      setSelectedReport(refreshed);
      await loadSoilData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!session || !productName.trim()) return;
    setVerifySubmitting(true);
    setError(null);
    try {
      const record = await verifyInputProduct(session, {
        productName: productName.trim(),
        category,
        brand: brand.trim() || undefined,
        manufacturer: manufacturer.trim() || undefined,
        batchNumber: batchNumber.trim() || undefined,
        registrationNumber: registrationNumber.trim() || undefined,
        providerMode: verifyMode,
      });
      setLatestVerification(record);
      await loadSoilData();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setVerifySubmitting(false);
    }
  };

  if (!session) {
    return (
      <div className="page-container">
        <EmptyState
          icon="🌱"
          title={t('dashboard.signInPromptTitle')}
          description={t('dashboard.signInPromptDesc')}
          action={
            <div className="row-wrap">
              <Button variant="primary" onClick={() => navigate('/login')}>
                {t('dashboard.signInNow')} →
              </Button>
              <Button variant="secondary" onClick={() => signInDemo()}>
                {t('auth.demoLoginButton')}
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  const reportToShow = selectedReport ?? dashboard?.latestReport ?? null;
  const nutrientMetrics = reportToShow
    ? [
        { label: t('soil.ph'), value: reportToShow.ph, unit: '' },
        { label: t('soil.ec'), value: reportToShow.ec, unit: ' dS/m' },
        { label: t('soil.organicCarbon'), value: reportToShow.organicCarbon, unit: '%' },
        { label: t('soil.nitrogen'), value: reportToShow.nitrogen, unit: ' kg/ha' },
        { label: t('soil.phosphorus'), value: reportToShow.phosphorus, unit: ' kg/ha' },
        { label: t('soil.potassium'), value: reportToShow.potassium, unit: ' kg/ha' },
        { label: t('soil.sulphur'), value: reportToShow.sulphur, unit: ' ppm' },
        { label: t('soil.zinc'), value: reportToShow.zinc, unit: ' ppm' },
        { label: t('soil.iron'), value: reportToShow.iron, unit: ' ppm' },
        { label: t('soil.copper'), value: reportToShow.copper, unit: ' ppm' },
        { label: t('soil.manganese'), value: reportToShow.manganese, unit: ' ppm' },
        { label: t('soil.boron'), value: reportToShow.boron, unit: ' ppm' },
      ]
    : [];

  return (
    <div className="page-container stack-lg">
      <SectionHeading
        eyebrow={t('soil.eyebrow')}
        title={t('soil.title')}
        description={t('soil.subtitle')}
        as="h1"
        action={
          <StatusBadge tone={session.mode === 'live' ? 'success' : 'warning'}>
            {session.mode === 'live' ? t('common.liveDataBadge') : t('common.demoDataBadge')}
          </StatusBadge>
        }
      />

      <div className="tab-bar" role="tablist" aria-label={t('soil.title')}>
        {(['overview', 'lookup', 'reports', 'verify'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`tab-btn ${activeTab === tab ? 'is-active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {t(`soil.tabs.${tab}`)}
          </button>
        ))}
      </div>

      {lookupNotice ? (
        <div className="av-alert av-alert--success" role="status">
          {lookupNotice}
        </div>
      ) : null}

      {error ? (
        <ErrorState
          title={t('common.error')}
          message={error}
          retryLabel={t('common.retry')}
          onRetry={() => void loadSoilData()}
        />
      ) : null}

      {loading && !dashboard ? <LoadingState label={t('common.loading')} /> : null}

      {activeTab === 'overview' && (
        <div className="stack-md">
          {reportToShow ? (
            <>
              <Card>
                <CardHeader
                  title={`${t('soil.latestReportHeading')}: ${reportToShow.cardId ?? reportToShow.reportId}`}
                  subtitle={`${reportToShow.sourceAuthority ?? reportToShow.source} · ${reportToShow.village ?? ''}, ${reportToShow.district ?? ''}`}
                  action={
                    <div className="row-wrap">
                      <StatusBadge tone={reportToShow.status === 'available' ? 'success' : 'warning'}>
                        {reportToShow.status}
                      </StatusBadge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleRefreshReport(reportToShow.id)}
                      >
                        {t('soil.refreshReport')}
                      </Button>
                    </div>
                  }
                />

                {dashboard && dashboard.summary.criticalDeficiencies.length > 0 ? (
                  <div className="av-alert av-alert--warning" style={{ marginBottom: 16 }}>
                    <strong>{t('soil.criticalDeficiencies')}:</strong>{' '}
                    <span>{dashboard.summary.criticalDeficiencies.join(', ')}</span>
                  </div>
                ) : null}

                <h4 className="av-card-title" style={{ marginBottom: 12 }}>
                  {t('soil.nutrientProfile')}
                </h4>
                <div className="nutrient-grid">
                  {nutrientMetrics.map((metric) => (
                    <div className="nutrient-tile" key={metric.label}>
                      <small>{metric.label}</small>
                      <strong>
                        {metric.value !== null && metric.value !== undefined
                          ? `${metric.value}${metric.unit}`
                          : t('common.notTested')}
                      </strong>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <CardHeader title={t('soil.recommendationsHeading')} />
                {Array.isArray(reportToShow.recommendations) && reportToShow.recommendations.length > 0 ? (
                  <div className="table-scroll">
                    <table className="av-table">
                      <thead>
                        <tr>
                          <th>{t('soil.cropCol')}</th>
                          <th>{t('soil.fertilizerCol')}</th>
                          <th>{t('soil.dosageCol')}</th>
                          <th>{t('soil.noteCol')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportToShow.recommendations.map((rec, idx) => (
                          <tr key={`${rec.crop ?? 'crop'}-${idx}`}>
                            <td>{rec.crop ?? '—'}</td>
                            <td>{rec.fertilizer ?? '—'}</td>
                            <td>{rec.dosageKgPerAcre ?? '—'}</td>
                            <td>{rec.note ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="av-card-subtitle">{t('common.noData')}</p>
                )}
              </Card>
            </>
          ) : (
            <EmptyState
              icon="🧪"
              title={t('soil.reportsHistoryHeading')}
              description={t('soil.noReports')}
              action={
                <Button variant="primary" onClick={() => setActiveTab('lookup')}>
                  {t('soil.lookupHeading')}
                </Button>
              }
            />
          )}
        </div>
      )}

      {activeTab === 'lookup' && (
        <div className="stack-md">
          <Card>
            <CardHeader title={t('soil.lookupHeading')} subtitle={t('soil.lookupDesc')} />
            <form className="stack-md" onSubmit={handleLookupSubmit}>
              <div className="grid-2">
                <div className="av-field">
                  <label htmlFor="shc-card-id">{t('soil.cardIdLabel')}</label>
                  <input
                    id="shc-card-id"
                    className="av-input"
                    type="text"
                    minLength={3}
                    maxLength={64}
                    placeholder={t('soil.cardIdPlaceholder')}
                    value={cardId}
                    onChange={(e) => setCardId(e.target.value)}
                    required
                  />
                </div>

                <div className="av-field">
                  <label htmlFor="shc-provider-mode">{t('soil.providerModeLabel')}</label>
                  <select
                    id="shc-provider-mode"
                    className="av-select"
                    value={lookupMode}
                    onChange={(e) =>
                      setLookupMode(e.target.value as 'auto' | 'government' | 'demo')
                    }
                  >
                    <option value="auto">{t('soil.modeAuto')}</option>
                    <option value="government">{t('soil.modeGovernment')}</option>
                    <option value="demo">{t('soil.modeDemo')}</option>
                  </select>
                </div>
              </div>

              <div>
                <Button type="submit" variant="primary" loading={lookupSubmitting}>
                  {lookupSubmitting ? t('soil.lookingUp') : t('soil.lookupButton')}
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader
              title="Submit Farmer / Lab Soil Test Values"
              subtitle="Enter measurements from a physical Soil Health Card or private laboratory report to compute nutrient ratings and fertilizer recommendations."
            />
            <form className="stack-md" onSubmit={handleManualSubmit}>
              <div className="grid-2">
                <div className="av-field">
                  <label htmlFor="manual-card-id">Lab / SHC Reference ID (Optional)</label>
                  <input id="manual-card-id" className="av-input" type="text" placeholder="e.g. LAB-GNT-2026-01" value={manualCardId} onChange={(e) => setManualCardId(e.target.value)} />
                </div>
                <div className="av-field">
                  <label htmlFor="manual-soil-type">Soil Type</label>
                  <input id="manual-soil-type" className="av-input" type="text" value={manualSoilType} onChange={(e) => setManualSoilType(e.target.value)} />
                </div>
                <div className="av-field">
                  <label htmlFor="manual-ph">Soil pH (0–14)</label>
                  <input id="manual-ph" className="av-input" type="number" step="0.1" min="0" max="14" placeholder="e.g. 7.2" value={manualPh} onChange={(e) => setManualPh(e.target.value)} />
                </div>
                <div className="av-field">
                  <label htmlFor="manual-ec">EC (dS/m)</label>
                  <input id="manual-ec" className="av-input" type="number" step="0.01" min="0" placeholder="e.g. 0.45" value={manualEc} onChange={(e) => setManualEc(e.target.value)} />
                </div>
                <div className="av-field">
                  <label htmlFor="manual-oc">Organic Carbon (%)</label>
                  <input id="manual-oc" className="av-input" type="number" step="0.01" min="0" placeholder="e.g. 0.58" value={manualOc} onChange={(e) => setManualOc(e.target.value)} />
                </div>
                <div className="av-field">
                  <label htmlFor="manual-n">Nitrogen N (kg/ha)</label>
                  <input id="manual-n" className="av-input" type="number" step="1" min="0" placeholder="e.g. 210" value={manualN} onChange={(e) => setManualN(e.target.value)} />
                </div>
                <div className="av-field">
                  <label htmlFor="manual-p">Phosphorus P (kg/ha)</label>
                  <input id="manual-p" className="av-input" type="number" step="0.5" min="0" placeholder="e.g. 18" value={manualP} onChange={(e) => setManualP(e.target.value)} />
                </div>
                <div className="av-field">
                  <label htmlFor="manual-k">Potassium K (kg/ha)</label>
                  <input id="manual-k" className="av-input" type="number" step="1" min="0" placeholder="e.g. 260" value={manualK} onChange={(e) => setManualK(e.target.value)} />
                </div>
                <div className="av-field">
                  <label htmlFor="manual-zn">Zinc Zn (ppm)</label>
                  <input id="manual-zn" className="av-input" type="number" step="0.1" min="0" placeholder="e.g. 0.5" value={manualZn} onChange={(e) => setManualZn(e.target.value)} />
                </div>
              </div>
              <div>
                <Button type="submit" variant="secondary" loading={manualSubmitting}>
                  Save Soil Test & Generate Recommendations
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {activeTab === 'reports' && (
        <Card>
          <CardHeader title={t('soil.reportsHistoryHeading')} />
          {reports.length > 0 ? (
            <div className="table-scroll">
              <table className="av-table">
                <thead>
                  <tr>
                    <th>{t('soil.cardIdLabel')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('soil.ph')}</th>
                    <th>{t('soil.nitrogen')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((rep) => (
                    <tr key={rep.id}>
                      <td>{rep.cardId ?? rep.reportId}</td>
                      <td>
                        <StatusBadge tone={rep.status === 'available' ? 'success' : 'warning'}>
                          {rep.status}
                        </StatusBadge>
                      </td>
                      <td>{rep.ph ?? t('common.notTested')}</td>
                      <td>{rep.nitrogen ?? t('common.notTested')}</td>
                      <td>
                        <div className="row-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedReport(rep);
                              setActiveTab('overview');
                            }}
                          >
                            {t('common.viewAll')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleRefreshReport(rep.id)}
                          >
                            {t('common.refresh')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title={t('soil.reportsHistoryHeading')} description={t('soil.noReports')} />
          )}
        </Card>
      )}

      {activeTab === 'verify' && (
        <div className="stack-md">
          <Card>
            <CardHeader
              title={t('soil.inputVerifyHeading')}
              subtitle={t('soil.inputVerifyDesc')}
            />
            <form className="stack-md" onSubmit={handleVerifySubmit}>
              <div className="grid-2">
                <div className="av-field">
                  <label htmlFor="verify-product">{t('soil.productNameLabel')}</label>
                  <input
                    id="verify-product"
                    className="av-input"
                    type="text"
                    placeholder={t('soil.productNamePlaceholder')}
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    required
                  />
                </div>

                <div className="av-field">
                  <label htmlFor="verify-category">{t('soil.categoryLabel')}</label>
                  <select
                    id="verify-category"
                    className="av-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as InputCategory)}
                  >
                    <option value="fertilizer">Fertilizer</option>
                    <option value="seed">Seed</option>
                    <option value="pesticide">Pesticide</option>
                    <option value="bio_stimulant">Bio-Stimulant</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="av-field">
                  <label htmlFor="verify-brand">{t('soil.brandLabel')}</label>
                  <input
                    id="verify-brand"
                    className="av-input"
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                  />
                </div>

                <div className="av-field">
                  <label htmlFor="verify-manufacturer">{t('soil.manufacturerLabel')}</label>
                  <input
                    id="verify-manufacturer"
                    className="av-input"
                    type="text"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                  />
                </div>

                <div className="av-field">
                  <label htmlFor="verify-batch">{t('soil.batchNumberLabel')}</label>
                  <input
                    id="verify-batch"
                    className="av-input"
                    type="text"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                  />
                </div>

                <div className="av-field">
                  <label htmlFor="verify-reg">{t('soil.regNumberLabel')}</label>
                  <input
                    id="verify-reg"
                    className="av-input"
                    type="text"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                  />
                </div>

                <div className="av-field">
                  <label htmlFor="verify-mode">{t('soil.providerModeLabel')}</label>
                  <select
                    id="verify-mode"
                    className="av-select"
                    value={verifyMode}
                    onChange={(e) =>
                      setVerifyMode(e.target.value as 'auto' | 'official' | 'demo')
                    }
                  >
                    <option value="auto">{t('soil.modeAuto')}</option>
                    <option value="official">{t('soil.modeGovernment')}</option>
                    <option value="demo">{t('soil.modeDemo')}</option>
                  </select>
                </div>
              </div>

              <div>
                <Button type="submit" variant="primary" loading={verifySubmitting}>
                  {verifySubmitting ? t('soil.verifying') : t('soil.verifyButton')}
                </Button>
              </div>
            </form>
          </Card>

          {latestVerification ? (
            <Card tone="accent">
              <CardHeader
                title={latestVerification.productName}
                subtitle={`${latestVerification.category} · ${latestVerification.batchNumber ?? 'No batch'}`}
                action={
                  <StatusBadge tone={verificationTone(latestVerification.verificationStatus)}>
                    {latestVerification.verificationStatus}
                  </StatusBadge>
                }
              />
              <p style={{ margin: '0 0 8px', fontSize: 13.5 }}>
                {formatEvidenceText(latestVerification.evidence, latestVerification.notes)}
              </p>
              {latestVerification.verificationStatus === 'demo' ? (
                <small style={{ color: 'var(--av-muted)' }}>{t('soil.demoDisclaimer')}</small>
              ) : null}
              {latestVerification.verificationStatus === 'not_found' ? (
                <small style={{ color: 'var(--av-warning-text)' }}>{t('soil.notFoundAdvice')}</small>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <CardHeader title={t('soil.verificationHistoryHeading')} />
            {verifications.length > 0 ? (
              <div className="table-scroll">
                <table className="av-table">
                  <thead>
                    <tr>
                      <th>{t('soil.productNameLabel')}</th>
                      <th>{t('soil.categoryLabel')}</th>
                      <th>{t('soil.batchNumberLabel')}</th>
                      <th>{t('common.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verifications.map((item) => (
                      <tr key={item.id}>
                        <td>{item.productName}</td>
                        <td>{item.category}</td>
                        <td>{item.batchNumber ?? '—'}</td>
                        <td>
                          <StatusBadge tone={verificationTone(item.verificationStatus)}>
                            {item.verificationStatus}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="av-card-subtitle">{t('soil.noVerifications')}</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
