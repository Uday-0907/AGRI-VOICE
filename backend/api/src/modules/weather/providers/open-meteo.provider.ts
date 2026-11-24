/**
 * Open-Meteo Weather Provider
 *
 * Implementation of WeatherProvider for Open-Meteo API.
 * Free tier is for non-commercial use only - see https://open-meteo.com/en/terms
 */

import { WeatherProvider, GeoLocation, CurrentWeatherResponse, HourlyForecastResponse, DailyForecastResponse, WeatherAlertResponse } from './weather-provider.interface.js';

export class OpenMeteoProvider extends WeatherProvider {
  private readonly baseUrl = 'https://api.open-meteo.com/v1';

  constructor(apiKey?: string) {
    super({
      name: 'open-meteo',
      apiEndpoint: `${process.env.OPEN_METEO_API_URL || 'https://api.open-meteo.com/v1'}/forecast`,
      apiKey: apiKey || process.env.OPEN_METEO_API_KEY,
      attribution: 'Weather data by Open-Meteo (https://open-meteo.com/)',
    });
  }

  isAvailable(): boolean {
    // In production, this should check if commercial API is configured
    // For now, always available but will warn about commercial use
    return true;
  }

  getAttribution(): string {
    return this.config.attribution || 'Weather data by Open-Meteo';
  }

