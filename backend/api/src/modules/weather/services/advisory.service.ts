/**
 * Advisory Service
 *
 * Deterministic, evidence-based crop advisory engine.
 * Generates advisories based on weather conditions and crop stages.
 */

import { db } from '../../../database/db.js';
import { advisoryRules, cropAdvisories, cropSeasons, crops, fields, farms, farmerProfiles, weatherObservations, weatherForecasts } from '../../../database/schema/index.js';
import { eq, and, desc, gte, lte, or, sql } from 'drizzle-orm';

export type AdvisoryStatus = 'generated' | 'verified' | 'requires_review' | 'rejected';
export type AdvisoryCategory = 'irrigation' | 'fertilizer' | 'pesticide' | 'harvest' | 'sowing' | 'weather_alert' | 'crop_protection' | 'general';
export type EvidenceStrength = 'verified' | 'recommended' | 'preliminary';

export interface AdvisoryContext {
  farmerId: string;
  farmId: string;
  fieldId: string;
  cropSeasonId: string;
  cropId: string;
  cropName: string;
  season: string;
  sowingDate: Date | null;
  growthStage: string;
}

export interface WeatherContext {
  temperature: number | null;
  humidity: number | null;
  rainfall: number | null;
  rainfallProbability: number | null;
  forecastRainfall: number | null;
}

export interface GeneratedAdvisory {
  id: string;
  ruleId: string | null;
  fieldId: string | null;
  farmId: string | null;
  farmerId: string | null;
  cropSeasonId: string | null;
  category: AdvisoryCategory;
  severity: 'info' | 'warning' | 'urgent';
  advisoryText: string;
  validFrom: Date;
  validTo: Date | null;
  weatherContext: WeatherContext;
  evidenceSource: string;
  evidenceStrength: EvidenceStrength;
  verificationStatus: AdvisoryStatus;
  generatedAt: Date;
}

function normalizeSeverity(severity: string | null | undefined): 'info' | 'warning' | 'urgent' {
  if (severity === 'urgent' || severity === 'warning') {
    return severity;
  }
  return 'info';
}

export class AdvisoryService {

  /**
   * Get active crop seasons for a farm (supports multiple fields and crop seasons)
   */
  async getActiveCropSeasons(farmId: string): Promise<AdvisoryContext[]> {
    const seasons = await db
      .select({
        id: cropSeasons.id,
        cropId: cropSeasons.cropId,
        season: cropSeasons.season,
        sowingDate: cropSeasons.sowingDate,
        status: cropSeasons.status,
        fieldId: cropSeasons.fieldId,
      })
      .from(cropSeasons)
      .innerJoin(fields, eq(cropSeasons.fieldId, fields.id))
      .where(
        and(
          eq(fields.farmId, farmId),
          eq(cropSeasons.status, 'growing')
        )
      );

    if (seasons.length === 0) return [];

    // Get farmer profile
    const [farm] = await db
      .select({ farmerId: farms.farmerId })
      .from(farms)
      .where(eq(farms.id, farmId))
      .limit(1);

    const contexts: AdvisoryContext[] = [];

    for (const season of seasons) {
      // Get crop name
      const [crop] = await db
        .select({ name: crops.name })
        .from(crops)
        .where(eq(crops.id, season.cropId))
        .limit(1);

      // Determine growth stage from sowing date
      const growthStage = this.calculateGrowthStage(season.sowingDate ? new Date(season.sowingDate) : null);

      contexts.push({
        farmerId: farm?.farmerId || '',
        farmId,
        fieldId: season.fieldId,
        cropSeasonId: season.id,
        cropId: season.cropId,
        cropName: crop?.name || 'Unknown',
        season: season.season,
        sowingDate: season.sowingDate ? new Date(season.sowingDate) : null,
        growthStage,
      });
    }

    return contexts;
  }

  /**
   * Get active crop season for a farm (backwards-compatible single season)
   */
  async getActiveCropSeason(farmId: string): Promise<AdvisoryContext | null> {
    const seasons = await this.getActiveCropSeasons(farmId);
    return seasons.length > 0 ? seasons[0] : null;
  }

