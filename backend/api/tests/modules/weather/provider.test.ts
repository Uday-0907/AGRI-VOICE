/**
 * Weather Provider Unit Tests
 *
 * Tests the OpenMeteoProvider in isolation by mocking global fetch.
 * No real network calls are made.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenMeteoProvider } from '../../../src/modules/weather/providers/open-meteo.provider.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeOkResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

function makeErrorResponse(status: number): Response {
  return new Response('error', { status });
}

const LOCATION = { latitude: 16.5, longitude: 80.5 };

const currentWeatherApiBody = {
  current: {
    time: '2026-01-01T06:00',
    temperature_2m: 28.5,
    relative_humidity_2m: 72,
    apparent_temperature: 31.0,
    weather_code: 2,
    cloud_cover: 40,
    pressure_msl: 1012.3,
    wind_speed_10m: 15.2,
    wind_direction_10m: 90,
    wind_gusts_10m: 22.0,
    rain: 0.0,
  },
};

const hourlyForecastApiBody = {
  hourly: {
    time: ['2026-01-01T00:00', '2026-01-01T01:00', '2026-01-01T02:00'],
    temperature_2m: [26.0, 25.5, 25.0],
    relative_humidity_2m: [70, 72, 74],
    weather_code: [0, 1, 2],
    rain: [0.0, 0.0, 0.5],
    precipitation_probability: [5, 10, 20],
    precipitation: [0.0, 0.0, 0.5],
    cloud_cover: [10, 15, 25],
    wind_speed_10m: [12.0, 11.0, 13.0],
    wind_direction_10m: [180, 185, 190],
    wind_gusts_10m: [18.0, 17.0, 19.0],
    sunshine_duration: [3600, 0, 0],
    uv_index: [3.0, 0.0, 0.0],
  },
};

const dailyForecastApiBody = {
  daily: {
    time: ['2026-01-01', '2026-01-02'],
    weather_code: [0, 61],
    temperature_2m_max: [33.0, 29.0],
    temperature_2m_min: [22.0, 20.0],
    relative_humidity_2m_mean: [68, 80],
    precipitation_sum: [0.0, 8.5],
    precipitation_probability_max: [5, 75],
    rain_sum: [0.0, 8.5],
    snowfall_sum: [0.0, 0.0],
    wind_speed_10m_max: [18.0, 22.0],
    wind_gusts_10m_max: [25.0, 30.0],
    wind_direction_10m_dominant: [90, 135],
    cloud_cover_mean: [15, 60],
    sunshine_duration: [28800, 10800],
    uv_index_max: [7.0, 4.0],
  },
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('OpenMeteoProvider — getCurrentWeather()', () => {
  let provider: OpenMeteoProvider;

  beforeEach(() => {
    provider = new OpenMeteoProvider();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps a valid API response to CurrentWeatherResponse', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeOkResponse(currentWeatherApiBody)));

    const result = await provider.getCurrentWeather(LOCATION);

    expect(result.provider).toBe('open-meteo');
    expect(result.location).toEqual(LOCATION);
    expect(result.temperature).toBe(28.5);
    expect(result.humidity).toBe(72);
    expect(result.windSpeed).toBe(15.2);
    expect(result.windDirection).toBe('E'); // 90° → East
    expect(result.windGusts).toBe(22.0);
    expect(result.pressure).toBe(1012.3);
    expect(result.cloudCover).toBe(40);
    expect(result.rainfall).toBe(0.0);
    expect(result.weatherCode).toBe(2);
    expect(result.weatherDescription).toBe('Partly cloudy');
    expect(result.temperatureMin).toBeNull();
    expect(result.temperatureMax).toBeNull();
    expect(result.rainfallProbability).toBeNull();
    expect(result.isEstimate).toBe(false);
    expect(result.observedAt).toBeInstanceOf(Date);

    vi.unstubAllGlobals();
  });

  it('returns null for missing optional fields (rain absent)', async () => {
    const body = {
      current: {
        ...currentWeatherApiBody.current,
        rain: undefined,
        cloud_cover: undefined,
        pressure_msl: undefined,
        wind_gusts_10m: undefined,
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeOkResponse(body)));

    const result = await provider.getCurrentWeather(LOCATION);

    // These fields come from API nulls → provider maps them directly (may be undefined/null)
    expect(result.rainfall).toBeUndefined();
    expect(result.cloudCover).toBeUndefined();

    vi.unstubAllGlobals();
  });

  it('throws on HTTP 4xx status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeErrorResponse(404)));

    await expect(provider.getCurrentWeather(LOCATION)).rejects.toThrow('404');

    vi.unstubAllGlobals();
  });

  it('throws on HTTP 5xx status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeErrorResponse(503)));

    await expect(provider.getCurrentWeather(LOCATION)).rejects.toThrow('503');

    vi.unstubAllGlobals();
  });

  it('throws when fetch rejects (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));

    await expect(provider.getCurrentWeather(LOCATION)).rejects.toThrow('Network failure');

    vi.unstubAllGlobals();
  });
});

describe('OpenMeteoProvider — validateLocation()', () => {
  let provider: OpenMeteoProvider;

  beforeEach(() => {
    provider = new OpenMeteoProvider();
    // Stub fetch so the method never actually hits the network
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeOkResponse(currentWeatherApiBody)));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('throws for NaN, Infinity, or non-numeric coordinates', async () => {
    await expect(provider.getCurrentWeather({ latitude: NaN, longitude: 80 })).rejects.toThrow('finite numbers');
    await expect(provider.getCurrentWeather({ latitude: 16, longitude: Infinity })).rejects.toThrow('finite numbers');
    await expect(provider.getCurrentWeather({ latitude: '16' as any, longitude: 80 })).rejects.toThrow('finite numbers');
  });

  it('throws for latitude above 90', async () => {
    await expect(provider.getCurrentWeather({ latitude: 91, longitude: 80 })).rejects.toThrow('Invalid latitude');
  });

  it('throws for latitude below -90', async () => {
    await expect(provider.getCurrentWeather({ latitude: -91, longitude: 80 })).rejects.toThrow('Invalid latitude');
  });

  it('throws for longitude above 180', async () => {
    await expect(provider.getCurrentWeather({ latitude: 16, longitude: 181 })).rejects.toThrow('Invalid longitude');
  });

  it('throws for longitude below -180', async () => {
    await expect(provider.getCurrentWeather({ latitude: 16, longitude: -181 })).rejects.toThrow('Invalid longitude');
  });

  it('accepts boundary values (lat=90, lon=180)', async () => {
    await expect(provider.getCurrentWeather({ latitude: 90, longitude: 180 })).resolves.toBeDefined();
  });

  it('accepts typical Indian coordinates without throwing', async () => {
    await expect(provider.getCurrentWeather({ latitude: 16.5, longitude: 80.5 })).resolves.toBeDefined();
  });
});

describe('OpenMeteoProvider — degreesToCardinal()', () => {
  let provider: OpenMeteoProvider;

  beforeEach(() => {
    provider = new OpenMeteoProvider();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeOkResponse(currentWeatherApiBody)));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const cases: Array<{ degrees: number; body: typeof currentWeatherApiBody; expected: string }> = [
    { degrees: 0,   expected: 'N',   body: { current: { ...currentWeatherApiBody.current, wind_direction_10m: 0 } } },
    { degrees: 45,  expected: 'NE',  body: { current: { ...currentWeatherApiBody.current, wind_direction_10m: 45 } } },
    { degrees: 90,  expected: 'E',   body: { current: { ...currentWeatherApiBody.current, wind_direction_10m: 90 } } },
    { degrees: 135, expected: 'SE',  body: { current: { ...currentWeatherApiBody.current, wind_direction_10m: 135 } } },
    { degrees: 180, expected: 'S',   body: { current: { ...currentWeatherApiBody.current, wind_direction_10m: 180 } } },
    { degrees: 225, expected: 'SW',  body: { current: { ...currentWeatherApiBody.current, wind_direction_10m: 225 } } },
    { degrees: 270, expected: 'W',   body: { current: { ...currentWeatherApiBody.current, wind_direction_10m: 270 } } },
    { degrees: 315, expected: 'NW',  body: { current: { ...currentWeatherApiBody.current, wind_direction_10m: 315 } } },
    { degrees: 360, expected: 'N',   body: { current: { ...currentWeatherApiBody.current, wind_direction_10m: 360 } } },
  ];

  for (const { degrees, expected, body } of cases) {
    it(`maps ${degrees}° → ${expected}`, async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeOkResponse(body)));
      const result = await provider.getCurrentWeather(LOCATION);
      expect(result.windDirection).toBe(expected);
    });
  }
});

describe('OpenMeteoProvider — getHourlyForecast()', () => {
  let provider: OpenMeteoProvider;

  beforeEach(() => {
    provider = new OpenMeteoProvider();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('maps hourly API response — temperature uses temperature field (not min/max)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeOkResponse(hourlyForecastApiBody)));

    const result = await provider.getHourlyForecast(LOCATION, 3);

    expect(result.provider).toBe('open-meteo');
    expect(result.forecasts).toHaveLength(3);
    const f = result.forecasts[0];
    expect(f.temperature).toBe(26.0);
    expect(f.temperatureMin).toBeNull();
    expect(f.temperatureMax).toBeNull();
    expect(f.humidity).toBe(70);
    expect(f.rainfall).toBe(0.0);
    expect(f.rainfallProbability).toBe(5);
    expect(f.sunshineDuration).toBe(3600);
    expect(f.uvIndex).toBe(3.0);
    expect(f.windDirection).toBe('S'); // 180° → S
  });

  it('throws on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeErrorResponse(500)));

    await expect(provider.getHourlyForecast(LOCATION, 24)).rejects.toThrow('500');
  });

  it('rejects requests above 48 hours instead of silently clamping them', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(provider.getHourlyForecast(LOCATION, 72)).rejects.toThrow(
      /maximum of 48 hours/
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts exactly 48 hours and requests all 48 hours from the provider', async () => {
    const baseTime = Date.UTC(2026, 0, 1);
    const hours48Body = {
      hourly: {
        time: Array.from({ length: 48 }, (_, i) =>
          new Date(baseTime + i * 3600_000).toISOString()
        ),
        temperature_2m: Array(48).fill(26),
        relative_humidity_2m: Array(48).fill(70),
        weather_code: Array(48).fill(0),
        rain: Array(48).fill(0),
        precipitation_probability: Array(48).fill(5),
        precipitation: Array(48).fill(0),
        cloud_cover: Array(48).fill(10),
        wind_speed_10m: Array(48).fill(12),
        wind_direction_10m: Array(48).fill(180),
        wind_gusts_10m: Array(48).fill(18),
        sunshine_duration: Array(48).fill(3600),
        uv_index: Array(48).fill(3),
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(makeOkResponse(hours48Body));
    vi.stubGlobal('fetch', fetchMock);

    const result = await provider.getHourlyForecast(LOCATION, 48);

    expect(result.forecasts).toHaveLength(48);
    expect(String(fetchMock.mock.calls[0][0])).toContain('forecast_hours=48');
  });
});

describe('OpenMeteoProvider — getDailyForecast()', () => {
  let provider: OpenMeteoProvider;

  beforeEach(() => {
    provider = new OpenMeteoProvider();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('maps daily API response — uvIndexMax field preserved', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeOkResponse(dailyForecastApiBody)));

    const result = await provider.getDailyForecast(LOCATION, 2);

    expect(result.forecasts).toHaveLength(2);
    const day0 = result.forecasts[0];
    expect(day0.temperatureMin).toBe(22.0);
    expect(day0.temperatureMax).toBe(33.0);
    expect(day0.rainfall).toBe(0.0);
    expect(day0.uvIndexMax).toBe(7.0); // kept as uvIndexMax (not uvIndex)

    const day1 = result.forecasts[1];
    expect(day1.temperatureMin).toBe(20.0);
    expect(day1.temperatureMax).toBe(29.0);
    expect(day1.rainfall).toBe(8.5);
    expect(day1.rainfallProbability).toBe(75);
    expect(day1.uvIndexMax).toBe(4.0);
  });

  it('throws on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));

    await expect(provider.getDailyForecast(LOCATION, 7)).rejects.toThrow('timeout');
  });
});

describe('mapAlertType() — code mapping correctness', () => {
  it('correctly maps snow codes 71-86 to snow alert', async () => {
    const { mapAlertType } = await import('../../../src/modules/weather/providers/weather-provider.interface.js');
    expect(mapAlertType(71, 'medium')).toEqual({ type: 'snow', headline: 'Snow conditions' });
    expect(mapAlertType(75, 'high')).toEqual({ type: 'snow', headline: 'Snow conditions' });
    expect(mapAlertType(85, 'medium')).toEqual({ type: 'snow', headline: 'Snow conditions' });
  });

  it('correctly maps heavy rain codes 65-67 to heavy_rain alert', async () => {
    const { mapAlertType } = await import('../../../src/modules/weather/providers/weather-provider.interface.js');
    expect(mapAlertType(65, 'high')).toEqual({ type: 'heavy_rain', headline: 'Heavy rainfall warning' });
  });

  it('correctly maps rain codes 61-64 and 80-82 to rain alert', async () => {
    const { mapAlertType } = await import('../../../src/modules/weather/providers/weather-provider.interface.js');
    expect(mapAlertType(61, 'low')).toEqual({ type: 'rain', headline: 'Rain expected' });
    expect(mapAlertType(80, 'medium')).toEqual({ type: 'rain', headline: 'Rain expected' });
  });

  it('correctly maps thunderstorm codes >=95 to thunderstorm alert', async () => {
    const { mapAlertType } = await import('../../../src/modules/weather/providers/weather-provider.interface.js');
    expect(mapAlertType(95, 'severe')).toEqual({ type: 'thunderstorm', headline: 'Thunderstorm warning' });
    expect(mapAlertType(99, 'severe')).toEqual({ type: 'thunderstorm', headline: 'Thunderstorm warning' });
  });
});

describe('OpenMeteoProvider — getAlerts()', () => {
  it('returns empty alerts array (Open-Meteo does not provide alerts)', async () => {
    const provider = new OpenMeteoProvider();
    const result = await provider.getAlerts(LOCATION);
    expect(result.provider).toBe('open-meteo');
    expect(result.alerts).toHaveLength(0);
  });
});
