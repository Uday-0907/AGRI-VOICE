import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useRouter } from '@/app/routes/routes';
import { ApiError } from '@/services/apiClient';
import {
  getAuthMe,
  getFarmAdvisories,
  getFarmCurrentWeather,
  getFieldForecast,
  getWeatherAlerts,
  getWeatherDashboard,
  refreshWeather,
} from '@/services/weatherApi';
import type {
  AdvisoryCategory,
  AdvisoryVerificationStatus,
  DataStatus,
  FarmAdvisoryItem,
  FarmCurrentWeatherData,
  FarmerFarm,
  FarmerProfileSummary,
  ForecastItem,
  TodayForecastSummary,
  WeatherAlertItem,
  WeatherDashboardData,
} from '@/types/weather';

const DEMO_FORECAST = [
  { day: 'Day 1 (Sample)', icon: '☀️', condition: 'Sunny (Sample)', min: '22°C', max: '30°C', rain: '10%' },
  { day: 'Day 2 (Sample)', icon: '🌤️', condition: 'Partly Cloudy (Sample)', min: '23°C', max: '29°C', rain: '20%' },
  { day: 'Day 3 (Sample)', icon: '🌧️', condition: 'Rainy (Sample)', min: '21°C', max: '27°C', rain: '70%' },
  { day: 'Day 4 (Sample)', icon: '⛅', condition: 'Cloudy (Sample)', min: '22°C', max: '28°C', rain: '30%' },
  { day: 'Day 5 (Sample)', icon: '☀️', condition: 'Sunny (Sample)', min: '23°C', max: '31°C', rain: '5%' },
];

const DEMO_ADVISORIES = [
  {
    icon: '💧',
    title: 'Water Management (Sample)',
    category: 'irrigation',
    description: 'Check soil moisture before scheduling irrigation. This is a general demo reminder.',
  },
  {
    icon: '🌱',
    title: 'Crop Monitoring (Sample)',
    category: 'crop_protection',
    description: 'Inspect crops regularly for visible signs of pests or disease. Sample demonstration text.',
  },
  {
    icon: '🌦️',
    title: 'Weather Planning (Sample)',
    category: 'general',
    description: 'Review local weather forecasts before planning outdoor farm activities. Sample preview only.',
  },
];

const ADVISORY_CATEGORIES: Array<{ value: '' | AdvisoryCategory; label: string }> = [
  { value: '', label: 'All Categories' },
  { value: 'irrigation', label: 'Irrigation' },
  { value: 'fertilizer', label: 'Fertilizer' },
  { value: 'pesticide', label: 'Pesticide' },
  { value: 'harvest', label: 'Harvest' },
  { value: 'sowing', label: 'Sowing' },
  { value: 'weather_alert', label: 'Weather Alert' },
  { value: 'crop_protection', label: 'Crop Protection' },
  { value: 'general', label: 'General' },
];

function getWeatherEmoji(code: number | null | undefined, description?: string | null): string {
  if (code !== null && code !== undefined) {
    if (code === 0) return '☀️';
    if (code <= 2) return '🌤️';
    if (code === 3) return '☁️';
    if (code === 45 || code === 48) return '🌫️';
    if (code >= 51 && code <= 67) return '🌧️';
    if (code >= 71 && code <= 86) return '🌦️';
    if (code >= 95) return '⛈️';
  }
  const desc = (description || '').toLowerCase();
  if (desc.includes('storm')) return '⛈️';
  if (desc.includes('rain') || desc.includes('drizzle')) return '🌧️';
  if (desc.includes('cloud')) return '⛅';
  if (desc.includes('clear')) return '☀️';
  return '🌤️';
}

function formatDateLabel(isoString: string, mode: 'daily' | 'hourly'): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
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

function formatTimestamp(isoString: string | null | undefined): string {
  if (!isoString) return 'Unknown';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return d.toLocaleString();
}

function formatNumber(val: number | null | undefined, unit: string, fallback = 'N/A'): string {
  if (val === null || val === undefined || Number.isNaN(val)) return fallback;
  return `${val}${unit}`;
}

function getVerificationBadgeInfo(status: AdvisoryVerificationStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case 'verified':
      return { label: 'Verified Advisory', className: 'badge badge-verified' };
    case 'requires_review':
      return { label: 'Requires Review (Unverified)', className: 'badge badge-review' };
    case 'rejected':
      return { label: 'Rejected — Do Not Apply', className: 'badge badge-rejected' };
    case 'generated':
    default:
      return { label: 'System-Generated (Unverified)', className: 'badge badge-generated' };
  }
}

