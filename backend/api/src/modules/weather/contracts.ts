import { Type, Static } from '@sinclair/typebox';

// ==============================================================================
// Weather & Advisory Types
// ==============================================================================

export const WeatherCondition = Type.Union([
  Type.Literal('clear'),
  Type.Literal('cloudy'),
  Type.Literal('rain'),
  Type.Literal('storm'),
  Type.Literal('drizzle'),
  Type.Literal('mist'),
]);
export type WeatherConditionType = Static<typeof WeatherCondition>;

export const AlertSeverity = Type.Union([
  Type.Literal('low'),
  Type.Literal('medium'),
  Type.Literal('high'),
  Type.Literal('critical'),
]);
export type AlertSeverityType = Static<typeof AlertSeverity>;

// ==============================================================================
// Web API Contracts
// ==============================================================================

/**
 * Current Weather Information
 */
export const CurrentWeatherSchema = Type.Object({
  temperature: Type.Number(),
  humidity: Type.Number(),
  windSpeed: Type.Number(),
  condition: WeatherCondition,
  description: Type.String(),
  updatedAt: Type.String(),
});
export type CurrentWeather = Static<typeof CurrentWeatherSchema>;

/**
 * Weather Forecast (e.g., daily)
 */
export const WeatherForecastSchema = Type.Object({
  date: Type.String(),
  minTemp: Type.Number(),
  maxTemp: Type.Number(),
  condition: WeatherCondition,
});
export type WeatherForecast = Static<typeof WeatherForecastSchema>;

/**
 * Advisory Information
 */
export const AdvisorySchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  type: Type.String(), // e.g., 'irrigation', 'pest', 'fertilizer'
  title: Type.String(),
  message: Type.String(),
  createdAt: Type.String(),
});
export type Advisory = Static<typeof AdvisorySchema>;

/**
 * Weather Alert Information
 */
export const AlertSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  severity: AlertSeverity,
  title: Type.String(),
  description: Type.String(),
  validUntil: Type.Optional(Type.String()),
});
export type Alert = Static<typeof AlertSchema>;

/**
 * Weather Dashboard Response
 */
export const WeatherDashboardResponseSchema = Type.Object({
  currentWeather: CurrentWeatherSchema,
  forecast: Type.Array(WeatherForecastSchema),
  activeAdvisories: Type.Array(AdvisorySchema),
  activeAlerts: Type.Array(AlertSchema),
});
export type WeatherDashboardResponse = Static<typeof WeatherDashboardResponseSchema>;
