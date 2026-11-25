export type DataStatus = 'LIVE' | 'CACHED' | 'STALE' | 'UNAVAILABLE';

export type AdvisoryCategory =
  | 'irrigation'
  | 'fertilizer'
  | 'pesticide'
  | 'harvest'
  | 'sowing'
  | 'weather_alert'
  | 'crop_protection'
  | 'general';

export type AdvisorySeverity = 'info' | 'warning' | 'urgent';
export type AdvisoryVerificationStatus = 'generated' | 'verified' | 'requires_review' | 'rejected';
export type EvidenceStrength = 'verified' | 'recommended' | 'preliminary';

export interface FarmerField {
  id: string;
  farmId: string;
  fieldName: string;
  areaAcres: string | null;
  soilType: string | null;
  irrigationSource: string | null;
}

export interface FarmerFarm {
  id: string;
  farmName: string;
  totalAreaAcres: string | null;
  ownershipType: string;
  fields: FarmerField[];
}

export interface FarmerProfileSummary {
  id: string;
  userId: string;
  fullName: string;
  preferredLanguage: string;
  state: string;
  district: string;
  mandal: string;
  village: string;
  pinCode: string;
  status: string;
}

export interface AuthContextData {
  user: {
    id: string;
    phone: string;
    role?: 'farmer' | 'buyer';
    status: string;
  };
  farmerProfile: FarmerProfileSummary | null;
  buyerProfile?: {
    id: string;
    userId: string;
    businessName: string;
    contactName: string;
    businessType: string;
    state: string;
    district: string;
    city: string;
    pinCode: string;
    gstOrLicenseNumber?: string | null;
    verificationStatus: string;
    status: string;
  } | null;
  farms: FarmerFarm[];
}

export interface AuthExchangeData extends AuthContextData {
  token: string;
}

export interface DashboardCurrentWeather {
  temperature: number | null;
  humidity: number | null;
  rainfall: number;
  windSpeed: number | null;
  dataStatus: DataStatus;
}

export interface TodayForecastSummary {
  high: number | null;
  low: number | null;
  rainfallProb: number | null;
}

export interface DashboardAdvisoryItem {
  id: string;
  category: string;
  severity: string;
  advisoryText: string;
  generatedAt: string;
}

export interface WeatherDashboardData {
  farmId: string;
  farmName: string;
  currentWeather: DashboardCurrentWeather;
  todayForecast: TodayForecastSummary | null;
  advisories: DashboardAdvisoryItem[];
  lastUpdated: string;
}

export interface FarmCurrentWeatherData {
  id: string;
  locationId: string;
  locationType: 'farm' | 'field';
  dataStatus: DataStatus;
  provider: string;
  observedAt: string;
  fetchedAt: string;
  temperature: number | null;
  temperatureMin: number | null;
  temperatureMax: number | null;
  humidity: number | null;
  windSpeed: number | null;
  windDirection: string | null;
  windGusts: number | null;
  pressure: number | null;
  cloudCover: number | null;
  rainfall: number | null;
  rainfallProbability: number | null;
  weatherCode: number | null;
  weatherDescription: string | null;
  farmName: string;
}

export interface ForecastItem {
  id: string;
  locationId: string;
  locationType: 'farm' | 'field';
  dataStatus: DataStatus;
  provider: string;
  forecastType: 'hourly' | 'daily';
  issueAt: string;
  validAt: string;
  temperatureMin: number | null;
  temperatureMax: number | null;
  humidity: number | null;
  rainfall: number | null;
  rainfallProbability: number | null;
  precipitationSum: number | null;
  windSpeed: number | null;
  windDirection: string | null;
  cloudCover: number | null;
  weatherCode: number | null;
  weatherDescription: string | null;
  sunshineDuration: number | null;
  uvIndex: number | null;
}

export interface FieldForecastData {
  fieldId: string;
  fieldName: string;
  forecast: ForecastItem[];
}

export interface WeatherAlertItem {
  id: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'severe';
  headline: string;
  description: string | null;
  recommendedAction: string | null;
  validFrom: string;
  validTo: string;
}

export interface WeatherAlertsData {
  alerts: WeatherAlertItem[];
}

export interface FarmAdvisoryItem {
  id: string;
  category: string;
  severity: AdvisorySeverity;
  advisoryText: string;
  validFrom: string;
  validTo: string | null;
  evidenceSource: string;
  evidenceStrength: EvidenceStrength;
  verificationStatus: AdvisoryVerificationStatus;
  generatedAt: string;
}

export interface FarmAdvisoriesData {
  farmId: string;
  farmName: string;
  advisories: FarmAdvisoryItem[];
}

export interface WeatherRefreshData {
  status: 'refreshed';
  forced: boolean;
  message: string;
}
