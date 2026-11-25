import type {
  AuthSession,
  InputVerificationRecord,
  SoilDashboardData,
  SoilReport,
  VoiceInputVerification,
  VoiceSoilContext,
  WeatherAdvisoryItem,
  WeatherAlertItem,
  WeatherDashboardData,
  WeatherForecastItem,
} from '../types/api';

export const DEMO_FARM_ID = 'fm000000-0000-0000-0000-000000000001';
export const DEMO_FIELD_ID = 'fld00000-0000-0000-0000-000000000001';
export const DEMO_FARMER_ID = 'f0000000-0000-0000-0000-000000000001';

export function createDemoSession(phone = '+919876543201'): AuthSession {
  return {
    mode: 'demo',
    token: 'demo-preview-session',
    user: {
      id: 'a0000000-0000-0000-0000-000000000001',
      phone,
    },
    farmerProfile: {
      id: DEMO_FARMER_ID,
      userId: 'a0000000-0000-0000-0000-000000000001',
      fullName: 'Ramesh Kumar (Demo Farmer)',
      preferredLanguage: 'te',
      state: 'Andhra Pradesh',
      district: 'Guntur',
      mandal: 'Tenali',
      village: 'Kollipara',
      pinCode: '522201',
    },
    farms: [
      {
        id: DEMO_FARM_ID,
        farmName: 'Kollipara Main Paddy Farm',
        fieldId: DEMO_FIELD_ID,
        fieldName: 'North Plot',
        totalAreaAcres: 3.5,
      },
    ],
    selectedFarmId: DEMO_FARM_ID,
  };
}

export const DEMO_WEATHER_DASHBOARD: WeatherDashboardData = {
  farmId: DEMO_FARM_ID,
  farmName: 'Kollipara Main Paddy Farm',
  currentWeather: {
    temperature: 29.4,
    humidity: 68,
    rainfall: 2.5,
    windSpeed: 11.2,
    dataStatus: 'demo_preview',
  },
  todayForecast: {
    high: 32.0,
    low: 23.5,
    rainfallProb: 35,
  },
  advisories: [
    {
      id: 'adv-demo-1',
      category: 'irrigation',
      severity: 'moderate',
      advisoryText:
        'Moderate afternoon warmth expected. Maintain 2-3 cm standing water in paddy plots and irrigate during early morning hours.',
      evidenceSource: 'AgriVoice Pillar 3 Advisory Engine (Demo)',
      evidenceStrength: 'moderate',
      verificationStatus: 'demo',
      generatedAt: new Date().toISOString(),
    },
    {
      id: 'adv-demo-2',
      category: 'fertilizer',
      severity: 'low',
      advisoryText:
        'Avoid foliar nitrogen spray if evening showers exceed 40% probability; apply split urea basal dose only after soil moisture check.',
      evidenceSource: 'AgriVoice Pillar 3 Advisory Engine (Demo)',
      evidenceStrength: 'moderate',
      verificationStatus: 'demo',
      generatedAt: new Date().toISOString(),
    },
  ],
  lastUpdated: new Date().toISOString(),
};

export const DEMO_DAILY_FORECAST: WeatherForecastItem[] = Array.from({ length: 7 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() + i);
  return {
    validAt: date.toISOString(),
    temperatureMin: 22 + (i % 3),
    temperatureMax: 31 + (i % 2),
    humidity: 62 + (i * 3) % 20,
    rainfall: i === 2 ? 14.2 : i === 5 ? 6.0 : 0,
    rainfallProbability: i === 2 ? 75 : i === 5 ? 45 : 15,
    windSpeed: 10 + (i % 4),
    weatherDescription: i === 2 ? 'Light to moderate rain' : i === 5 ? 'Partly cloudy' : 'Clear to partly cloudy',
  };
});

export const DEMO_HOURLY_FORECAST: WeatherForecastItem[] = Array.from({ length: 12 }, (_, i) => {
  const date = new Date();
  date.setHours(date.getHours() + i * 4);
  return {
    validAt: date.toISOString(),
    temperature: 25 + ((i * 2) % 7),
    temperatureMin: 24,
    temperatureMax: 32,
    humidity: 60 + ((i * 4) % 25),
    rainfall: i === 4 ? 3.2 : 0,
    rainfallProbability: i === 4 ? 55 : 15,
    windSpeed: 9 + (i % 5),
    weatherDescription: i === 4 ? 'Scattered showers' : 'Partly cloudy',
  };
});

export const DEMO_WEATHER_ALERTS: WeatherAlertItem[] = [
  {
    id: 'alert-demo-1',
    alertType: 'heavy_rain',
    severity: 'moderate',
    headline: 'Moderate evening rainfall expected in Guntur mandals',
    description: 'Isolated showers (12-18 mm) forecast within 48 hours. Ensure field bund drainage channels remain clear.',
    recommendedAction: 'Postpone pesticide spraying until dry weather window resumes.',
    validFrom: new Date().toISOString(),
    validTo: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
  },
];

export const DEMO_ADVISORIES: WeatherAdvisoryItem[] = [
  ...DEMO_WEATHER_DASHBOARD.advisories,
  {
    id: 'adv-demo-3',
    category: 'crop_protection',
    severity: 'moderate',
    advisoryText:
      'High morning humidity favors leaf folder activity. Inspect 20 random hills per plot before selecting any control action.',
    evidenceSource: 'ICAR Rice IPM Reference (Demo)',
    evidenceStrength: 'high',
    verificationStatus: 'demo',
    generatedAt: new Date().toISOString(),
  },
];