  async getCurrentWeather(location: GeoLocation): Promise<CurrentWeatherResponse> {
    this.validateLocation(location);

    const params = new URLSearchParams({
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,rain',
      timezone: 'Asia/Kolkata',
    });

    const url = `${this.config.apiEndpoint}?${params}`;

    try {
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Open-Meteo API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        provider: 'open-meteo',
        location,
        observedAt: new Date(data.current.time),
        temperature: data.current.temperature_2m,
        temperatureMin: null,
        temperatureMax: null,
        humidity: data.current.relative_humidity_2m,
        windSpeed: data.current.wind_speed_10m,
        windDirection: this.degreesToCardinal(data.current.wind_direction_10m),
        windGusts: data.current.wind_gusts_10m,
        pressure: data.current.pressure_msl,
        cloudCover: data.current.cloud_cover,
        rainfall: data.current.rain,
        rainfallProbability: null,
        weatherCode: data.current.weather_code,
        weatherDescription: this.getWeatherDescription(data.current.weather_code),
        isEstimate: false,
        attribution: this.getAttribution(),
      };
    } catch (error) {
      throw new Error(`Failed to fetch current weather: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getHourlyForecast(location: GeoLocation, hours: number = 24): Promise<HourlyForecastResponse> {
    this.validateLocation(location);

    // Open-Meteo supports at most 48 hourly steps. Reject larger requests
    // instead of silently clamping them and returning fewer records than asked.
    if (!Number.isInteger(hours) || hours < 1) {
      throw new Error('Invalid hourly forecast length: hours must be a positive integer');
    }
    if (hours > 48) {
      throw new Error('Hourly forecast supports a maximum of 48 hours');
    }

    const params = new URLSearchParams({
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(),
      hourly: 'temperature_2m,relative_humidity_2m,weather_code,rain,precipitation_probability,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,sunshine_duration,uv_index',
      forecast_hours: hours.toString(),
      timezone: 'Asia/Kolkata',
    });

    const url = `${this.config.apiEndpoint}?${params}`;

    try {
      const response = await fetch(url, { headers: this.getHeaders() });

      if (!response.ok) {
        throw new Error(`Open-Meteo API error: ${response.status}`);
      }

      const data = await response.json();
      const issueAt = new Date(data.hourly.time[0]);

      const forecasts = data.hourly.time.slice(0, hours).map((time: string, i: number) => ({
        validAt: new Date(time),
        temperature: data.hourly.temperature_2m[i],
        temperatureMin: null,
        temperatureMax: null,
        humidity: data.hourly.relative_humidity_2m[i],
        rainfall: data.hourly.rain[i] ?? null,
        rainfallProbability: data.hourly.precipitation_probability[i] ?? null,
        precipitationSum: data.hourly.precipitation[i] ?? null,
        windSpeed: data.hourly.wind_speed_10m[i],
        windDirection: data.hourly.wind_direction_10m[i] ? this.degreesToCardinal(data.hourly.wind_direction_10m[i]) : null,
        windGusts: data.hourly.wind_gusts_10m[i] ?? null,
        cloudCover: data.hourly.cloud_cover[i] ?? null,
        weatherCode: data.hourly.weather_code[i] ?? null,
        weatherDescription: data.hourly.weather_code[i] ? this.getWeatherDescription(data.hourly.weather_code[i]) : null,
        sunshineDuration: data.hourly.sunshine_duration[i] ?? null,
        uvIndex: data.hourly.uv_index[i] ?? null,
      }));

      return {
        provider: 'open-meteo',
        location,
        issueAt,
        forecasts,
      };
    } catch (error) {
      throw new Error(`Failed to fetch hourly forecast: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getDailyForecast(location: GeoLocation, days: number = 7): Promise<DailyForecastResponse> {
    this.validateLocation(location);

    const params = new URLSearchParams({
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(),
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,precipitation_sum,precipitation_probability_max,rain_sum,snowfall_sum,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,cloud_cover_mean,sunshine_duration,uv_index_max',
      forecast_days: Math.min(days, 16).toString(),
      timezone: 'Asia/Kolkata',
    });

    const url = `${this.config.apiEndpoint}?${params}`;

    try {
      const response = await fetch(url, { headers: this.getHeaders() });

      if (!response.ok) {
        throw new Error(`Open-Meteo API error: ${response.status}`);
      }

      const data = await response.json();
      const issueAt = new Date(data.daily.time[0]);

      const forecasts = data.daily.time.map((time: string, i: number) => ({
        validAt: new Date(time),
        temperatureMin: data.daily.temperature_2m_min[i],
        temperatureMax: data.daily.temperature_2m_max[i],
        humidity: data.daily.relative_humidity_2m_mean[i] ?? null,
        rainfall: data.daily.rain_sum[i] ?? null,
        rainfallProbability: data.daily.precipitation_probability_max[i] ?? null,
        precipitationSum: data.daily.precipitation_sum[i] ?? null,
        windSpeed: data.daily.wind_speed_10m_max[i] ?? null,
        windDirection: data.daily.wind_direction_10m_dominant[i] ? this.degreesToCardinal(data.daily.wind_direction_10m_dominant[i]) : null,
        windGusts: data.daily.wind_gusts_10m_max[i] ?? null,
        cloudCover: data.daily.cloud_cover_mean[i] ?? null,
        weatherCode: data.daily.weather_code[i] ?? null,
        weatherDescription: data.daily.weather_code[i] ? this.getWeatherDescription(data.daily.weather_code[i]) : null,
        sunshineDuration: data.daily.sunshine_duration[i] ?? null,
        uvIndexMax: data.daily.uv_index_max[i] ?? null,
      }));

      return {
        provider: 'open-meteo',
        location,
        issueAt,
        forecasts,
      };
    } catch (error) {
      throw new Error(`Failed to fetch daily forecast: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAlerts(location: GeoLocation): Promise<WeatherAlertResponse> {
    // Open-Meteo doesn't provide weather alerts directly
    // This would need a secondary provider or custom solution
    return {
      provider: 'open-meteo',
      location,
      alerts: [],
    };
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }
}

/**
 * Factory function to create weather provider
 */
export function createWeatherProvider(type: string = 'open-meteo', apiKey?: string): WeatherProvider {
  switch (type) {
    case 'open-meteo':
      return new OpenMeteoProvider(apiKey);
    default:
      throw new Error(`Unknown weather provider: ${type}`);
  }
}