  /**
   * Calculate growth stage from sowing date
   */
  private calculateGrowthStage(sowingDate: Date | null): string {
    if (!sowingDate) return 'unknown';

    const daysSinceSowing = Math.floor((Date.now() - sowingDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceSowing < 15) return 'vegetative_early';
    if (daysSinceSowing < 30) return 'vegetative';
    if (daysSinceSowing < 50) return 'flowering';
    if (daysSinceSowing < 70) return 'fruiting';
    if (daysSinceSowing < 90) return 'maturation';
    return 'harvest';
  }

  /**
   * Get weather context for a location
   */
  async getWeatherContext(locationId: string, locationType: 'farm' | 'field'): Promise<WeatherContext> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [observation] = await db
      .select({
        temperature: weatherObservations.temperature,
        humidity: weatherObservations.humidity,
        rainfall: weatherObservations.rainfall,
        rainfallProbability: weatherObservations.rainfallProbability,
        fetchedAt: weatherObservations.fetchedAt,
      })
      .from(weatherObservations)
      .where(
        and(
          eq(weatherObservations.locationId, locationId),
          eq(weatherObservations.locationType, locationType),
          gte(weatherObservations.fetchedAt, twentyFourHoursAgo)
        )
      )
      .orderBy(desc(weatherObservations.fetchedAt))
      .limit(1);

    // Get forecast for next 24 hours
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const [fcst] = await db
      .select({
        rainfall: sql<number>`SUM(${weatherForecasts.rainfall})`,
        rainfallProbability: sql<number>`MAX(${weatherForecasts.rainfallProbability})`,
      })
      .from(weatherForecasts)
      .where(
        and(
          eq(weatherForecasts.locationId, locationId),
          eq(weatherForecasts.locationType, locationType),
          eq(weatherForecasts.forecastType, 'hourly'),
          gte(weatherForecasts.validAt, now),
          sql`${weatherForecasts.validAt} < ${tomorrow}`
        )
      )
      .limit(1);

    return {
      temperature: observation?.temperature ? Number(observation.temperature) : null,
      humidity: observation?.humidity ? Number(observation.humidity) : null,
      rainfall: observation?.rainfall ? Number(observation.rainfall) : null,
      rainfallProbability: observation?.rainfallProbability ? Number(observation.rainfallProbability) : null,
      forecastRainfall: fcst?.rainfall ? Number(fcst.rainfall) : null,
    };
  }

  /**
   * Generate advisories for a farm (processes all active crop seasons across all fields)
   */
  async generateAdvisories(farmId: string): Promise<GeneratedAdvisory[]> {
    const contexts = await this.getActiveCropSeasons(farmId);
    if (contexts.length === 0) return [];

    const weather = await this.getWeatherContext(farmId, 'farm');
    const advisories: GeneratedAdvisory[] = [];

    for (const context of contexts) {
      // Get active rules for this crop, season, and growth stage
      const rules = await db
        .select()
        .from(advisoryRules)
        .where(
          and(
            eq(advisoryRules.status, 'active'),
            sql`${advisoryRules.effectiveFrom} <= NOW()`,
            sql`(${advisoryRules.effectiveTo} IS NULL OR ${advisoryRules.effectiveTo} > NOW())`,
            sql`(${advisoryRules.cropId} = ${context.cropId} OR ${advisoryRules.cropId} IS NULL)`,
            sql`(${advisoryRules.season} = ${context.season} OR ${advisoryRules.season} IS NULL)`,
            sql`(${advisoryRules.growthStage} = ${context.growthStage} OR ${advisoryRules.growthStage} IS NULL)`
          )
        )
        .orderBy(desc(advisoryRules.priority));

      for (const rule of rules) {
        const triggered = this.evaluateRule(rule, weather);
        if (triggered) {
          const advisory = await this.createAdvisory(rule, context, weather);
          if (advisory) advisories.push(advisory);
        }
      }
    }

    return advisories;
  }

