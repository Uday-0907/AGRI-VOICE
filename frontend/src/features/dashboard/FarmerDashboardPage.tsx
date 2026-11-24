import { useCallback, useEffect, useState } from 'react';
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
} from '../../components/ui';
import { fetchSoilDashboard } from '../../services/soilService';
import { fetchWeatherAlerts, fetchWeatherDashboard } from '../../services/weatherService';
import type {
  SoilDashboardData,
  WeatherAlertItem,
  WeatherDashboardData,
} from '../../types/api';

export default function FarmerDashboardPage({
  onOpenVoiceDrawer,
}: {
  onOpenVoiceDrawer: () => void;
}) {
  const { t } = useTranslation('common');
  const { navigate } = useRouter();
  const { session, signInDemo, selectFarm } = useAuth();

  const [weather, setWeather] = useState<WeatherDashboardData | null>(null);
  const [alerts, setAlerts] = useState<WeatherAlertItem[]>([]);
  const [soil, setSoil] = useState<SoilDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const [wRes, aRes, sRes] = await Promise.all([
        fetchWeatherDashboard(session),
        fetchWeatherAlerts(session),
        fetchSoilDashboard(session),
      ]);
      setWeather(wRes);
      setAlerts(aRes);
      setSoil(sRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [session, t]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (!session) {
    return (
      <div className="page-container">
        <EmptyState
          icon="👨‍🌾"
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

  return (
    <div className="page-container stack-lg">
      <SectionHeading
        eyebrow={t('dashboard.eyebrow')}
        title={`${t('dashboard.welcome')}, ${session.farmerProfile.fullName}`}
        description={`${session.farmerProfile.village}, ${session.farmerProfile.mandal}, ${session.farmerProfile.district} · ${t('dashboard.subtitle')}`}
        as="h1"
        action={
          <div className="row-wrap">
            <StatusBadge tone={session.mode === 'live' ? 'success' : 'warning'}>
              {session.mode === 'live' ? t('common.liveDataBadge') : t('common.demoDataBadge')}
            </StatusBadge>
            {session.farms.length > 0 ? (
              <select
                aria-label={t('common.selectedFarm')}
                className="av-select"
                style={{ width: 'auto' }}
                value={session.selectedFarmId}
                onChange={(e) => selectFarm(e.target.value)}
              >
                {session.farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.farmName}
                  </option>
                ))}
              </select>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => void loadDashboard()} loading={loading}>
              {t('common.refresh')}
            </Button>
          </div>
        }
      />

      {session.mode === 'demo' ? (
        <div className="av-alert av-alert--warning" role="status">
          <span>ℹ️</span>
          <span>{t('app.demoBanner')}</span>
        </div>
      ) : null}

      {loading && !weather ? <LoadingState label={t('common.loading')} /> : null}

      {error ? (
        <ErrorState
          title={t('common.error')}
          message={error}
          retryLabel={t('common.retry')}
          onRetry={() => void loadDashboard()}
        />
      ) : null}

      {!loading && !error ? (
        <>
          <section aria-label={t('dashboard.overviewHeading')} className="grid-4">
            <Card interactive onClick={() => navigate('/weather')} style={{ cursor: 'pointer' }}>
              <CardHeader
                title={t('dashboard.weatherCardTitle')}
                subtitle={weather?.farmName ?? ''}
                action={<span aria-hidden="true">🌦️</span>}
              />
              <div className="kpi-value">
                {weather?.currentWeather.temperature !== null &&
                weather?.currentWeather.temperature !== undefined
                  ? `${weather.currentWeather.temperature}°C`
                  : t('common.noData')}
              </div>
              <div className="kpi-meta">
                {t('weather.humidity')}: {weather?.currentWeather.humidity ?? '—'}% ·{' '}
                {t('weather.rainfall')}: {weather?.currentWeather.rainfall ?? 0} mm
              </div>
            </Card>

            <Card interactive onClick={() => navigate('/soil')} style={{ cursor: 'pointer' }}>
              <CardHeader
                title={t('dashboard.soilCardTitle')}
                subtitle={soil?.latestReport?.cardId ?? t('common.noData')}
                action={<span aria-hidden="true">🧪</span>}
              />
              <div className="kpi-value">
                {soil?.latestReport?.ph !== null && soil?.latestReport?.ph !== undefined
                  ? `pH ${soil.latestReport.ph}`
                  : soil?.summary.overallStatus ?? t('common.noData')}
              </div>
              <div className="kpi-meta">
                {soil && soil.summary.criticalDeficiencies.length > 0
                  ? `${soil.summary.criticalDeficiencies.length} ${t('dashboard.criticalDeficienciesCount')}: ${soil.summary.criticalDeficiencies.join(', ')}`
                  : t('dashboard.noCriticalDeficiencies')}
              </div>
            </Card>

            <Card interactive onClick={() => navigate('/weather')} style={{ cursor: 'pointer' }}>
              <CardHeader
                title={t('dashboard.alertsCardTitle')}
                action={<span aria-hidden="true">⚠️</span>}
              />
              <div className="kpi-value">{alerts.length}</div>
              <div className="kpi-meta">
                {alerts.length > 0
                  ? alerts[0].headline
                  : t('weather.noAlerts')}
              </div>
            </Card>

            <Card tone="accent" interactive onClick={onOpenVoiceDrawer} style={{ cursor: 'pointer' }}>
              <CardHeader
                title={t('dashboard.voiceCardTitle')}
                subtitle={t('app.helplineNumber')}
                action={<span aria-hidden="true">🎙️</span>}
              />
              <div className="kpi-meta" style={{ marginTop: 0 }}>
                {t('voice.assistantGreeting')}
              </div>
              <div style={{ marginTop: 12 }}>
                <Button variant="primary" size="sm" onClick={onOpenVoiceDrawer}>
                  {t('dashboard.openVoice')} →
                </Button>
              </div>
            </Card>
          </section>

          <section className="grid-2">
            <Card>
              <CardHeader
                title={t('dashboard.latestAdvisories')}
                action={
                  <Button variant="ghost" size="sm" onClick={() => navigate('/weather')}>
                    {t('common.viewAll')} →
                  </Button>
                }
              />
              {weather && weather.advisories.length > 0 ? (
                <div className="stack-sm">
                  {weather.advisories.slice(0, 3).map((adv) => (
                    <div
                      key={adv.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 10,
                        border: '1px solid var(--av-border-soft)',
                        background: 'var(--av-surface-alt)',
                      }}
                    >
                      <div className="row-between" style={{ marginBottom: 6 }}>
                        <StatusBadge tone={adv.severity === 'high' ? 'danger' : 'info'}>
                          {adv.category}
                        </StatusBadge>
                        <small style={{ color: 'var(--av-muted)' }}>{adv.severity}</small>
                      </div>
                      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>
                        {adv.advisoryText}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="av-card-subtitle">{t('weather.noAdvisories')}</p>
              )}
            </Card>

            <Card>
              <CardHeader title={t('dashboard.quickActionsTitle')} />
              <div className="stack-sm">
                <Button variant="outline" fullWidth onClick={() => navigate('/weather')}>
                  🌦️ {t('dashboard.openWeather')}
                </Button>
                <Button variant="outline" fullWidth onClick={() => navigate('/soil')}>
                  🌱 {t('dashboard.openSoil')}
                </Button>
                <Button variant="outline" fullWidth onClick={() => navigate('/soil')}>
                  🧾 {t('dashboard.verifyInputAction')}
                </Button>
                <Button variant="primary" fullWidth onClick={onOpenVoiceDrawer}>
                  🎙️ {t('dashboard.openVoice')}
                </Button>
              </div>
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}