function getDataStatusClass(status: DataStatus): string {
  switch (status) {
    case 'LIVE':
      return 'status-pill status-live';
    case 'CACHED':
      return 'status-pill status-cached';
    case 'STALE':
      return 'status-pill status-stale';
    case 'UNAVAILABLE':
    default:
      return 'status-pill status-unavailable';
  }
}

export interface WeatherDashboardContentProps {
  backendToken: string | null;
  authStatus: 'loading' | 'unauthenticated' | 'authenticated' | 'error';
  authErrorMessage?: string | null;
  authErrorCode?: string | null;
  farmerProfile?: FarmerProfileSummary | null;
  initialFarms?: FarmerFarm[];
  selectedFarmIdOverride?: string;
  onSelectFarm?: (farmId: string) => void;
  clerkDisplayName?: string | null;
  embedded?: boolean;
  forceDemoPreview?: boolean;
  onExitDemoPreview?: () => void;
  onRetryAuth?: () => void;
  onUnauthorized?: () => void;
  renderAuthControls?: () => React.ReactNode;
}

export function WeatherDashboardContent({
  backendToken,
  authStatus,
  authErrorMessage = null,
  authErrorCode = null,
  farmerProfile: initialProfile = null,
  initialFarms = [],
  selectedFarmIdOverride,
  onSelectFarm,
  clerkDisplayName = null,
  embedded = false,
  forceDemoPreview = false,
  onExitDemoPreview,
  onRetryAuth,
  onUnauthorized,
  renderAuthControls,
}: WeatherDashboardContentProps) {
  const [localDemoPreview, setLocalDemoPreview] = useState(false);
  const previewDemoMode = forceDemoPreview || localDemoPreview;

  const [farmerProfile, setFarmerProfile] = useState<FarmerProfileSummary | null>(initialProfile);
  const [farmsList, setFarmsList] = useState<FarmerFarm[]>(initialFarms);
  const [selectedFarmId, setSelectedFarmId] = useState<string>(selectedFarmIdOverride || '');
  const [selectedFieldId, setSelectedFieldId] = useState<string>('');
  const [forecastType, setForecastType] = useState<'daily' | 'hourly'>('daily');
  const [advisoryCategory, setAdvisoryCategory] = useState<'' | AdvisoryCategory>('');

  const [dashboardFallback, setDashboardFallback] = useState<WeatherDashboardData | null>(null);
  const [currentWeather, setCurrentWeather] = useState<FarmCurrentWeatherData | null>(null);
  const [forecast, setForecast] = useState<ForecastItem[]>([]);
  const [forecastFieldName, setForecastFieldName] = useState<string | null>(null);
  const [advisories, setAdvisories] = useState<FarmAdvisoryItem[]>([]);
  const [alerts, setAlerts] = useState<WeatherAlertItem[]>([]);

  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingFarmData, setLoadingFarmData] = useState(false);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [loadingAdvisories, setLoadingAdvisories] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [mainError, setMainError] = useState<{ code: string; message: string } | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [advisoryError, setAdvisoryError] = useState<string | null>(null);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    setFarmerProfile(initialProfile);
  }, [initialProfile]);

  useEffect(() => {
    if (initialFarms.length > 0) {
      setFarmsList(initialFarms);
    }
  }, [initialFarms]);

  useEffect(() => {
    if (selectedFarmIdOverride) {
      setSelectedFarmId(selectedFarmIdOverride);
    }
  }, [selectedFarmIdOverride]);

  const selectedFarm = useMemo(
    () => farmsList.find((f) => f.id === selectedFarmId) || null,
    [farmsList, selectedFarmId]
  );

  const availableFields = useMemo(() => selectedFarm?.fields || [], [selectedFarm]);

  const handleApiFailure = useCallback(
    (err: unknown): { code: string; message: string } => {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          onUnauthorized?.();
          return {
            code: 'UNAUTHORIZED',
            message: 'Your session expired or was rejected. Please sign in again.',
          };
        }
        return { code: err.code, message: err.message };
      }
      return {
        code: 'UNKNOWN_ERROR',
        message: err instanceof Error ? err.message : 'Unexpected error occurred.',
      };
    },
    [onUnauthorized]
  );

  // 1. Load initial authenticated farmer context, dashboard overview, and alerts
  useEffect(() => {
    if (authStatus !== 'authenticated' || !backendToken || previewDemoMode) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    async function loadInitial() {
      setLoadingInitial(true);
      setMainError(null);
      setAlertsError(null);

      try {
        const [meResult, dashResult, alertsResult] = await Promise.allSettled([
          getAuthMe(backendToken!, controller.signal),
          getWeatherDashboard(backendToken!, controller.signal),
          getWeatherAlerts(backendToken!, controller.signal),
        ]);

        if (cancelled) return;

        let resolvedFarms: FarmerFarm[] = [];
        if (meResult.status === 'fulfilled') {
          setFarmerProfile(meResult.value.farmerProfile);
          resolvedFarms = meResult.value.farms;
          setFarmsList(resolvedFarms);
        } else {
          const parsed = handleApiFailure(meResult.reason);
          if (parsed.code === 'UNAUTHORIZED') {
            setMainError(parsed);
            return;
          }
        }

        if (dashResult.status === 'fulfilled') {
          setDashboardFallback(dashResult.value);
          if (resolvedFarms.length === 0) {
            resolvedFarms = [
              {
                id: dashResult.value.farmId,
                farmName: dashResult.value.farmName,
                totalAreaAcres: null,
                ownershipType: 'owned',
                fields: [],
              },
            ];
            setFarmsList(resolvedFarms);
          }
        } else {
          const parsed = handleApiFailure(dashResult.reason);
          if (
            resolvedFarms.length === 0 ||
            parsed.code === 'NO_FARM' ||
            parsed.code === 'FORBIDDEN' ||
            parsed.code === 'UNAUTHORIZED'
          ) {
            setMainError(parsed);
          }
        }

        if (alertsResult.status === 'fulfilled') {
          setAlerts(alertsResult.value.alerts);
        } else {
          const parsed = handleApiFailure(alertsResult.reason);
          setAlertsError(parsed.message);
        }

        if (resolvedFarms.length > 0) {
          setSelectedFarmId((prev) => {
            if (selectedFarmIdOverride && resolvedFarms.some((f) => f.id === selectedFarmIdOverride)) {
              return selectedFarmIdOverride;
            }
            return prev && resolvedFarms.some((f) => f.id === prev) ? prev : resolvedFarms[0].id;
          });
        } else {
          setSelectedFarmId('');
        }
      } finally {
        if (!cancelled) {
          setLoadingInitial(false);
        }
      }
    }

    loadInitial();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    authStatus,
    backendToken,
    previewDemoMode,
    reloadNonce,
    selectedFarmIdOverride,
    handleApiFailure,
  ]);

  // Keep selectedFieldId synchronized with the selected farm's real fields
  useEffect(() => {
    if (!selectedFarm) {
      setSelectedFieldId('');
      return;
    }
    setSelectedFieldId((prev) => {
      if (prev && selectedFarm.fields.some((fld) => fld.id === prev)) {
        return prev;
      }
      return selectedFarm.fields[0]?.id || '';
    });
  }, [selectedFarm]);

  // 2. Load farm-specific current weather whenever selectedFarmId changes
  useEffect(() => {
    if (authStatus !== 'authenticated' || !backendToken || !selectedFarmId || previewDemoMode) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    async function loadFarmWeather() {
      setLoadingFarmData(true);
      setWeatherError(null);
      try {
        const data = await getFarmCurrentWeather(backendToken!, selectedFarmId, controller.signal);
        if (!cancelled) {
          setCurrentWeather(data);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!cancelled) {
          const parsed = handleApiFailure(err);
          setCurrentWeather(null);
          setWeatherError(parsed.message);
        }
      } finally {
        if (!cancelled) {
          setLoadingFarmData(false);
        }
      }
    }

    loadFarmWeather();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [authStatus, backendToken, selectedFarmId, previewDemoMode, reloadNonce, handleApiFailure]);

  // 3. Load farm-specific advisories whenever selectedFarmId or advisoryCategory changes
  useEffect(() => {
    if (authStatus !== 'authenticated' || !backendToken || !selectedFarmId || previewDemoMode) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    async function loadAdvisories() {
      setLoadingAdvisories(true);
      setAdvisoryError(null);
      try {
        const data = await getFarmAdvisories(
          backendToken!,
          selectedFarmId,
          advisoryCategory || undefined,
          controller.signal
        );
        if (!cancelled) {
          setAdvisories(data.advisories);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!cancelled) {
          const parsed = handleApiFailure(err);
          setAdvisories([]);
          setAdvisoryError(parsed.message);
        }
      } finally {
        if (!cancelled) {
          setLoadingAdvisories(false);
        }
      }
    }

    loadAdvisories();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    authStatus,
    backendToken,
    selectedFarmId,
    advisoryCategory,
    previewDemoMode,
    reloadNonce,
    handleApiFailure,
  ]);

  // 4. Load field-specific forecast whenever selectedFieldId or forecastType changes
  useEffect(() => {
    if (authStatus !== 'authenticated' || !backendToken || previewDemoMode) {
      return;
    }
    if (!selectedFieldId) {
      setForecast([]);
      setForecastFieldName(null);
      setForecastError(null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    async function loadForecast() {
      setLoadingForecast(true);
      setForecastError(null);
      try {
        const days = forecastType === 'hourly' ? 2 : 7;
        const data = await getFieldForecast(
          backendToken!,
          selectedFieldId,
          { days, type: forecastType },
          controller.signal
        );
        if (!cancelled) {
          setForecast(data.forecast);
          setForecastFieldName(data.fieldName);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!cancelled) {
          const parsed = handleApiFailure(err);
          setForecast([]);
          setForecastError(parsed.message);
        }
      } finally {
        if (!cancelled) {
          setLoadingForecast(false);
        }
      }
    }

    loadForecast();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    authStatus,
    backendToken,
    selectedFieldId,
    forecastType,
    previewDemoMode,
    reloadNonce,
    handleApiFailure,
  ]);

  const handleRefresh = async () => {
    if (!backendToken || !selectedFarmId) return;
    setRefreshing(true);
    setStatusMessage(null);
    try {
      const res = await refreshWeather(backendToken, { farmId: selectedFarmId, force: true });
      setStatusMessage(res.message);
      setReloadNonce((n) => n + 1);
    } catch (err) {
      const parsed = handleApiFailure(err);
      setStatusMessage(`Refresh failed: ${parsed.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  const handleFarmChange = (farmId: string) => {
    setSelectedFarmId(farmId);
    onSelectFarm?.(farmId);
  };

  const handleExitDemo = () => {
    setLocalDemoPreview(false);
    onExitDemoPreview?.();
  };

  const Wrapper = embedded ? 'div' : 'main';

  // Explicit offline demo preview mode
  if (previewDemoMode) {
    return (
      <Wrapper className="dashboard">
        {!embedded && (
          <header className="topbar">
            <div>
              <h1>AGRI-VOICE</h1>
              <p>Smart Farming Weather &amp; Crop Advisory</p>
            </div>
            <div className="topbar-actions">
              <span className="demo-tag">DEVELOPMENT DEMO DATA</span>
              <button type="button" className="btn btn-secondary" onClick={handleExitDemo}>
                Exit Demo Preview
              </button>
            </div>
          </header>
        )}

        {embedded && (
          <div className="banner banner-warning">
            <div>
              <strong>DEVELOPMENT DEMO DATA:</strong> Showing offline sample values only. Sign in
              to connect live meteorological and farmer data.
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleExitDemo}>
              {forceDemoPreview ? 'Sign In for Live Data' : 'Exit Demo Preview'}
            </button>
          </div>
        )}

        <section className="welcome">
          <div>
            <p className="eyebrow">WEATHER DASHBOARD (DEMO PREVIEW)</p>
            <h2>Sample Farmer View</h2>
            <p>Static preview only — not connected to live meteorological or farmer data.</p>
          </div>
        </section>

        <section className="weather-card">
          <div>
            <p>CURRENT WEATHER — SAMPLE DEMO VALUES</p>
            <h2>28°C</h2>
            <h3>Partly Cloudy (Sample)</h3>
            <p>Sample Location — Offline Preview</p>
          </div>

          <div className="weather-details">
            <div>
              <small>HUMIDITY</small>
              <strong>65%</strong>
            </div>
            <div>
              <small>RAINFALL</small>
              <strong>10 mm</strong>
            </div>
            <div>
              <small>WIND</small>
              <strong>12 km/h</strong>
            </div>
          </div>
        </section>

        <section className="section">
          <h2>5-Day Weather Forecast (Sample)</h2>
          <div className="forecast-grid">
            {DEMO_FORECAST.map((item) => (
              <article className="forecast-item" key={item.day}>
                <strong>{item.day}</strong>
                <span className="forecast-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <strong>{item.condition}</strong>
                <span>
                  {item.min} / {item.max}
                </span>
                <small>Rain chance: {item.rain}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="section">
          <h2>Crop Advisory (Sample)</h2>
          <p className="muted-note">General demonstration reminders, not verified crop-specific advice.</p>
          <div className="advisory-grid">
            {DEMO_ADVISORIES.map((item) => (
              <article className="advisory-card" key={item.title}>
                <span aria-hidden="true">{item.icon}</span>
                <small>{item.category}</small>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section">
          <h2>Weather Alerts (Sample)</h2>
          <div className="alert-card">
            <span aria-hidden="true">ℹ️</span>
            <div>
              <strong>No live alerts in demo preview</strong>
              <p>Sign in with a linked farmer account to query the AgriVoice Weather API.</p>
            </div>
          </div>
        </section>

        {!embedded && (
          <footer>
            AGRI-VOICE | Weather &amp; Crop Advisory Dashboard
            <br />
            Development Demo Preview — Sample values only — Not live weather data
          </footer>
        )}
      </Wrapper>
    );
  }

  // Unauthenticated / Auth Error / Auth Loading states (NEVER silently replaced by demo data)
  if (authStatus !== 'authenticated' || !backendToken) {
    return (
      <Wrapper className="dashboard">
        {!embedded && (
          <header className="topbar">
            <div>
              <h1>AGRI-VOICE</h1>
              <p>Smart Farming Weather &amp; Crop Advisory</p>
            </div>
            <div className="topbar-actions">{renderAuthControls?.()}</div>
          </header>
        )}

        <section className="auth-gate-card" aria-live="polite">
          <p className="eyebrow">WEATHER &amp; CROP ADVISORY</p>
          {authStatus === 'loading' && (
            <>
              <h2>Verifying your session…</h2>
              <p>Connecting your account to the AgriVoice Weather backend.</p>
            </>
          )}

          {authStatus === 'unauthenticated' && (
            <>
              <h2>Sign in to access live farm weather</h2>
              <p>
                Live weather observations, field forecasts, alerts, and crop advisories require an
                authenticated AgriVoice farmer account.
              </p>
              <div className="action-row">
                {renderAuthControls?.()}
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setLocalDemoPreview(true)}
                >
                  Preview Demo Data (Offline)
                </button>
              </div>
            </>
          )}

          {authStatus === 'error' && (
            <>
              <h2>Unable to connect authenticated session</h2>
              <div className="banner banner-error" role="alert">
                <strong>{authErrorCode || 'AUTH_ERROR'}:</strong>{' '}
                {authErrorMessage || 'Could not establish a backend session.'}
              </div>
              <div className="action-row">
                {onRetryAuth && (
                  <button type="button" className="btn btn-primary" onClick={onRetryAuth}>
                    Retry Connection
                  </button>
                )}
                {renderAuthControls?.()}
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setLocalDemoPreview(true)}
                >
                  Preview Demo Data (Offline)
                </button>
              </div>
            </>
          )}
        </section>
      </Wrapper>
    );
  }

  // Authenticated live mode
  const effectiveTodayForecast: TodayForecastSummary | null =
    selectedFarmId === dashboardFallback?.farmId ? dashboardFallback.todayForecast : null;

  const displayName = farmerProfile?.fullName || clerkDisplayName || 'Farmer';

  const activeDataStatus: DataStatus =
    currentWeather?.dataStatus || dashboardFallback?.currentWeather.dataStatus || 'UNAVAILABLE';

  return (
    <Wrapper className="dashboard">
      {!embedded && (
        <header className="topbar">
          <div>
            <h1>AGRI-VOICE</h1>
            <p>Smart Farming Weather &amp; Crop Advisory</p>
          </div>
          <div className="topbar-actions">
            <span className="live-tag">LIVE FARMER SESSION</span>
            {renderAuthControls?.()}
          </div>
        </header>
      )}

      <section className="welcome">
        <div>
          <p className="eyebrow">WEATHER &amp; CROP ADVISORY</p>
          {embedded ? <h1>Welcome, {displayName}</h1> : <h2>Welcome, {displayName}</h2>}
          <p>
            {farmerProfile
              ? `${farmerProfile.village}, ${farmerProfile.mandal}, ${farmerProfile.district}, ${farmerProfile.state}`
              : 'Live farm meteorology and crop-stage advisory monitor.'}
          </p>
        </div>

        <div className="controls-panel">
          <div className="farm-select">
            <label htmlFor="farm-select">Selected Farm</label>
            <select
              id="farm-select"
              value={selectedFarmId}
              onChange={(event) => handleFarmChange(event.target.value)}
              disabled={loadingInitial || farmsList.length === 0}
            >
              {farmsList.length === 0 ? (
                <option value="">No farms registered</option>
              ) : (
                farmsList.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.farmName}
                  </option>
                ))
              )}
            </select>
          </div>

          {availableFields.length > 0 && (
            <div className="farm-select">
              <label htmlFor="field-select">Forecast Field</label>
              <select
                id="field-select"
                value={selectedFieldId}
                onChange={(event) => setSelectedFieldId(event.target.value)}
                disabled={loadingInitial}
              >
                {availableFields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.fieldName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="refresh-wrap">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleRefresh}
              disabled={refreshing || loadingInitial || !selectedFarmId}
            >
              {refreshing ? 'Refreshing…' : 'Refresh Weather'}
            </button>
          </div>
        </div>
      </section>

      {statusMessage && (
        <div className="banner banner-info" role="status" aria-live="polite">
          {statusMessage}
        </div>
      )}

      {mainError && (
        <div className="banner banner-error" role="alert">
          <div>
            <strong>{mainError.code}:</strong> {mainError.message}
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setReloadNonce((n) => n + 1)}
          >
            Retry
          </button>
        </div>
      )}

      {loadingInitial && (
        <section className="banner banner-info" aria-busy="true">
          Loading your farms, weather observations, advisories, and alerts…
        </section>
      )}

      {/* Current Weather */}
      <section className="weather-card" aria-busy={loadingFarmData}>
        <div>
          <div className="status-row">
            <p className="card-kicker">CURRENT WEATHER</p>
            <span className={getDataStatusClass(activeDataStatus)}>{activeDataStatus}</span>
          </div>

          {weatherError ? (
            <div className="weather-error-inline" role="alert">
              <h3>Weather observation unavailable</h3>
              <p>{weatherError}</p>
            </div>
          ) : currentWeather ? (
            <>
              <h2>{formatNumber(currentWeather.temperature, '°C')}</h2>
              <h3>
                <span aria-hidden="true">
                  {getWeatherEmoji(currentWeather.weatherCode, currentWeather.weatherDescription)}{' '}
                </span>
                {currentWeather.weatherDescription || 'Observation recorded'}
              </h3>
              <p>
                {currentWeather.farmName} · Source: {currentWeather.provider} · Observed:{' '}
                {formatTimestamp(currentWeather.observedAt)}
              </p>
            </>
          ) : dashboardFallback && selectedFarmId === dashboardFallback.farmId ? (
            <>
              <h2>{formatNumber(dashboardFallback.currentWeather.temperature, '°C')}</h2>
              <h3>Current Observation</h3>
              <p>
                {dashboardFallback.farmName} · Updated:{' '}
                {formatTimestamp(dashboardFallback.lastUpdated)}
              </p>
            </>
          ) : (
            <>
              <h2>--</h2>
              <h3>{loadingFarmData ? 'Loading weather…' : 'No weather data available'}</h3>
              <p>Select a registered farm with valid coordinates.</p>
            </>
          )}
        </div>

        <div className="weather-details">
          <div>
            <small>HUMIDITY</small>
            <strong>
              {formatNumber(
                currentWeather?.humidity ??
                  (selectedFarmId === dashboardFallback?.farmId
                    ? dashboardFallback?.currentWeather.humidity
                    : null),
                '%'
              )}
            </strong>
          </div>
          <div>
            <small>RAINFALL</small>
            <strong>
              {formatNumber(
                currentWeather?.rainfall ??
                  (selectedFarmId === dashboardFallback?.farmId
                    ? dashboardFallback?.currentWeather.rainfall
                    : null),
                ' mm'
              )}
            </strong>
          </div>
          <div>
            <small>WIND</small>
            <strong>
              {formatNumber(
                currentWeather?.windSpeed ??
                  (selectedFarmId === dashboardFallback?.farmId
                    ? dashboardFallback?.currentWeather.windSpeed
                    : null),
                ' km/h'
              )}
              {currentWeather?.windDirection ? ` ${currentWeather.windDirection}` : ''}
            </strong>
          </div>
          {currentWeather?.pressure !== null && currentWeather?.pressure !== undefined && (
            <div>
              <small>PRESSURE</small>
              <strong>{currentWeather.pressure} hPa</strong>
            </div>
          )}
        </div>
      </section>

      {/* Forecast */}
      <section className="section">
        <div className="section-header">
          <div>
            <h2>
              {forecastType === 'hourly' ? '48-Hour Field Forecast' : '7-Day Field Forecast'}
              {forecastFieldName ? ` — ${forecastFieldName}` : ''}
            </h2>
            {forecast.length > 0 && (
              <p className="muted-note">
                Data status: {forecast[0].dataStatus} · Provider: {forecast[0].provider}
              </p>
            )}
          </div>

          {selectedFieldId && (
            <div className="toggle-group" role="group" aria-label="Forecast interval">
              <button
                type="button"
                className={`btn btn-sm ${forecastType === 'daily' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setForecastType('daily')}
                aria-pressed={forecastType === 'daily'}
              >
                7-Day Daily
              </button>
              <button
                type="button"
                className={`btn btn-sm ${forecastType === 'hourly' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setForecastType('hourly')}
                aria-pressed={forecastType === 'hourly'}
              >
                48-Hour Hourly
              </button>
            </div>
          )}
        </div>

        {loadingForecast && <p className="muted-note">Loading field forecast…</p>}

        {forecastError && (
          <div className="banner banner-error" role="alert">
            <strong>Forecast unavailable:</strong> {forecastError}
          </div>
        )}

        {!loadingForecast && !forecastError && forecast.length > 0 && (
          <div className="forecast-grid">
            {forecast.map((item) => (
              <article className="forecast-item" key={`${item.validAt}-${item.forecastType}`}>
                <strong>{formatDateLabel(item.validAt, forecastType)}</strong>
                <span className="forecast-icon" aria-hidden="true">
                  {getWeatherEmoji(item.weatherCode, item.weatherDescription)}
                </span>
                <strong>{item.weatherDescription || 'Forecast'}</strong>
                <span>
                  {formatNumber(item.temperatureMin, '°C', '--')} /{' '}
                  {formatNumber(item.temperatureMax, '°C', '--')}
                </span>
                <small>
                  Rain chance:{' '}
                  {item.rainfallProbability !== null && item.rainfallProbability !== undefined
                    ? `${item.rainfallProbability}%`
                    : 'N/A'}
                </small>
                {item.windSpeed !== null && item.windSpeed !== undefined && (
                  <small>Wind: {item.windSpeed} km/h</small>
                )}
              </article>
            ))}
          </div>
        )}

        {!loadingForecast && !forecastError && forecast.length === 0 && (
          <>
            {effectiveTodayForecast ? (
              <div className="alert-card">
                <span aria-hidden="true">📅</span>
                <div>
                  <strong>
                    Today&apos;s Farm Outlook: Low{' '}
                    {formatNumber(effectiveTodayForecast.low, '°C')} / High{' '}
                    {formatNumber(effectiveTodayForecast.high, '°C')} · Rain chance:{' '}
                    {formatNumber(effectiveTodayForecast.rainfallProb, '%')}
                  </strong>
                  <p>
                    No registered fields were found on this farm for multi-day field-level
                    forecasts (<code>GET /weather/fields/:fieldId/forecast</code>).
                  </p>
                </div>
              </div>
            ) : (
              <div className="alert-card">
                <span aria-hidden="true">ℹ️</span>
                <div>
                  <strong>No field forecast available</strong>
                  <p>
                    {selectedFieldId
                      ? 'The weather provider returned no forecast records for this field.'
                      : 'This farm has no registered fields with coordinates for field-level forecasting.'}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Crop Advisory */}
      <section className="section">
        <div className="section-header">
          <div>
            <h2>Crop Advisory</h2>
            <p className="muted-note">
              Evidence-grounded crop advisories evaluated from farm weather and active crop seasons.
            </p>
          </div>

          <div className="farm-select">
            <label htmlFor="advisory-category">Category Filter</label>
            <select
              id="advisory-category"
              value={advisoryCategory}
              onChange={(e) => setAdvisoryCategory(e.target.value as '' | AdvisoryCategory)}
              disabled={!selectedFarmId}
            >
              {ADVISORY_CATEGORIES.map((cat) => (
                <option key={cat.value || 'all'} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loadingAdvisories && <p className="muted-note">Evaluating crop advisories…</p>}

        {advisoryError && (
          <div className="banner banner-error" role="alert">
            <strong>Advisory error:</strong> {advisoryError}
          </div>
        )}

        {!loadingAdvisories && !advisoryError && advisories.length > 0 && (
          <div className="advisory-grid">
            {advisories.map((item) => {
              const badge = getVerificationBadgeInfo(item.verificationStatus);
              return (
                <article className="advisory-card" key={item.id}>
                  <div className="advisory-meta">
                    <span className={`severity-pill severity-${item.severity}`}>
                      {item.severity.toUpperCase()}
                    </span>
                    <small>{item.category}</small>
                  </div>
                  <p className="advisory-text">{item.advisoryText}</p>
                  <div className="advisory-footer">
                    <span className={badge.className}>{badge.label}</span>
                    <small>
                      Source: {item.evidenceSource} ({item.evidenceStrength})
                    </small>
                    <small>Generated: {formatTimestamp(item.generatedAt)}</small>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!loadingAdvisories && !advisoryError && advisories.length === 0 && (
          <div className="alert-card">
            <span aria-hidden="true">🌱</span>
            <div>
              <strong>No active crop advisories</strong>
              <p>
                No advisory rules were triggered for this farm&apos;s active growing crop seasons
                {advisoryCategory ? ` in category "${advisoryCategory}"` : ''}.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Weather Alerts */}
      <section className="section">
        <h2>Weather Alerts</h2>

        {alertsError && (
          <div className="banner banner-error" role="alert">
            <strong>Alerts unavailable:</strong> {alertsError}
          </div>
        )}

        {!alertsError && alerts.length > 0 && (
          <div className="alerts-stack">
            {alerts.map((alert) => (
              <article className={`alert-card alert-severity-${alert.severity}`} key={alert.id}>
                <span aria-hidden="true">⚠️</span>
                <div>
                  <div className="advisory-meta">
                    <span className={`severity-pill severity-${alert.severity}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    <small>{alert.alertType}</small>
                  </div>
                  <strong>{alert.headline}</strong>
                  {alert.description && <p>{alert.description}</p>}
                  {alert.recommendedAction && (
                    <p>
                      <strong>Recommended action:</strong> {alert.recommendedAction}
                    </p>
                  )}
                  <small className="muted-note">
                    Valid: {formatTimestamp(alert.validFrom)} – {formatTimestamp(alert.validTo)}
                  </small>
                </div>
              </article>
            ))}
          </div>
        )}

        {!alertsError && alerts.length === 0 && (
          <div className="alert-card">
            <span aria-hidden="true">ℹ️</span>
            <div>
              <strong>No active weather alerts</strong>
              <p>
                No active weather alerts are currently recorded for your farms. Note: automated
                external alert-feed polling is not yet configured in the backend provider.
              </p>
            </div>
          </div>
        )}
      </section>

      {!embedded && (
        <footer>
          AGRI-VOICE | Weather &amp; Crop Advisory Dashboard
          <br />
          Connected to AgriVoice API · Open-Meteo meteorological data
        </footer>
      )}
    </Wrapper>
  );
}