  /**
   * Evaluate if a rule's conditions are met
   */
  private evaluateRule(rule: any, weather: WeatherContext): boolean {
    const value = this.getWeatherValue(rule.conditionType, weather);
    if (value === null) return false;

    const threshold = parseFloat(rule.threshold);
    if (isNaN(threshold) || !isFinite(threshold)) return false;

    const result = this.compareValues(value, threshold, rule.logicalOperator);
    if (result === false && (!rule.condition2Type || rule.logicalCombinator === 'AND')) {
      return false;
    }

    // Handle secondary condition if exists
    if (rule.condition2Type) {
      const value2 = this.getWeatherValue(rule.condition2Type, weather);
      if (value2 === null) return false;

      const threshold2 = parseFloat(rule.condition2Threshold);
      if (isNaN(threshold2) || !isFinite(threshold2)) return false;

      const result2 = this.compareValues(value2, threshold2, rule.condition2Operator);

      const combinator = (rule.logicalCombinator || 'AND').toUpperCase();
      if (combinator === 'AND') {
        return result && result2;
      } else if (combinator === 'OR') {
        return result || result2;
      }
      return false; // Unknown combinator rejected defensively
    }

    return result;
  }

  /**
   * Get weather value by condition type
   */
  private getWeatherValue(conditionType: string, weather: WeatherContext): number | null {
    switch (conditionType) {
      case 'temperature_above':
      case 'temperature_below':
        return weather.temperature;
      case 'humidity_above':
      case 'humidity_below':
        return weather.humidity;
      case 'rainfall_expected':
      case 'rainfall_above':
        return weather.forecastRainfall ?? weather.rainfall;
      case 'rainfall_probability_above':
        return weather.rainfallProbability;
      default:
        return null;
    }
  }

  /**
   * Compare value against threshold
   */
  private compareValues(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }

  /**
   * Create and store an advisory
   */
  private async createAdvisory(rule: any, context: AdvisoryContext, weather: WeatherContext): Promise<GeneratedAdvisory | null> {
    // Check if advisory already exists for this rule/location/date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [existing] = await db
      .select()
      .from(cropAdvisories)
      .where(
        and(
          eq(cropAdvisories.ruleId, rule.id),
          eq(cropAdvisories.fieldId, context.fieldId),
          sql`${cropAdvisories.generatedAt} >= ${today}`,
          sql`${cropAdvisories.generatedAt} < ${tomorrow}`
        )
      )
      .limit(1);

    if (existing) return null;

    const [advisory] = await db.insert(cropAdvisories).values({
      ruleId: rule.id,
      fieldId: context.fieldId,
      farmId: context.farmId,
      farmerId: context.farmerId,
      cropSeasonId: context.cropSeasonId,
      validFrom: new Date(),
      validTo: new Date(Date.now() + 24 * 60 * 60 * 1000), // Valid for 24 hours
      advisoryText: rule.advisoryText,
      severity: rule.severity,
      temperatureAtGeneration: weather.temperature !== null ? String(weather.temperature) : null,
      humidityAtGeneration: weather.humidity !== null ? String(weather.humidity) : null,
      rainfallAtGeneration: weather.rainfall !== null ? String(weather.rainfall) : null,
      rainfallProbabilityAtGeneration: weather.rainfallProbability !== null ? String(weather.rainfallProbability) : null,
      forecastRainfall: weather.forecastRainfall !== null ? String(weather.forecastRainfall) : null,
      verificationStatus: rule.requiresHumanConfirmation ? 'requires_review' : 'generated',
      status: 'active',
    }).returning();

    return {
      id: advisory.id,
      ruleId: advisory.ruleId,
      fieldId: advisory.fieldId,
      farmId: advisory.farmId,
      farmerId: advisory.farmerId,
      cropSeasonId: advisory.cropSeasonId,
      category: rule.category as AdvisoryCategory,
      severity: normalizeSeverity(rule.severity),
      advisoryText: rule.advisoryText,
      validFrom: advisory.validFrom,
      validTo: advisory.validTo,
      weatherContext: weather,
      evidenceSource: rule.sourceName || 'System-generated',
      evidenceStrength: (rule.evidenceStrength as EvidenceStrength) || 'preliminary',
      verificationStatus: (advisory.verificationStatus as AdvisoryStatus) || 'generated',
      generatedAt: advisory.generatedAt,
    };
  }