export const DEMO_SOIL_REPORT: SoilReport = {
  id: 'f0000000-0000-0000-0000-000000000099',
  farmerId: DEMO_FARMER_ID,
  farmId: DEMO_FARM_ID,
  fieldId: DEMO_FIELD_ID,
  cardId: 'SHC-AP-1001',
  reportId: 'SHC-AP-1001',
  source: 'demo_shc_provider',
  sourceAuthority: 'Department of Agriculture (Synthetic Demo Sample)',
  sampleDate: '2026-04-12T05:00:00.000Z',
  testingDate: '2026-04-20T10:00:00.000Z',
  reportDate: '2026-04-25T08:30:00.000Z',
  state: 'Andhra Pradesh',
  district: 'Guntur',
  mandal: 'Tenali',
  village: 'Kollipara',
  soilType: 'black_cotton',
  ph: 7.5,
  ec: 0.4,
  organicCarbon: 0.55,
  nitrogen: 190,
  phosphorus: 25,
  potassium: 320,
  sulphur: 14.2,
  zinc: 0.6,
  iron: 5.8,
  copper: 1.1,
  manganese: 4.5,
  boron: null,
  nutrientRatings: {
    nitrogen: 'LOW',
    phosphorus: 'MEDIUM',
    potassium: 'HIGH',
    zinc: 'DEFICIENT',
  },
  recommendations: [
    {
      crop: 'Paddy / Rice',
      fertilizer: 'Urea',
      dosageKgPerAcre: 45,
      note: 'Apply in 3 splits (basal, tillering, panicle initiation)',
    },
    {
      crop: 'Paddy / Rice',
      fertilizer: 'Zinc Sulphate (21%)',
      dosageKgPerAcre: 10,
      note: 'Apply as basal dose',
    },
  ],
  status: 'demo',
  isDemo: 'true',
  createdAt: '2026-04-25T08:30:00.000Z',
  updatedAt: '2026-04-25T08:30:00.000Z',
};

export const DEMO_SOIL_DASHBOARD: SoilDashboardData = {
  hasReport: true,
  latestReport: DEMO_SOIL_REPORT,
  summary: {
    totalReports: 1,
    lastTestedDate: DEMO_SOIL_REPORT.testingDate ?? null,
    primarySoilType: 'black_cotton',
    overallStatus: 'demo',
    availableNutrientCount: 11,
    criticalDeficiencies: ['nitrogen', 'zinc'],
  },
  recentReports: [DEMO_SOIL_REPORT],
};

export const DEMO_INPUT_VERIFICATIONS: InputVerificationRecord[] = [
  {
    id: 'v0000000-0000-0000-0000-000000000001',
    farmerId: DEMO_FARMER_ID,
    productName: 'DemoBio Complex NPK 20-20-20',
    category: 'fertilizer',
    brand: 'DemoBio Complex (Synthetic Sample)',
    manufacturer: 'Demo Agrochemicals Lab Ltd (Fictional Entity)',
    batchNumber: 'DEMO-FERT-NPK-001',
    registrationNumber: 'DEMO-REG-FCO-2026-001',
    verificationStatus: 'demo',
    source: 'demo_input_provider',
    evidence: 'Synthetic test fixture matched in Demo Mode. Not an official regulatory determination.',
    notes: 'Demo mode output only.',
    isDemo: 'true',
    createdAt: new Date().toISOString(),
  },
];

export const DEMO_VOICE_SOIL_CONTEXT: VoiceSoilContext = {
  farmer: {
    farmerId: DEMO_FARMER_ID,
    fullName: 'Ramesh Kumar (Demo Farmer)',
    district: 'Guntur',
    state: 'Andhra Pradesh',
  },
  hasReport: true,
  reportId: DEMO_SOIL_REPORT.reportId,
  cardId: DEMO_SOIL_REPORT.cardId,
  reportDate: DEMO_SOIL_REPORT.reportDate,
  dataFreshnessDays: 14,
  sourceAuthority: DEMO_SOIL_REPORT.sourceAuthority,
  isDemo: true,
  status: 'demo',
  nutrients: {
    ph: 7.5,
    ec: 0.4,
    organicCarbonPercent: 0.55,
    nitrogenKgPerHa: 190,
    phosphorusKgPerHa: 25,
    potassiumKgPerHa: 320,
    zincPpm: 0.6,
    ironPpm: 5.8,
  },
  missingMeasurements: ['boron'],
  sourceRecommendations: DEMO_SOIL_REPORT.recommendations ?? [],
  aiGuidance: 'Demo Soil Health Card SHC-AP-1001 shows low Nitrogen (190 kg/ha) and deficient Zinc (0.6 ppm). Boron was not tested.',
};

export function createDemoVoiceVerification(
  productName: string,
  category: string,
  brand?: string,
  batchNumber?: string
): VoiceInputVerification {
  return {
    productName,
    category,
    brand: brand ?? null,
    batchNumber: batchNumber ?? null,
    status: 'demo',
    provider: 'demo_input_provider',
    isAuthentic: false,
    findingsSummary: `Demo preview check for ${productName} (${category}). Connect live backend regulatory providers for official FCO/CIBRC status.`,
    aiGuidance: 'Always verify the physical seal, batch expiry, and dealer license with your Mandal Agriculture Officer.',
  };
}
