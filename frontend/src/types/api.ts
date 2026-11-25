import type { FarmerField } from './weather';

export type SessionMode = 'live' | 'demo';
export type UserRole = 'farmer' | 'buyer';

export interface BuyerProfile {
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
}

export interface FarmerProfile {
  id: string;
  userId: string;
  fullName: string;
  preferredLanguage: string;
  state: string;
  district: string;
  mandal: string;
  village: string;
  pinCode: string;
}

export interface FarmSummary {
  id: string;
  farmName: string;
  fieldId?: string;
  fieldName?: string;
  totalAreaAcres?: number;
  fields?: FarmerField[];
}

export interface AuthSession {
  mode: SessionMode;
  role: UserRole;
  token: string;
  user: {
    id: string;
    phone: string;
    role?: UserRole;
  };
  farmerProfile: FarmerProfile | null;
  buyerProfile?: BuyerProfile | null;
  farms: FarmSummary[];
  selectedFarmId: string;
}

/* ---------------- Pillar 3: Weather & Crop Advisory ---------------- */

export type AdvisoryCategory =
  | 'irrigation'
  | 'fertilizer'
  | 'pesticide'
  | 'harvest'
  | 'sowing'
  | 'weather_alert'
  | 'crop_protection'
  | 'general';

export interface WeatherAdvisoryItem {
  id: string;
  category: string;
  severity: string;
  advisoryText: string;
  validFrom?: string;
  validTo?: string;
  evidenceSource?: string;
  evidenceStrength?: string;
  verificationStatus?: string;
  generatedAt: string;
}

export interface WeatherDashboardData {
  farmId: string;
  farmName: string;
  currentWeather: {
    temperature: number | null;
    humidity: number | null;
    rainfall: number;
    windSpeed: number | null;
    dataStatus: string;
  };
  todayForecast: {
    high: number | null;
    low: number | null;
    rainfallProb: number | null;
  } | null;
  advisories: WeatherAdvisoryItem[];
  lastUpdated: string;
}

export interface WeatherForecastItem {
  validAt: string;
  temperature?: number | null;
  temperatureMin: number | null;
  temperatureMax: number | null;
  humidity: number | null;
  rainfall: number | null;
  rainfallProbability: number | null;
  windSpeed: number | null;
  weatherDescription: string | null;
}

export interface WeatherAlertItem {
  id: string;
  alertType: string;
  severity: string;
  headline: string;
  description: string;
  recommendedAction?: string | null;
  validFrom: string;
  validTo: string;
}

/* ---------------- Pillar 6: Soil Health & Input Verification ---------------- */

export type SoilReportStatus =
  | 'available'
  | 'pending'
  | 'partial'
  | 'not_found'
  | 'failed'
  | 'provider_unavailable'
  | 'demo';

export type InputCategory =
  | 'fertilizer'
  | 'seed'
  | 'pesticide'
  | 'bio_stimulant'
  | 'other';

export type InputVerificationStatus =
  | 'verified'
  | 'not_verified'
  | 'inconclusive'
  | 'not_found'
  | 'expired'
  | 'recall_alert'
  | 'provider_unavailable'
  | 'demo';

export interface SoilRecommendation {
  crop?: string;
  fertilizer?: string;
  dosageKgPerAcre?: number | string;
  note?: string;
}

export interface SoilReport {
  id: string;
  farmerId: string;
  farmId?: string | null;
  fieldId?: string | null;
  cardId?: string | null;
  reportId: string;
  source: string;
  sourceAuthority?: string | null;
  sampleDate?: string | null;
  testingDate?: string | null;
  reportDate: string;
  state?: string | null;
  district?: string | null;
  mandal?: string | null;
  village?: string | null;
  soilType?: string | null;
  ph?: number | null;
  ec?: number | null;
  organicCarbon?: number | null;
  nitrogen?: number | null;
  phosphorus?: number | null;
  potassium?: number | null;
  sulphur?: number | null;
  zinc?: number | null;
  iron?: number | null;
  copper?: number | null;
  manganese?: number | null;
  boron?: number | null;
  nutrientRatings?: Record<string, string> | null;
  recommendations?: SoilRecommendation[] | null;
  status: SoilReportStatus;
  isDemo?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SoilDashboardData {
  hasReport: boolean;
  latestReport: SoilReport | null;
  summary: {
    totalReports: number;
    lastTestedDate: string | null;
    primarySoilType: string | null;
    overallStatus: string;
    availableNutrientCount: number;
    criticalDeficiencies: string[];
  };
  recentReports: SoilReport[];
}

export interface InputVerificationRecord {
  id: string;
  farmerId: string;
  productName: string;
  category: InputCategory;
  brand?: string | null;
  manufacturer?: string | null;
  batchNumber?: string | null;
  registrationNumber?: string | null;
  verificationStatus: InputVerificationStatus;
  provider?: string | null;
  source?: string | null;
  evidence?: string | Record<string, unknown> | null;
  notes?: string | null;
  isDemo?: string | null;
  createdAt: string;
}

export interface VoiceSoilContext {
  farmer: {
    farmerId: string;
    fullName: string;
    district: string;
    state: string;
  };
  hasReport: boolean;
  reportId?: string | null;
  cardId?: string | null;
  reportDate?: string | null;
  dataFreshnessDays?: number | null;
  sourceAuthority?: string | null;
  isDemo: boolean;
  status: SoilReportStatus;
  nutrients: {
    ph?: number | null;
    ec?: number | null;
    organicCarbonPercent?: number | null;
    nitrogenKgPerHa?: number | null;
    phosphorusKgPerHa?: number | null;
    potassiumKgPerHa?: number | null;
    zincPpm?: number | null;
    ironPpm?: number | null;
  };
  missingMeasurements: string[];
  sourceRecommendations: SoilRecommendation[];
  aiGuidance: string;
}

export interface VoiceInputVerification {
  productName: string;
  category: string;
  brand?: string | null;
  batchNumber?: string | null;
  status: InputVerificationStatus;
  provider: string;
  isAuthentic: boolean;
  findingsSummary: string;
  aiGuidance: string;
}