export interface WeatherDashboardProps {
  backendTokenOverride?: string | null;
  embedded?: boolean;
  onUnauthorized?: () => void;
}

function WeatherDashboard({
  backendTokenOverride,
  embedded,
  onUnauthorized,
}: WeatherDashboardProps) {
  if (backendTokenOverride !== undefined) {
    return (
      <WeatherDashboardContent
        backendToken={backendTokenOverride}
        authStatus={backendTokenOverride ? 'authenticated' : 'unauthenticated'}
        embedded={embedded ?? false}
        onUnauthorized={onUnauthorized}
      />
    );
  }

  return <IntegratedWeatherShell embedded={embedded ?? true} />;
}

function IntegratedWeatherShell({ embedded }: { embedded: boolean }) {
  const {
    session,
    authLoading,
    authError,
    clerkAdapter,
    selectFarm,
    retryClerkExchange,
    logout,
  } = useAuth();
  const { navigate } = useRouter();

  const mappedFarms: FarmerFarm[] = useMemo(() => {
    if (!session || session.mode !== 'live') return [];
    return session.farms.map((f) => ({
      id: f.id,
      farmName: f.farmName,
      totalAreaAcres: f.totalAreaAcres !== undefined ? String(f.totalAreaAcres) : null,
      ownershipType: 'owned',
      fields: f.fields || [],
    }));
  }, [session]);

  const mappedProfile: FarmerProfileSummary | null = useMemo(() => {
    if (!session?.farmerProfile) return null;
    return {
      ...session.farmerProfile,
      status: 'active',
    };
  }, [session]);

  if (session?.mode === 'demo') {
    return (
      <WeatherDashboardContent
        backendToken={null}
        authStatus="unauthenticated"
        embedded={embedded}
        forceDemoPreview
        onExitDemoPreview={() => {
          logout();
          navigate('/login');
        }}
      />
    );
  }

  const authStatus: WeatherDashboardContentProps['authStatus'] = authLoading
    ? 'loading'
    : session?.mode === 'live'
    ? 'authenticated'
    : authError
    ? 'error'
    : 'unauthenticated';

  return (
    <WeatherDashboardContent
      backendToken={session?.mode === 'live' ? session.token : null}
      authStatus={authStatus}
      authErrorCode={authError?.code}
      authErrorMessage={authError?.message}
      farmerProfile={mappedProfile}
      initialFarms={mappedFarms}
      selectedFarmIdOverride={session?.selectedFarmId}
      onSelectFarm={selectFarm}
      clerkDisplayName={clerkAdapter?.displayName ?? null}
      embedded={embedded}
      onRetryAuth={retryClerkExchange}
      onUnauthorized={logout}
      renderAuthControls={() => (
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate('/login')}
        >
          Go to Farmer Login →
        </button>
      )}
    />
  );
}

export default WeatherDashboard;
