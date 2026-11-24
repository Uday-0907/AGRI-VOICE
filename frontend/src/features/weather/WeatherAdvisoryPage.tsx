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
import {
  fetchFarmAdvisories,
  fetchFieldForecast,
  fetchWeatherAlerts,
  fetchWeatherDashboard,
  refreshWeatherData,
} from '../../services/weatherService';
import type {
  AdvisoryCategory,
  WeatherAdvisoryItem,
  WeatherAlertItem,
  WeatherDashboardData,
  WeatherForecastItem,
} from '../../types/api';

const ADVISORY_CATEGORIES: ReadonlyArray<AdvisoryCategory | 'all'> = [
  'all',
  'irrigation',
  'fertilizer',
  'pesticide',
  'harvest',
  'sowing',
  'weather_alert',
  'crop_protection',
  'general',
];

function formatForecastTime(iso: string, mode: 'daily' | 'hourly'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  if (mode === 'hourly') {
    return date.toLocaleString(undefined, {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function WeatherAdvisoryPage() {
  const { t } = useTranslation('common');
  const { navigate } = useRouter();
  const { session, signInDemo } = useAuth();

  const [dashboard, setDashboard] = useState<WeatherDashboardData | null>(null);
  const [forecastType, setForecastType] = useState<'daily' | 'hourly'>('daily');
  const [forecast, setForecast] = useState<WeatherForecastItem[]>([]);
  const [alerts, setAlerts] = useState<WeatherAlertItem[]>([]);
  const [advisories, setAdvisories] = useState<WeatherAdvisoryItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<AdvisoryCategory | 'all'>('all');

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedFarm = session?.farms.find((f) => f.id === session.selectedFarmId) ?? session?.farms[0];

  const loadWeather = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const farmId = selectedFarm?.id ?? session.selectedFarmId;
      const fieldId = selectedFarm?.fieldId ?? farmId;
      const [dashRes, forecastRes, alertsRes, advRes] = await Promise.all([
        fetchWeatherDashboard(session),
        fetchFieldForecast(session, fieldId, forecastType, forecastType === 'hourly' ? 2 : 7),
        fetchWeatherAlerts(session),
        fetchFarmAdvisories(session, farmId, categoryFilter),
      ]);
      setDashboard(dashRes);
      setForecast(forecastRes.forecast);
      setAlerts(alertsRes);
      setAdvisories(advRes.advisories);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [session, selectedFarm, forecastType, categoryFilter, t]);

  useEffect(() => {
    void loadWeather();
  }, [loadWeather]);

  const handleRefresh = async () => {
    if (!session) return;
    setRefreshing(true);
    try {
      await refreshWeatherData(session, selectedFarm?.id, true);
      await loadWeather();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setRefreshing(false);
    }
  };

  if (!session) {
    return (
      <div className="page-container">
        <EmptyState
          icon="🌦️"
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
        eyebrow={t('weather.eyebrow')}
        title={t('weather.title')}
        description={t('weather.subtitle')}
        as="h1"
        action={
          <div className="row-wrap">
            <StatusBadge tone={session.mode === 'live' ? 'success' : 'warning'}>
              {session.mode === 'live' ? t('common.liveDataBadge') : t('common.demoDataBadge')}
            </StatusBadge>
            <Button
              variant="outline"
              size="sm"
              loading={refreshing}
              onClick={() => void handleRefresh()}
            >
              {refreshing ? t('common.refreshing') : t('common.refresh')}
            </Button>
          </div>
        }
      />

      {loading && !dashboard ? <LoadingState label={t('common.loading')} /> : null}

      {error ? (
        <ErrorState
          title={t('common.error')}
          message={error}
          retryLabel={t('common.retry')}
          onRetry={() => void loadWeather()}
        />
      ) : null}

      {dashboard ? (
        <>
          <section className="weather-hero-card" aria-label={t('weather.currentHeading')}>
            <div>
              <span className="kpi-label">{dashboard.farmName}</span>
              <div className="weather-temp">
                {dashboard.currentWeather.temperature !== null
                  ? `${dashboard.currentWeather.temperature}°C`
                  : '—'}
              </div>
              <div className="row-wrap">
                <StatusBadge tone="info">
                  {t('weather.dataStatusLabel')}: {dashboard.currentWeather.dataStatus}
                </StatusBadge>
                {dashboard.todayForecast ? (
                  <span style={{ fontSize: 13, opacity: 0.9 }}>
                    {t('weather.todayRange')}: {dashboard.todayForecast.high ?? '—'}° /{' '}
                    {dashboard.todayForecast.low ?? '—'}° · {t('weather.rainChance')}:{' '}
                    {dashboard.todayForecast.rainfallProb ?? 0}%
                  </span>
                ) : null}
              </div>
            </div>

            <div className="weather-metrics">
              <div className="weather-metric-box">
                <small>{t('weather.humidity')}</small>
                <strong>{dashboard.currentWeather.humidity ?? '—'}%</strong>
              </div>
              <div className="weather-metric-box">
                <small>{t('weather.rainfall')}</small>
                <strong>{dashboard.currentWeather.rainfall} mm</strong>
              </div>
              <div className="weather-metric-box">
                <small>{t('weather.windSpeed')}</small>
                <strong>{dashboard.currentWeather.windSpeed ?? '—'} km/h</strong>
              </div>
            </div>
          </section>

          <section className="stack-md">
            <div className="row-between">
              <h2 className="av-card-title" style={{ fontSize: 20 }}>
                {t('weather.forecastHeading')}
              </h2>
              <div className="tab-bar" role="tablist" aria-label={t('weather.forecastHeading')}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={forecastType === 'daily'}
                  className={`tab-btn ${forecastType === 'daily' ? 'is-active' : ''}`}
                  onClick={() => setForecastType('daily')}
                >
                  {t('weather.dailyTab')}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={forecastType === 'hourly'}
                  className={`tab-btn ${forecastType === 'hourly' ? 'is-active' : ''}`}
                  onClick={() => setForecastType('hourly')}
                >
                  {t('weather.hourlyTab')}
                </button>
              </div>
            </div>

            {forecast.length > 0 ? (
              <div className="forecast-grid">
                {forecast.map((item) => (
                  <Card key={item.validAt}>
                    <div className="stack-sm">
                      <strong style={{ fontSize: 13.5, color: 'var(--av-dark-green)' }}>
                        {formatForecastTime(item.validAt, forecastType)}
                      </strong>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>
                        {forecastType === 'hourly' && item.temperature !== null && item.temperature !== undefined
                          ? `${item.temperature}°C`
                          : `${item.temperatureMin ?? '—'}° / ${item.temperatureMax ?? '—'}°`}
                      </div>
                      <span style={{ fontSize: 12.5, color: 'var(--av-text-secondary)' }}>
                        {item.weatherDescription ?? '—'}
                      </span>
                      <small style={{ color: 'var(--av-muted)' }}>
                        {t('weather.rainChance')}: {item.rainfallProbability ?? 0}%
                      </small>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState title={t('common.noData')} description={t('weather.forecastHeading')} />
            )}
          </section>

          <section className="grid-2">
            <Card>
              <CardHeader title={t('weather.alertsHeading')} />
              {alerts.length > 0 ? (
                <div className="stack-sm">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="av-alert av-alert--warning">
                      <div>
                        <div className="row-wrap" style={{ marginBottom: 4 }}>
                          <strong>{alert.headline}</strong>
                          <StatusBadge tone="warning">{alert.severity}</StatusBadge>
                        </div>
                        <p style={{ margin: '0 0 6px' }}>{alert.description}</p>
                        {alert.recommendedAction ? (
                          <small>
                            <strong>{t('weather.recommendedAction')}:</strong> {alert.recommendedAction}
                          </small>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="av-card-subtitle">{t('weather.noAlerts')}</p>
              )}
            </Card>

            <Card>
              <CardHeader
                title={t('weather.advisoriesHeading')}
                action={
                  <select
                    aria-label={t('weather.categoryFilter')}
                    className="av-select"
                    style={{ width: 'auto', padding: '7px 10px', fontSize: 12.5 }}
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value as AdvisoryCategory | 'all')}
                  >
                    {ADVISORY_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {t(`weather.categories.${cat}`)}
                      </option>
                    ))}
                  </select>
                }
              />

              {advisories.length > 0 ? (
                <div className="stack-sm">
                  {advisories.map((adv) => (
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
                        <StatusBadge tone="info">
                          {t(`weather.categories.${adv.category}`, { defaultValue: adv.category })}
                        </StatusBadge>
                        <StatusBadge tone={adv.severity === 'high' ? 'danger' : 'neutral'}>
                          {adv.severity}
                        </StatusBadge>
                      </div>
                      <p style={{ margin: '0 0 6px', fontSize: 13.5, lineHeight: 1.55 }}>
                        {adv.advisoryText}
                      </p>
                      {adv.evidenceSource ? (
                        <small style={{ color: 'var(--av-muted)' }}>
                          {t('weather.evidenceSource')}: {adv.evidenceSource}
                        </small>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="av-card-subtitle">{t('weather.noAdvisories')}</p>
              )}
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}
