/**
 * Weather Provider Interface
 *
 * Defines the contract for weather data providers.
 * Implement this interface to add new weather sources.
 */

export interface WeatherProviderConfig {
  name: string;
  apiEndpoint: string;
  apiKey?: string;
  attribution?: string;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface CurrentWeatherResponse {
  provider: string;
  location: GeoLocation;
  observedAt: Date;

  // Current conditions
  temperature: number | null;
  temperatureMin: number | null;
  temperatureMax: number | null;
  humidity: number | null;
  windSpeed: number | null;
  windDirection: string | null;
  windGusts: number | null;
  pressure: number | null;
  cloudCover: number | null;

  // Precipitation
  rainfall: number | null;
  rainfallProbability: number | null;

  // Weather description
  weatherCode: number | null;
  weatherDescription: string | null;

  // Metadata
  isEstimate: boolean;
  attribution?: string;
}

export interface HourlyForecastResponse {
  provider: string;
  location: GeoLocation;
  issueAt: Date;
  forecasts: HourlyForecast[];
}

export interface HourlyForecast {
  validAt: Date;
  temperature: number | null;
  temperatureMin: number | null;
  temperatureMax: number | null;
  humidity: number | null;
  rainfall: number | null;
  rainfallProbability: number | null;
  precipitationSum: number | null;
  windSpeed: number | null;
  windDirection: string | null;
  windGusts: number | null;
  cloudCover: number | null;
  weatherCode: number | null;
  weatherDescription: string | null;
  sunshineDuration: number | null;
  uvIndex: number | null;
}

export interface DailyForecastResponse {
  provider: string;
  location: GeoLocation;
  issueAt: Date;
  forecasts: DailyForecast[];
}

export interface DailyForecast {
  validAt: Date;
  temperatureMin: number | null;
  temperatureMax: number | null;
  humidity: number | null;
  rainfall: number | null;
  rainfallProbability: number | null;
  precipitationSum: number | null;
  windSpeed: number | null;
  windDirection: string | null;
  windGusts: number | null;
  cloudCover: number | null;
  weatherCode: number | null;
  weatherDescription: string | null;
  sunshineDuration: number | null;
  uvIndexMax: number | null;
}

export interface WeatherAlertResponse {
  provider: string;
  location: GeoLocation;
  alerts: WeatherAlertData[];
}

export interface WeatherAlertData {
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'severe';
  validFrom: Date;
  validTo: Date;
  headline: string;
  description: string | null;
  recommendedAction: string | null;
  providerAlertId?: string;
}

export interface WeatherProviderError extends Error {
  code: 'PROVIDER_UNAVAILABLE' | 'RATE_LIMIT_EXCEEDED' | 'INVALID_RESPONSE' | 'AUTHENTICATION_FAILED' | 'NETWORK_ERROR';
  provider: string;
  statusCode?: number;
}

/**
 * Abstract weather provider class
 */
export abstract class WeatherProvider {
  protected config: WeatherProviderConfig;

  constructor(config: WeatherProviderConfig) {
    this.config = config;
  }

  abstract getCurrentWeather(location: GeoLocation): Promise<CurrentWeatherResponse>;
  abstract getHourlyForecast(location: GeoLocation, hours: number): Promise<HourlyForecastResponse>;
  abstract getDailyForecast(location: GeoLocation, days: number): Promise<DailyForecastResponse>;
  abstract getAlerts(location: GeoLocation): Promise<WeatherAlertResponse>;

  abstract isAvailable(): boolean;
  abstract getAttribution(): string;

  protected getName(): string {
    return this.config.name;
  }

  /**
   * Validate coordinates are within valid range
   */
  protected validateLocation(location: GeoLocation): void {
    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number' ||
        isNaN(location.latitude) || isNaN(location.longitude) ||
        !isFinite(location.latitude) || !isFinite(location.longitude)) {
      throw new Error('Invalid coordinates: latitude and longitude must be finite numbers');
    }
    if (location.latitude < -90 || location.latitude > 90) {
      throw new Error('Invalid latitude: must be between -90 and 90');
    }
    if (location.longitude < -180 || location.longitude > 180) {
      throw new Error('Invalid longitude: must be between -180 and 180');
    }
  }

  /**
   * Convert wind direction degrees to cardinal direction
   */
  protected degreesToCardinal(degrees: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  }

  /**
   * Get WMO weather description from code
   */
  protected getWeatherDescription(code: number): string | null {
    const descriptions: Record<number, string> = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Foggy',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      56: 'Light freezing drizzle',
      57: 'Dense freezing drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      66: 'Light freezing rain',
      67: 'Heavy freezing rain',
      71: 'Slight snow fall',
      73: 'Moderate snow fall',
      75: 'Heavy snow fall',
      77: 'Snow grains',
      80: 'Slight rain showers',
      81: 'Moderate rain showers',
      82: 'Violent rain showers',
      85: 'Slight snow showers',
      86: 'Heavy snow showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with slight hail',
      99: 'Thunderstorm with heavy hail',
    };
    return descriptions[code] ?? null;
  }
}

/**
 * Map alert type from weather code or description
 */
export function mapAlertType(weatherCode: number, severity: 'low' | 'medium' | 'high' | 'severe'): { type: string; headline: string } {
  if (weatherCode >= 95) {
    return { type: 'thunderstorm', headline: 'Thunderstorm warning' };
  }
  if ((weatherCode >= 71 && weatherCode <= 77) || weatherCode === 85 || weatherCode === 86) {
    return { type: 'snow', headline: 'Snow conditions' };
  }
  if (weatherCode >= 65 && weatherCode <= 67) {
    return { type: 'heavy_rain', headline: 'Heavy rainfall warning' };
  }
  if ((weatherCode >= 61 && weatherCode <= 64) || (weatherCode >= 80 && weatherCode <= 82)) {
    return { type: 'rain', headline: 'Rain expected' };
  }
  if (weatherCode === 45 || weatherCode === 48) {
    return { type: 'fog', headline: 'Fog advisory' };
  }
  return { type: 'weather', headline: 'Weather advisory' };
}