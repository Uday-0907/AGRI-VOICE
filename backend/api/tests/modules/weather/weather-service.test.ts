/**
 * Weather Service Unit Tests
 *
 * Tests WeatherService and parseLocationCoordinates in isolation.
 * All DB and provider interactions are mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WeatherService, parseLocationCoordinates } from '../../../src/modules/weather/services/weather.service.js';

// ─── Query builder mock helper ───────────────────────────────────────────────

function createDrizzleSelectMock(resolvedValue: any[] = []) {
  const chain: any = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn().mockResolvedValue(resolvedValue),
    then: (resolve: any, reject: any) => Promise.resolve(resolvedValue).then(resolve, reject),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  return chain;
}

// ─── parseLocationCoordinates ────────────────────────────────────────────────

describe('parseLocationCoordinates()', () => {
  it('parses WKT POINT string "POINT(80.5 16.5)"', () => {
    const result = parseLocationCoordinates('POINT(80.5 16.5)');
    expect(result).toEqual({ longitude: 80.5, latitude: 16.5 });
  });

  it('parses WKT with extra whitespace "POINT( 80.5  16.5 )"', () => {
    const result = parseLocationCoordinates('POINT( 80.5  16.5 )');
    expect(result).toEqual({ longitude: 80.5, latitude: 16.5 });
  });

  it('parses WKT case-insensitive "point(80.5 16.5)"', () => {
    const result = parseLocationCoordinates('point(80.5 16.5)');
    expect(result).toEqual({ longitude: 80.5, latitude: 16.5 });
  });

  it('parses PostGIS x/y object { x: 80.5, y: 16.5 }', () => {
    const result = parseLocationCoordinates({ x: 80.5, y: 16.5 });
    expect(result).toEqual({ longitude: 80.5, latitude: 16.5 });
  });

  it('returns null for null input', () => {
    expect(parseLocationCoordinates(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(parseLocationCoordinates(undefined)).toBeNull();
  });

  it('returns null for malformed WKT string "POINT(abc def)"', () => {
    expect(parseLocationCoordinates('POINT(abc def)')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseLocationCoordinates('')).toBeNull();
  });

  it('returns null for plain string without POINT syntax', () => {
    expect(parseLocationCoordinates('16.5,80.5')).toBeNull();
  });

  it('parses negative coordinates correctly', () => {
    const result = parseLocationCoordinates('POINT(-73.9857 40.7484)');
    expect(result).toEqual({ longitude: -73.9857, latitude: 40.7484 });
  });

  it('x/y object with NaN values returns null', () => {
    expect(parseLocationCoordinates({ x: NaN, y: 16.5 })).toBeNull();
  });

  it('parses coordinates at extreme valid boundary POINT(180.0 90.0)', () => {
    const result = parseLocationCoordinates('POINT(180.0 90.0)');
    expect(result).toEqual({ longitude: 180.0, latitude: 90.0 });
  });
});

// ─── parseLocationCoordinates — additional validation tests ──────────────────

describe('parseLocationCoordinates() — extended validation', () => {
  it('rejects partially numeric WKT string "POINT(80.5abc 16.5)"', () => {
    expect(parseLocationCoordinates('POINT(80.5abc 16.5)')).toBeNull();
  });

  it('rejects WKT with Infinity "POINT(Infinity 16.5)"', () => {
    expect(parseLocationCoordinates('POINT(Infinity 16.5)')).toBeNull();
  });

  it('rejects WKT with NaN "POINT(NaN 16.5)"', () => {
    expect(parseLocationCoordinates('POINT(NaN 16.5)')).toBeNull();
  });

  it('rejects out-of-range latitude POINT(80.0 91.0)', () => {
    expect(parseLocationCoordinates('POINT(80.0 91.0)')).toBeNull();
  });

  it('rejects out-of-range longitude POINT(181.0 16.5)', () => {
    expect(parseLocationCoordinates('POINT(181.0 16.5)')).toBeNull();
  });

  it('accepts boundary latitude POINT(80.0 -90.0)', () => {
    expect(parseLocationCoordinates('POINT(80.0 -90.0)')).toEqual({ longitude: 80.0, latitude: -90.0 });
  });

  it('accepts boundary longitude POINT(-180.0 16.5)', () => {
    expect(parseLocationCoordinates('POINT(-180.0 16.5)')).toEqual({ longitude: -180.0, latitude: 16.5 });
  });

  it('x/y object with Infinity values returns null', () => {
    expect(parseLocationCoordinates({ x: Infinity, y: 16.5 })).toBeNull();
  });

  it('x/y object with out-of-range latitude returns null', () => {
    expect(parseLocationCoordinates({ x: 80.0, y: 91.0 })).toBeNull();
  });

  it('x/y object with out-of-range longitude returns null', () => {
    expect(parseLocationCoordinates({ x: 181.0, y: 16.5 })).toBeNull();
  });
});

// ─── WeatherService — getForecast() hourly cap enforcement ───────────────────

describe('WeatherService — getForecast() — hourly 48h cap enforcement', () => {
  let service: WeatherService;
  const farmId = 'f0000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    service = new WeatherService('open-meteo');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when hourly forecast requested for more than 2 days (> 48 h)', async () => {
    vi.spyOn(service as any, 'resolveLocation').mockResolvedValue({
      farmId,
      latitude: 16.5,
      longitude: 80.5,
    });

    // 3 days hourly = 72 h, but provider caps at 48 h — must reject
    await expect(
      service.getForecast(farmId, undefined, 3, 'hourly')
    ).rejects.toThrow(/Hourly forecast supports a maximum of 2 days/);
  });

  it('allows hourly forecast for exactly 2 days (48 h)', async () => {
    const { db } = await import('../../../src/database/db.js');

    vi.spyOn(service as any, 'resolveLocation').mockResolvedValue({
      farmId,
      latitude: 16.5,
      longitude: 80.5,
    });

    vi.spyOn(db, 'select').mockImplementation(() => createDrizzleSelectMock([]) as any);

    const hours48 = Array.from({ length: 48 }, (_, i) => ({
      validAt: new Date(Date.now() + i * 3600_000),
      temperature: 28, temperatureMin: null, temperatureMax: null,
      humidity: 70, rainfall: 0, rainfallProbability: 10, precipitationSum: 0,
      windSpeed: 12, windDirection: 'NE', windGusts: 18, cloudCover: 15,
      weatherCode: 1, weatherDescription: 'Mainly clear',
      sunshineDuration: 3600, uvIndex: 4,
    }));

    vi.spyOn((service as any).provider, 'getHourlyForecast').mockResolvedValue({
      provider: 'open-meteo',
      location: { latitude: 16.5, longitude: 80.5 },
      issueAt: new Date(),
      forecasts: hours48,
    });

    vi.spyOn(db, 'insert').mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    } as any);

    const result = await service.getForecast(farmId, undefined, 2, 'hourly');
    expect(result).toHaveLength(48);
  });

  it('allows daily forecast for 14 days without restriction', async () => {
    const { db } = await import('../../../src/database/db.js');

    vi.spyOn(service as any, 'resolveLocation').mockResolvedValue({
      farmId, latitude: 16.5, longitude: 80.5,
    });

    vi.spyOn(db, 'select').mockImplementation(() => createDrizzleSelectMock([]) as any);

    const days14 = Array.from({ length: 14 }, (_, i) => ({
      validAt: new Date(Date.now() + i * 86400_000),
      temperatureMin: 18, temperatureMax: 32, humidity: 65,
      rainfall: 0, rainfallProbability: 5, precipitationSum: 0,
      windSpeed: 15, windDirection: 'E', windGusts: 20, cloudCover: 10,
      weatherCode: 0, weatherDescription: 'Clear sky',
      sunshineDuration: 28800, uvIndexMax: 8,
    }));

    vi.spyOn((service as any).provider, 'getDailyForecast').mockResolvedValue({
      provider: 'open-meteo',
      location: { latitude: 16.5, longitude: 80.5 },
      issueAt: new Date(),
      forecasts: days14,
    });

    vi.spyOn(db, 'insert').mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    } as any);

    const result = await service.getForecast(farmId, undefined, 14, 'daily');
    expect(result).toHaveLength(14);
  });
});

// ─── WeatherService — getCurrentWeather() ───────────────────────────────────

describe('WeatherService — getCurrentWeather() cache logic', () => {
  let service: WeatherService;

  const farmId = 'f0000000-0000-0000-0000-000000000001';

  const mockObs = {
    id: 'obs-001',
    locationId: farmId,
    locationType: 'farm',
    providerId: 'prov-1',
    observedAt: new Date(),
    fetchedAt: new Date(),
    temperature: '28.5',
    temperatureMin: null,
    temperatureMax: null,
    humidity: '72',
    windSpeed: '15.2',
    windDirection: 'E',
    windGusts: '22.0',
    pressure: '1012.3',
    cloudCover: '40',
    rainfall: '0.0',
    rainfallProbability: null,
    weatherCode: 2,
    weatherDescription: 'Partly cloudy',
    dataStatus: 'LIVE',
    sourceLatitude: '16.5',
    sourceLongitude: '80.5',
  };

  beforeEach(() => {
    service = new WeatherService('open-meteo');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns CACHED status when fresh observation found (< 15 min old)', async () => {
    const { db } = await import('../../../src/database/db.js');

    vi.spyOn(service as any, 'resolveLocation').mockResolvedValue({
      farmId,
      latitude: 16.5,
      longitude: 80.5,
    });

    vi.spyOn(db, 'select').mockImplementation(() => createDrizzleSelectMock([mockObs]) as any);

    const result = await service.getCurrentWeather(farmId);

    expect(result.id).toBe('obs-001');
    expect(result.locationId).toBe(farmId);
    expect(result.locationType).toBe('farm');
    // A recent DB-cached observation must be CACHED, not LIVE
    expect(result.dataStatus).toBe('CACHED');
  });

  it('returns STALE status and triggers background refresh for an observation older than 15 minutes', async () => {
    const { db } = await import('../../../src/database/db.js');

    vi.spyOn(service as any, 'resolveLocation').mockResolvedValue({
      farmId,
      latitude: 16.5,
      longitude: 80.5,
    });

    const staleObs = {
      ...mockObs,
      id: 'obs-stale',
      fetchedAt: new Date(Date.now() - 60 * 60 * 1000),
    };

    // First lookup (fresh, <15 min) misses; second lookup (stale, <24 h) hits.
    vi.spyOn(db, 'select')
      .mockImplementationOnce(() => createDrizzleSelectMock([]) as any)
      .mockImplementationOnce(() => createDrizzleSelectMock([staleObs]) as any);

    const refreshSpy = vi
      .spyOn(service as any, 'fetchAndStoreCurrentWeather')
      .mockResolvedValue(undefined);

    const result = await service.getCurrentWeather(farmId);

    expect(result.id).toBe('obs-stale');
    expect(result.dataStatus).toBe('STALE');
    expect(refreshSpy).toHaveBeenCalledWith(
      { farmId, latitude: 16.5, longitude: 80.5 },
      farmId,
      'farm'
    );
  });

  it('calls provider.getCurrentWeather() when no cached data exists', async () => {
    const { db } = await import('../../../src/database/db.js');

    vi.spyOn(service as any, 'resolveLocation').mockResolvedValue({
      farmId,
      latitude: 16.5,
      longitude: 80.5,
    });

    // DB returns empty (no cached data, then provider returns mock)
    vi.spyOn(db, 'select').mockImplementation(() => createDrizzleSelectMock([]) as any);

    const mockWeatherData = {
      provider: 'open-meteo',
      location: { latitude: 16.5, longitude: 80.5 },
      observedAt: new Date(),
      temperature: 29.0,
      temperatureMin: null,
      temperatureMax: null,
      humidity: 65,
      windSpeed: 10.0,
      windDirection: 'NE',
      windGusts: 15.0,
      pressure: 1010.0,
      cloudCover: 20,
      rainfall: 0,
      rainfallProbability: null,
      weatherCode: 1,
      weatherDescription: 'Mainly clear',
      isEstimate: false,
    };

    vi.spyOn((service as any).provider, 'getCurrentWeather').mockResolvedValue(mockWeatherData);

    const storedObs = { ...mockObs, id: 'obs-new', temperature: '29.0' };
    vi.spyOn(db, 'insert').mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([storedObs]),
      }),
    } as any);

    const result = await service.getCurrentWeather(farmId);

    expect((service as any).provider.getCurrentWeather).toHaveBeenCalledWith({
      latitude: 16.5,
      longitude: 80.5,
    });
    expect(result.dataStatus).toBe('LIVE');
  });

  it('throws when provider fails and no cached data', async () => {
    const { db } = await import('../../../src/database/db.js');

    vi.spyOn(service as any, 'resolveLocation').mockResolvedValue({
      farmId,
      latitude: 16.5,
      longitude: 80.5,
    });

    vi.spyOn(db, 'select').mockImplementation(() => createDrizzleSelectMock([]) as any);

    vi.spyOn((service as any).provider, 'getCurrentWeather').mockRejectedValue(
      new Error('API unavailable')
    );

    await expect(service.getCurrentWeather(farmId)).rejects.toThrow('Weather unavailable');
  });
});

// ─── WeatherService — pollAlerts() ───────────────────────────────────────────

describe('WeatherService — pollAlerts()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is an explicit no-op and does not attempt provider alert discovery', async () => {
    const service = new WeatherService('open-meteo');
    const getAlertsSpy = vi.spyOn((service as any).provider, 'getAlerts');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await service.pollAlerts();

    expect(getAlertsSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('alert discovery stub'));
  });
});

// ─── WeatherService — getForecast() mapping ──────────────────────────────────

describe('WeatherService — getForecast() — hourly mapping', () => {
  let service: WeatherService;
  const farmId = 'f0000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    service = new WeatherService('open-meteo');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hourly: uses temperature ?? null for temperatureMin/Max, preserves uvIndex', async () => {
    const { db } = await import('../../../src/database/db.js');

    vi.spyOn(service as any, 'resolveLocation').mockResolvedValue({
      farmId,
      latitude: 16.5,
      longitude: 80.5,
    });

    vi.spyOn(db, 'select').mockImplementation(() => createDrizzleSelectMock([]) as any);

    const now = new Date();
    const mockHourlyResp = {
      provider: 'open-meteo',
      location: { latitude: 16.5, longitude: 80.5 },
      issueAt: now,
      forecasts: [
        {
          validAt: new Date(now.getTime() + 3600_000),
          temperature: 27.0,
          temperatureMin: null,
          temperatureMax: null,
          humidity: 70,
          rainfall: 0.0,
          rainfallProbability: 10,
          precipitationSum: 0.0,
          windSpeed: 12.0,
          windDirection: 'NE',
          windGusts: 18.0,
          cloudCover: 15,
          weatherCode: 1,
          weatherDescription: 'Mainly clear',
          sunshineDuration: 3600,
          uvIndex: 4.5,
        },
      ],
    };

    vi.spyOn((service as any).provider, 'getHourlyForecast').mockResolvedValue(mockHourlyResp);

    vi.spyOn(db, 'insert').mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    } as any);

    const result = await service.getForecast(farmId, undefined, 1, 'hourly');

    expect(result).toHaveLength(1);
    const f = result[0];
    expect(f.temperatureMin).toBe(27.0);
    expect(f.temperatureMax).toBe(27.0);
    expect(f.uvIndex).toBe(4.5);
    expect(f.dataStatus).toBe('LIVE');
  });

  it('daily: uses uvIndexMax (not uvIndex) for the uvIndex field', async () => {
    const { db } = await import('../../../src/database/db.js');

    vi.spyOn(service as any, 'resolveLocation').mockResolvedValue({
      farmId,
      latitude: 16.5,
      longitude: 80.5,
    });

    vi.spyOn(db, 'select').mockImplementation(() => createDrizzleSelectMock([]) as any);

    const now = new Date();
    const mockDailyResp = {
      provider: 'open-meteo',
      location: { latitude: 16.5, longitude: 80.5 },
      issueAt: now,
      forecasts: [
        {
          validAt: new Date(now.getTime() + 86400_000),
          temperatureMin: 20.0,
          temperatureMax: 33.0,
          humidity: 68,
          rainfall: 0.0,
          rainfallProbability: 5,
          precipitationSum: 0.0,
          windSpeed: 18.0,
          windDirection: 'E',
          windGusts: 25.0,
          cloudCover: 15,
          weatherCode: 0,
          weatherDescription: 'Clear sky',
          sunshineDuration: 28800,
          uvIndexMax: 8.5,
        },
      ],
    };

    vi.spyOn((service as any).provider, 'getDailyForecast').mockResolvedValue(mockDailyResp);

    vi.spyOn(db, 'insert').mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    } as any);

    const result = await service.getForecast(farmId, undefined, 1, 'daily');

    expect(result).toHaveLength(1);
    expect(result[0].uvIndex).toBe(8.5);
    expect(result[0].temperatureMin).toBe(20.0);
    expect(result[0].temperatureMax).toBe(33.0);
  });
});

// ─── WeatherService — resolveLocation() ─────────────────────────────────────

describe('WeatherService — resolveLocation()', () => {
  let service: WeatherService;

  beforeEach(() => {
    service = new WeatherService('open-meteo');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when farm has no location', async () => {
    const { db } = await import('../../../src/database/db.js');
    vi.spyOn(db, 'select').mockImplementation(() => createDrizzleSelectMock([{ location: null }]) as any);

    await expect(service.resolveLocation('f0000000-0000-0000-0000-000000000001')).rejects.toThrow('no location');
  });

  it('throws when farm not found', async () => {
    const { db } = await import('../../../src/database/db.js');
    vi.spyOn(db, 'select').mockImplementation(() => createDrizzleSelectMock([]) as any);

    await expect(service.resolveLocation('f0000000-0000-0000-0000-000000000002')).rejects.toThrow('no location');
  });
});
