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
import { ApiError } from '../../services/apiClient';
import { initializeSampleHistory } from '../../services/buyerService';
import { DEMO_WEATHER_ALERTS, DEMO_WEATHER_DASHBOARD } from '../../services/demoData';
import { fetchSoilDashboard } from '../../services/soilService';
import {
  getFarmCurrentWeather,
  getWeatherAlerts,
  getWeatherDashboard,
} from '../../services/weatherApi';
import type { SoilDashboardData } from '../../types/api';
import type { WeatherAlertItem, WeatherDashboardData } from '../../types/weather';

export default function FarmerDashboardPage({
  onOpenVoiceDrawer,
}: {
  onOpenVoiceDrawer: () => void;
}) {
  const { t } = useTranslation('common');
  const { navigate } = useRouter();
  const { session, signInDemo, selectFarm, logout } = useAuth();

  const [weather, setWeather] = useState<WeatherDashboardData | null>(null);
  const [selectedFarmTemp, setSelectedFarmTemp] = useState<number | null>(null);
  const [selectedFarmHumidity, setSelectedFarmHumidity] = useState<number | null>(null);
  const [selectedFarmRainfall, setSelectedFarmRainfall] = useState<number | null>(null);
  const [selectedFarmName, setSelectedFarmName] = useState<string>('');
  const [selectedFarmStatus, setSelectedFarmStatus] = useState<string>('');
  const [alerts, setAlerts] = useState<WeatherAlertItem[]>([]);
  const [soil, setSoil] = useState<SoilDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [weatherNotice, setWeatherNotice] = useState<string | null>(null);
  const [sampleInitNotice, setSampleInitNotice] = useState<string | null>(null);
  const [initializingSample, setInitializingSample] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    setWeatherNotice(null);

    if (session.mode === 'demo') {
      try {
        const sRes = await fetchSoilDashboard(session);
        setWeather(DEMO_WEATHER_DASHBOARD as unknown as WeatherDashboardData);
        setSelectedFarmName(DEMO_WEATHER_DASHBOARD.farmName);
        setSelectedFarmTemp(DEMO_WEATHER_DASHBOARD.currentWeather.temperature);
        setSelectedFarmHumidity(DEMO_WEATHER_DASHBOARD.currentWeather.humidity);
        setSelectedFarmRainfall(DEMO_WEATHER_DASHBOARD.currentWeather.rainfall);
        setSelectedFarmStatus(DEMO_WEATHER_DASHBOARD.currentWeather.dataStatus);
        setAlerts(DEMO_WEATHER_ALERTS as unknown as WeatherAlertItem[]);
        setSoil(sRes);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const [wRes, aRes, sRes] = await Promise.allSettled([
        getWeatherDashboard(session.token),
        getWeatherAlerts(session.token),
        fetchSoilDashboard(session),
      ]);

      // Handle 401 across any endpoint
      for (const r of [wRes, aRes, sRes]) {
        if (r.status === 'rejected' && r.reason instanceof ApiError && r.reason.status === 401) {
          logout();
          return;
        }
      }

      if (wRes.status === 'fulfilled') {
        setWeather(wRes.value);
        setSelectedFarmName(wRes.value.farmName);
        setSelectedFarmTemp(wRes.value.currentWeather.temperature);
        setSelectedFarmHumidity(wRes.value.currentWeather.humidity);
        setSelectedFarmRainfall(wRes.value.currentWeather.rainfall);
        setSelectedFarmStatus(wRes.value.currentWeather.dataStatus);

        if (session.selectedFarmId && session.selectedFarmId !== wRes.value.farmId) {
          try {
            const farmCur = await getFarmCurrentWeather(session.token, session.selectedFarmId);
            setSelectedFarmName(farmCur.farmName);
            setSelectedFarmTemp(farmCur.temperature);
            setSelectedFarmHumidity(farmCur.humidity);
            setSelectedFarmRainfall(farmCur.rainfall ?? 0);
            setSelectedFarmStatus(farmCur.dataStatus);
          } catch {
            // Keep dashboard fallback notice if farm-specific call fails
          }
        }
      } else {
        setWeather(null);
        const reason = wRes.reason;
        setWeatherNotice(
          reason instanceof Error ? reason.message : 'Weather overview unavailable.'
        );
      }

      if (aRes.status === 'fulfilled') {
        setAlerts(aRes.value.alerts);
      } else {
        setAlerts([]);
      }

      if (sRes.status === 'fulfilled') {
        setSoil(sRes.value);
      } else {
        setSoil(null);
      }

      if (wRes.status === 'rejected' && sRes.status === 'rejected') {
        const msg =
          wRes.reason instanceof Error ? wRes.reason.message : t('common.error');
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [session, logout, t]);

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

  const profileLocation = session.farmerProfile
    ? `${session.farmerProfile.village}, ${session.farmerProfile.mandal}, ${session.farmerProfile.district} · `
    : '';
  const profileName = session.farmerProfile?.fullName ?? session.user.phone;

  return (
    <div className="page-container stack-lg">
      <SectionHeading
        eyebrow={t('dashboard.eyebrow')}
        title={`${t('dashboard.welcome')}, ${profileName}`}
        description={`${profileLocation}${t('dashboard.subtitle')}`}
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

      {weatherNotice && !error ? (
        <div className="av-alert av-alert--info" role="status">
          <span>ℹ️</span>
          <span>{weatherNotice}</span>
        </div>
      ) : null}

      {loading && !weather && !soil ? <LoadingState label={t('common.loading')} /> : null}

      {error ? (
        <ErrorState
          title={t('common.error')}
          message={error}
          retryLabel={t('common.retry')}
          onRetry={() => void loadDashboard()}
        />
      ) : null}

      {!error ? (
        <>
          <section aria-label={t('dashboard.overviewHeading')} className="grid-4">
            <Card interactive onClick={() => navigate('/weather')} style={{ cursor: 'pointer' }}>
              <CardHeader
                title={t('dashboard.weatherCardTitle')}
                subtitle={selectedFarmName || t('common.noData')}
                action={<span aria-hidden="true">🌦️</span>}
              />
              <div className="kpi-value">
                {selectedFarmTemp !== null ? `${selectedFarmTemp}°C` : '—'}
              </div>
              <div className="kpi-meta">
                {t('weather.humidity')}: {selectedFarmHumidity ?? '—'}% ·{' '}
                {t('weather.rainfall')}: {selectedFarmRainfall ?? 0} mm
                {selectedFarmStatus ? ` · ${selectedFarmStatus}` : ''}
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
                {alerts.length > 0 ? alerts[0].headline : t('weather.noAlerts')}
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
                        <StatusBadge
                          tone={
                            adv.severity === 'urgent' || adv.severity === 'high'
                              ? 'danger'
                              : adv.severity === 'warning'
                              ? 'warning'
                              : 'info'
                          }
                        >
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
                <Button variant="outline" fullWidth onClick={() => navigate('/markets')}>
                  🏪 Markets & Buyer Requests
                </Button>
                <Button variant="outline" fullWidth onClick={() => navigate('/machinery')}>
                  🚜 Farm Machinery & Equipment
                </Button>
                <Button variant="outline" fullWidth onClick={() => navigate('/institutions')}>
                  🏛️ Schemes & Financial Inclusion
                </Button>
                <Button variant="outline" fullWidth onClick={() => navigate('/research')}>
                  📚 Research & Extension
                </Button>
                <Button variant="outline" fullWidth onClick={() => navigate('/notifications')}>
                  🔔 Notifications & History
                </Button>
                <Button variant="primary" fullWidth onClick={onOpenVoiceDrawer}>
                  🎙️ {t('dashboard.openVoice')}
                </Button>
                {session.mode === 'live' ? (
                  <Button
                    variant="secondary"
                    fullWidth
                    loading={initializingSample}
                    onClick={async () => {
                      setInitializingSample(true);
                      setSampleInitNotice(null);
                      try {
                        const res = await initializeSampleHistory(session);
                        setSampleInitNotice(res.message);
                        await loadDashboard();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Unable to initialize sample history.');
                      } finally {
                        setInitializingSample(false);
                      }
                    }}
                  >
                    ✨ Initialize Sample Presentation History
                  </Button>
                ) : null}
                {sampleInitNotice ? (
                  <div className="av-alert av-alert--info" role="status">{sampleInitNotice}</div>
                ) : null}
              </div>
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}