  /**
   * Get advisories for a farm
   */
  async getAdvisories(farmId: string, category?: AdvisoryCategory): Promise<GeneratedAdvisory[]> {
    const now = new Date();

    const conditions = [
      eq(cropAdvisories.farmId, farmId),
      eq(cropAdvisories.status, 'active'),
      lte(cropAdvisories.validFrom, now),
      or(
        gte(cropAdvisories.validTo, now),
        sql`${cropAdvisories.validTo} IS NULL`
      ),
    ];

    if (category) {
      conditions.push(sql`(SELECT category FROM advisory_rules WHERE id = ${cropAdvisories.ruleId}) = ${category}`);
    }

    const results = await db
      .select({
        id: cropAdvisories.id,
        ruleId: cropAdvisories.ruleId,
        fieldId: cropAdvisories.fieldId,
        farmId: cropAdvisories.farmId,
        farmerId: cropAdvisories.farmerId,
        cropSeasonId: cropAdvisories.cropSeasonId,
        category: sql<string>`(SELECT category FROM advisory_rules WHERE id = ${cropAdvisories.ruleId})`,
        severity: cropAdvisories.severity,
        advisoryText: cropAdvisories.advisoryText,
        validFrom: cropAdvisories.validFrom,
        validTo: cropAdvisories.validTo,
        temperatureAtGeneration: cropAdvisories.temperatureAtGeneration,
        humidityAtGeneration: cropAdvisories.humidityAtGeneration,
        rainfallAtGeneration: cropAdvisories.rainfallAtGeneration,
        rainfallProbabilityAtGeneration: cropAdvisories.rainfallProbabilityAtGeneration,
        forecastRainfall: cropAdvisories.forecastRainfall,
        verificationStatus: cropAdvisories.verificationStatus,
        generatedAt: cropAdvisories.generatedAt,
        sourceName: sql<string>`(SELECT source_name FROM advisory_rules WHERE id = ${cropAdvisories.ruleId})`,
        evidenceStrength: sql<string>`(SELECT evidence_strength FROM advisory_rules WHERE id = ${cropAdvisories.ruleId})`,
      })
      .from(cropAdvisories)
      .where(and(...conditions))
      .orderBy(desc(cropAdvisories.severity), desc(cropAdvisories.generatedAt));

    return results.map(r => ({
      id: r.id,
      ruleId: r.ruleId,
      fieldId: r.fieldId,
      farmId: r.farmId,
      farmerId: r.farmerId,
      cropSeasonId: r.cropSeasonId,
      category: r.category as AdvisoryCategory,
      severity: normalizeSeverity(r.severity),
      advisoryText: r.advisoryText,
      validFrom: r.validFrom,
      validTo: r.validTo,
      weatherContext: {
        temperature: r.temperatureAtGeneration ? Number(r.temperatureAtGeneration) : null,
        humidity: r.humidityAtGeneration ? Number(r.humidityAtGeneration) : null,
        rainfall: r.rainfallAtGeneration ? Number(r.rainfallAtGeneration) : null,
        rainfallProbability: r.rainfallProbabilityAtGeneration ? Number(r.rainfallProbabilityAtGeneration) : null,
        forecastRainfall: r.forecastRainfall ? Number(r.forecastRainfall) : null,
      },
      evidenceSource: r.sourceName ?? 'System-generated',
      evidenceStrength: (r.evidenceStrength as EvidenceStrength) ?? 'preliminary',
      verificationStatus: (r.verificationStatus as AdvisoryStatus) ?? 'generated',
      generatedAt: r.generatedAt,
    }));
  }
}

export const advisoryService = new AdvisoryService();