/**
 * Advisory Service Unit Tests
 *
 * Tests normalizeSeverity(), rule evaluation logic, createAdvisory deduplication,
 * and getAdvisories behavior. All DB interactions are mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdvisoryService } from '../../../src/modules/weather/services/advisory.service.js';
import type { WeatherContext } from '../../../src/modules/weather/services/advisory.service.js';

// ─── normalizeSeverity ───────────────────────────────────────────────────────
// normalizeSeverity is module-private; we test it via public API behavior
// by routing through the getAdvisories result mapping.

// We expose it via a minimal workaround: re-export via the mapped result.
// Since normalizeSeverity is not exported, we test indirectly via generateAdvisories/getAdvisories mocks.

// However, we CAN test it via import of the service's internal module by calling generateAdvisories
// and checking the returned severity. We do this by giving a known mock rule.

describe('AdvisoryService — normalizeSeverity (via rule evaluation output)', () => {
  let service: AdvisoryService;

  beforeEach(() => {
    service = new AdvisoryService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function getSeverityForRuleSeverity(ruleSeverity: string | null) {
    const { db } = await import('../../../src/database/db.js');

    // getActiveCropSeasons mock
    vi.spyOn(service, 'getActiveCropSeasons').mockResolvedValue([{
      farmerId: 'farmer-1',
      farmId: 'farm-1',
      fieldId: 'field-1',
      cropSeasonId: 'season-1',
      cropId: 'crop-1',
      cropName: 'Paddy',
      season: 'kharif',
      sowingDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      growthStage: 'vegetative',
    }]);

    // getWeatherContext mock
    vi.spyOn(service, 'getWeatherContext').mockResolvedValue({
      temperature: 35, // above threshold to trigger rule
      humidity: 70,
      rainfall: 0,
      rainfallProbability: 10,
      forecastRainfall: 0,
    });

    // DB: select advisory rules — returns one rule
    const mockRule = {
      id: 'rule-1',
      status: 'active',
      cropId: null,
      conditionType: 'temperature_above',
      threshold: '30', // triggers because temperature=35 > 30
      logicalOperator: 'gt',
      condition2Type: null,
      condition2Threshold: null,
      condition2Operator: null,
      logicalCombinator: null,
      category: 'general',
      severity: ruleSeverity,
      advisoryText: 'High temperature alert',
      sourceName: 'Test source',
      evidenceStrength: 'verified',
      requiresHumanConfirmation: false,
      effectiveFrom: new Date(0),
      effectiveTo: null,
      priority: 1,
    };

    vi.spyOn(db, 'select').mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([mockRule]),
        }),
      }),
    } as any);

    // createAdvisory mock (no existing advisory, insert returns a new one)
    vi.spyOn(db, 'select').mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);

    vi.spyOn(db, 'insert').mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: 'adv-1',
          ruleId: 'rule-1',
          fieldId: 'field-1',
          farmId: 'farm-1',
          farmerId: 'farmer-1',
          cropSeasonId: 'season-1',
          validFrom: new Date(),
          validTo: new Date(Date.now() + 86400_000),
          advisoryText: 'High temperature alert',
          severity: ruleSeverity,
          verificationStatus: 'generated',
          generatedAt: new Date(),
          status: 'active',
        }]),
      }),
    } as any);

    const advisories = await service.generateAdvisories('farm-1');
    return advisories[0]?.severity;
  }

  it('normalizeSeverity("warning") → "warning"', async () => {
    const result = await getSeverityForRuleSeverity('warning');
    expect(result).toBe('warning');
  });

  it('normalizeSeverity("urgent") → "urgent"', async () => {
    const result = await getSeverityForRuleSeverity('urgent');
    expect(result).toBe('urgent');
  });

  it('normalizeSeverity(null) → "info"', async () => {
    const result = await getSeverityForRuleSeverity(null);
    expect(result).toBe('info');
  });

  it('normalizeSeverity("critical") → "info" (conservative fallback)', async () => {
    const result = await getSeverityForRuleSeverity('critical');
    expect(result).toBe('info');
  });

  it('normalizeSeverity("unknown") → "info"', async () => {
    const result = await getSeverityForRuleSeverity('unknown');
    expect(result).toBe('info');
  });
});

// ─── Rule evaluation (compareValues / evaluateRule) ──────────────────────────

describe('AdvisoryService — rule evaluation', () => {
  let service: AdvisoryService;

  beforeEach(() => {
    service = new AdvisoryService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeRule(overrides: Record<string, unknown>) {
    return {
      id: 'rule-1',
      status: 'active',
      cropId: null,
      conditionType: 'temperature_above',
      threshold: '30',
      logicalOperator: 'gt',
      condition2Type: null,
      condition2Threshold: null,
      condition2Operator: null,
      logicalCombinator: null,
      category: 'general',
      severity: 'warning',
      advisoryText: 'High temperature',
      sourceName: 'Test',
      evidenceStrength: 'verified',
      requiresHumanConfirmation: false,
      effectiveFrom: new Date(0),
      effectiveTo: null,
      priority: 1,
      ...overrides,
    };
  }

  function makeWeather(overrides: Partial<WeatherContext> = {}): WeatherContext {
    return {
      temperature: 32,
      humidity: 70,
      rainfall: 5,
      rainfallProbability: 60,
      forecastRainfall: 10,
      ...overrides,
    };
  }

  it('rejects invalid/non-numeric threshold (NaN, Infinity) safely without crashing', () => {
    const rule = makeRule({ conditionType: 'temperature_above', threshold: 'invalid-num', logicalOperator: 'gt' });
    const weather = makeWeather({ temperature: 35 });
    expect((service as any).evaluateRule(rule, weather)).toBe(false);
  });

  it('rejects invalid/unsupported logical combinator defensively', () => {
    const rule = makeRule({
      conditionType: 'temperature_above',
      threshold: '30',
      logicalOperator: 'gt',
      condition2Type: 'humidity_above',
      condition2Threshold: '60',
      condition2Operator: 'gte',
      logicalCombinator: 'XOR', // unsupported combinator
    });
    const weather = makeWeather({ temperature: 35, humidity: 65 });
    expect((service as any).evaluateRule(rule, weather)).toBe(false);
  });

  it('gt: triggers when value > threshold', () => {
    const rule = makeRule({ conditionType: 'temperature_above', threshold: '30', logicalOperator: 'gt' });
    const weather = makeWeather({ temperature: 31 });
    expect((service as any).evaluateRule(rule, weather)).toBe(true);
  });

  it('gt: does NOT trigger when value == threshold', () => {
    const rule = makeRule({ conditionType: 'temperature_above', threshold: '30', logicalOperator: 'gt' });
    const weather = makeWeather({ temperature: 30 });
    expect((service as any).evaluateRule(rule, weather)).toBe(false);
  });

  it('gte: triggers when value >= threshold', () => {
    const rule = makeRule({ conditionType: 'temperature_above', threshold: '30', logicalOperator: 'gte' });
    const weather = makeWeather({ temperature: 30 });
    expect((service as any).evaluateRule(rule, weather)).toBe(true);
  });

  it('lt: triggers when value < threshold', () => {
    const rule = makeRule({ conditionType: 'temperature_below', threshold: '15', logicalOperator: 'lt' });
    const weather = makeWeather({ temperature: 14 });
    expect((service as any).evaluateRule(rule, weather)).toBe(true);
  });

  it('lte: triggers when value <= threshold', () => {
    const rule = makeRule({ conditionType: 'temperature_below', threshold: '15', logicalOperator: 'lte' });
    const weather = makeWeather({ temperature: 15 });
    expect((service as any).evaluateRule(rule, weather)).toBe(true);
  });

  it('eq: triggers when value === threshold', () => {
    const rule = makeRule({ conditionType: 'rainfall_above', threshold: '0', logicalOperator: 'eq' });
    const weather = makeWeather({ forecastRainfall: 0, rainfall: 0 });
    expect((service as any).evaluateRule(rule, weather)).toBe(true);
  });

  it('returns false when weather value is null (missing data)', () => {
    const rule = makeRule({ conditionType: 'temperature_above', threshold: '30', logicalOperator: 'gt' });
    const weather = makeWeather({ temperature: null });
    expect((service as any).evaluateRule(rule, weather)).toBe(false);
  });

  it('AND combinator: both conditions must be true', () => {
    const rule = makeRule({
      conditionType: 'temperature_above',
      threshold: '30',
      logicalOperator: 'gt',
      condition2Type: 'humidity_above',
      condition2Threshold: '60',
      condition2Operator: 'gte',
      logicalCombinator: 'AND',
    });
    const weather = makeWeather({ temperature: 35, humidity: 65 });
    expect((service as any).evaluateRule(rule, weather)).toBe(true);
  });

  it('AND combinator: false when only first condition is true', () => {
    const rule = makeRule({
      conditionType: 'temperature_above',
      threshold: '30',
      logicalOperator: 'gt',
      condition2Type: 'humidity_above',
      condition2Threshold: '80',
      condition2Operator: 'gte',
      logicalCombinator: 'AND',
    });
    const weather = makeWeather({ temperature: 35, humidity: 70 }); // humidity 70 < 80
    expect((service as any).evaluateRule(rule, weather)).toBe(false);
  });

  it('OR combinator: true when only one condition is true', () => {
    const rule = makeRule({
      conditionType: 'temperature_above',
      threshold: '40',    // NOT triggered (temp=35 < 40)
      logicalOperator: 'gt',
      condition2Type: 'humidity_above',
      condition2Threshold: '60',
      condition2Operator: 'gte',
      logicalCombinator: 'OR',
    });
    const weather = makeWeather({ temperature: 35, humidity: 65 });
    expect((service as any).evaluateRule(rule, weather)).toBe(true);
  });

  it('AND combinator: false when secondary weather value is null', () => {
    const rule = makeRule({
      conditionType: 'temperature_above',
      threshold: '30',
      logicalOperator: 'gt',
      condition2Type: 'humidity_above',
      condition2Threshold: '60',
      condition2Operator: 'gte',
      logicalCombinator: 'AND',
    });
    const weather = makeWeather({ temperature: 35, humidity: null });
    expect((service as any).evaluateRule(rule, weather)).toBe(false);
  });
});

// ─── Advisory insert — numeric stored as string ───────────────────────────────

describe('AdvisoryService — createAdvisory() numeric encoding', () => {
  let service: AdvisoryService;

  beforeEach(() => {
    service = new AdvisoryService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stores temperature as String(value) in DB', async () => {
    const { db } = await import('../../../src/database/db.js');

    // No existing advisory
    vi.spyOn(db, 'select').mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);

    let capturedValues: Record<string, unknown> | null = null;
    vi.spyOn(db, 'insert').mockReturnValue({
      values: vi.fn().mockImplementation((vals) => {
        capturedValues = vals;
        return {
          returning: vi.fn().mockResolvedValue([{
            id: 'adv-1',
            ruleId: 'rule-1',
            fieldId: 'field-1',
            farmId: 'farm-1',
            farmerId: 'farmer-1',
            cropSeasonId: 'season-1',
            validFrom: new Date(),
            validTo: new Date(),
            advisoryText: 'Test',
            severity: 'warning',
            verificationStatus: 'generated',
            generatedAt: new Date(),
          }]),
        };
      }),
    } as any);

    const rule = {
      id: 'rule-1',
      category: 'irrigation',
      severity: 'warning',
      advisoryText: 'Irrigate the field',
      sourceName: 'ICAR Guidelines',
      evidenceStrength: 'verified',
      requiresHumanConfirmation: false,
    };

    const context = {
      farmerId: 'farmer-1',
      farmId: 'farm-1',
      fieldId: 'field-1',
      cropSeasonId: 'season-1',
      cropId: 'crop-1',
      cropName: 'Paddy',
      season: 'kharif',
      sowingDate: null,
      growthStage: 'vegetative',
    };

    const weather: WeatherContext = {
      temperature: 35.5,
      humidity: 72.3,
      rainfall: 2.1,
      rainfallProbability: 55.0,
      forecastRainfall: 8.0,
    };

    await (service as any).createAdvisory(rule, context, weather);

    expect(capturedValues).not.toBeNull();
    expect(capturedValues!['temperatureAtGeneration']).toBe('35.5');
    expect(capturedValues!['humidityAtGeneration']).toBe('72.3');
    expect(capturedValues!['rainfallAtGeneration']).toBe('2.1');
    expect(capturedValues!['rainfallProbabilityAtGeneration']).toBe('55');
    expect(capturedValues!['forecastRainfall']).toBe('8');
  });

  it('deduplication: returns null when advisory already exists for same rule/field/day', async () => {
    const { db } = await import('../../../src/database/db.js');

    // Existing advisory found
    vi.spyOn(db, 'select').mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'existing-adv' }]),
        }),
      }),
    } as any);

    const rule = { id: 'rule-1', advisoryText: 'Test', severity: 'warning' };
    const context = {
      farmerId: 'farmer-1', farmId: 'farm-1', fieldId: 'field-1',
      cropSeasonId: 'season-1', cropId: 'crop-1', cropName: 'Paddy',
      season: 'kharif', sowingDate: null, growthStage: 'vegetative',
    };
    const weather: WeatherContext = {
      temperature: 35, humidity: 70, rainfall: 0, rainfallProbability: 10, forecastRainfall: 0,
    };

    const result = await (service as any).createAdvisory(rule, context, weather);
    expect(result).toBeNull();
  });
});

// ─── getAdvisories ────────────────────────────────────────────────────────────

describe('AdvisoryService — getAdvisories()', () => {
  let service: AdvisoryService;

  beforeEach(() => {
    service = new AdvisoryService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns mapped advisories with reconstructed weatherContext', async () => {
    const { db } = await import('../../../src/database/db.js');

    const mockRow = {
      id: 'adv-1',
      ruleId: 'rule-1',
      fieldId: 'field-1',
      farmId: 'farm-1',
      farmerId: 'farmer-1',
      cropSeasonId: 'season-1',
      category: 'irrigation',
      severity: 'warning',
      advisoryText: 'Irrigate the field',
      validFrom: new Date(),
      validTo: new Date(Date.now() + 86400_000),
      temperatureAtGeneration: '35.5',
      humidityAtGeneration: '72.3',
      rainfallAtGeneration: '2.1',
      rainfallProbabilityAtGeneration: '55',
      forecastRainfall: '8',
      verificationStatus: 'generated',
      generatedAt: new Date(),
      sourceName: 'ICAR',
      evidenceStrength: 'verified',
    };

    vi.spyOn(db, 'select').mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([mockRow]),
        }),
      }),
    } as any);

    const results = await service.getAdvisories('farm-1');

    expect(results).toHaveLength(1);
    const a = results[0];
    expect(a.id).toBe('adv-1');
    expect(a.severity).toBe('warning');
    expect(a.category).toBe('irrigation');
    expect(a.weatherContext.temperature).toBe(35.5);
    expect(a.weatherContext.humidity).toBe(72.3);
    expect(a.weatherContext.rainfall).toBe(2.1);
    expect(a.weatherContext.rainfallProbability).toBe(55);
    expect(a.weatherContext.forecastRainfall).toBe(8);
    expect(a.evidenceSource).toBe('ICAR');
    expect(a.evidenceStrength).toBe('verified');
    expect(a.verificationStatus).toBe('generated');
  });

  it('supports multiple active crop seasons across fields without suppression', async () => {
    vi.spyOn(service, 'getActiveCropSeasons').mockResolvedValue([
      {
        farmerId: 'farmer-1',
        farmId: 'farm-1',
        fieldId: 'field-1',
        cropSeasonId: 'season-1',
        cropId: 'crop-1',
        cropName: 'Paddy',
        season: 'kharif',
        sowingDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        growthStage: 'vegetative',
      },
      {
        farmerId: 'farmer-1',
        farmId: 'farm-1',
        fieldId: 'field-2',
        cropSeasonId: 'season-2',
        cropId: 'crop-2',
        cropName: 'Cotton',
        season: 'kharif',
        sowingDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        growthStage: 'flowering',
      },
    ]);

    vi.spyOn(service, 'getWeatherContext').mockResolvedValue({
      temperature: 36,
      humidity: 70,
      rainfall: 0,
      rainfallProbability: 10,
      forecastRainfall: 0,
    });

    const { db } = await import('../../../src/database/db.js');

    const rulePaddy = {
      id: 'rule-paddy',
      status: 'active',
      cropId: 'crop-1',
      season: 'kharif',
      growthStage: 'vegetative',
      conditionType: 'temperature_above',
      threshold: '30',
      logicalOperator: 'gt',
      category: 'irrigation',
      severity: 'warning',
      advisoryText: 'Paddy irrigation alert',
      sourceName: 'ICAR',
      evidenceStrength: 'verified',
      requiresHumanConfirmation: false,
      effectiveFrom: new Date(0),
      effectiveTo: null,
      priority: 1,
    };

    const ruleCotton = {
      id: 'rule-cotton',
      status: 'active',
      cropId: 'crop-2',
      season: 'kharif',
      growthStage: 'flowering',
      conditionType: 'temperature_above',
      threshold: '30',
      logicalOperator: 'gt',
      category: 'crop_protection',
      severity: 'urgent',
      advisoryText: 'Cotton pest alert',
      sourceName: 'ICAR',
      evidenceStrength: 'verified',
      requiresHumanConfirmation: false,
      effectiveFrom: new Date(0),
      effectiveTo: null,
      priority: 1,
    };

    vi.spyOn(db, 'select').mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn()
            .mockResolvedValueOnce([rulePaddy])
            .mockResolvedValueOnce([ruleCotton]),
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);

    vi.spyOn(db, 'insert').mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn()
          .mockResolvedValueOnce([{ id: 'adv-1', ruleId: 'rule-paddy', fieldId: 'field-1', farmId: 'farm-1', farmerId: 'farmer-1', cropSeasonId: 'season-1', validFrom: new Date(), validTo: new Date(), advisoryText: 'Paddy alert', severity: 'warning', verificationStatus: 'generated', generatedAt: new Date(), status: 'active' }])
          .mockResolvedValueOnce([{ id: 'adv-2', ruleId: 'rule-cotton', fieldId: 'field-2', farmId: 'farm-1', farmerId: 'farmer-1', cropSeasonId: 'season-2', validFrom: new Date(), validTo: new Date(), advisoryText: 'Cotton alert', severity: 'urgent', verificationStatus: 'generated', generatedAt: new Date(), status: 'active' }]),
      }),
    } as any);

    const advisories = await service.generateAdvisories('farm-1');
    expect(advisories).toHaveLength(2);
    expect(advisories.map(a => a.fieldId)).toContain('field-1');
    expect(advisories.map(a => a.fieldId)).toContain('field-2');
  });

  it('returns empty array when no active advisories', async () => {
    const { db } = await import('../../../src/database/db.js');

    vi.spyOn(db, 'select').mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);

    const results = await service.getAdvisories('farm-no-data');
    expect(results).toHaveLength(0);
  });
});
