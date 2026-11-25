/**
 * Weather Module Voice Tools
 *
 * Exposes weather and advisory information to the AI Voice Assistant
 * via the shared VoiceDispatcher.
 */

import { voiceDispatcher } from '../voice/dispatcher.js';
import { weatherService } from './services/weather.service.js';
import { advisoryService } from './services/advisory.service.js';
import { AlertProcessorService } from './services/alert-processor.service.js';
import { assertFarmOwnership } from '../../common/auth/ownership.js';
import { VoiceTool, VoiceSessionContext } from '../voice/dispatcher.js';

const alertProcessorService = new AlertProcessorService();

export function createWeatherVoiceTools(): VoiceTool[] {
  return [
    {
      name: 'getCurrentWeather',
      description: 'Get current weather conditions for a farm',
      parameters: {
        type: 'object' as const,
        properties: {
          farmId: { type: 'string', format: 'uuid' },
        },
        required: ['farmId'],
      },
      execute: async (session: VoiceSessionContext, args: { farmId: string }) => {
        // Ownership check
        const { farm } = await assertFarmOwnership(session.userId, args.farmId);

        const weather = await weatherService.getCurrentWeather(farm.id);

        return {
          farmName: farm.farmName,
          temperature: `${weather.temperature}°C`,
          humidity: `${weather.humidity}%`,
          rainfall: weather.rainfall ? `${weather.rainfall}mm` : 'No rainfall',
          dataStatus: weather.dataStatus
        };
      },
    },
    {
      name: 'getWeatherForecast',
      description: 'Get weather forecast for a farm',
      parameters: {
        type: 'object' as const,
        properties: {
          farmId: { type: 'string', format: 'uuid' },
          days: { type: 'number', minimum: 1, maximum: 7, default: 3 },
        },
        required: ['farmId'],
      },
      execute: async (session: VoiceSessionContext, args: { farmId: string; days?: number }) => {
        const { farm } = await assertFarmOwnership(session.userId, args.farmId);

        const forecast = await weatherService.getForecast(farm.id, undefined, args.days || 3, 'daily');

        return forecast.map(f => ({
          date: f.validAt.toISOString().split('T')[0],
          high: `${f.temperatureMax}°C`,
          low: `${f.temperatureMin}°C`,
          rainfallProb: `${f.rainfallProbability}%`
        }));
      },
    },
    {
      name: 'getCropAdvisory',
      description: 'Get crop-aware agricultural advisories for a farm',
      parameters: {
        type: 'object' as const,
        properties: {
          farmId: { type: 'string', format: 'uuid' },
        },
        required: ['farmId'],
      },
      execute: async (session: VoiceSessionContext, args: { farmId: string }) => {
        const { farm } = await assertFarmOwnership(session.userId, args.farmId);

        const advisories = await advisoryService.getAdvisories(farm.id);

        return advisories.map(a => ({
          category: a.category,
          severity: a.severity,
          text: a.advisoryText,
          source: a.evidenceSource
        }));
      },
    },
    {
      name: 'getWeatherAlerts',
      description: 'Get active weather alerts for a farm',
      parameters: {
        type: 'object' as const,
        properties: {
          farmId: { type: 'string', format: 'uuid' },
        },
        required: ['farmId'],
      },
      execute: async (session: VoiceSessionContext, args: { farmId: string }) => {
        const { farm } = await assertFarmOwnership(session.userId, args.farmId);

        const alerts = await alertProcessorService.getActiveAlerts(farm.id);

        return {
          alerts: alerts.map(a => ({
            type: a.alertType,
            severity: a.severity,
            headline: a.headline,
            action: a.recommendedAction || undefined,
          })),
        };
      },
    },
  ];
}
