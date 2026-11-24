import { Type, Static } from '@sinclair/typebox';

// ==============================================================================
// Soil Report Status & Category Types
// ==============================================================================

export const SoilReportStatus = Type.Union([
  Type.Literal('available'),
  Type.Literal('pending'),
  Type.Literal('partial'),
  Type.Literal('not_found'),
  Type.Literal('failed'),
  Type.Literal('provider_unavailable'),
  Type.Literal('demo'),
]);
export type SoilReportStatusType = Static<typeof SoilReportStatus>;

export const InputVerificationStatus = Type.Union([
  Type.Literal('verified'),
  Type.Literal('not_verified'),
  Type.Literal('inconclusive'),
  Type.Literal('not_found'),
  Type.Literal('expired'),
  Type.Literal('recall_alert'),
  Type.Literal('provider_unavailable'),
  Type.Literal('demo'),
]);
export type InputVerificationStatusType = Static<typeof InputVerificationStatus>;

export const InputCategory = Type.Union([
  Type.Literal('fertilizer'),
  Type.Literal('seed'),
  Type.Literal('pesticide'),
  Type.Literal('bio_stimulant'),
  Type.Literal('other'),
]);
export type InputCategoryType = Static<typeof InputCategory>;

// ==============================================================================
// Web API Contracts
// ==============================================================================

/**
 * Full Canonical Soil Report Schema
 */
export const SoilReportResponseSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  farmerId: Type.String({ format: 'uuid' }),
  farmId: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  fieldId: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  cardId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  reportId: Type.String(),
  source: Type.String(),
  sourceAuthority: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  sampleDate: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  testingDate: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  reportDate: Type.String(),
  state: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  district: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  mandal: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  village: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  soilType: Type.Optional(Type.Union([Type.String(), Type.Null()])),

  // Nutrient Measurements (nullable, units preserved)
  ph: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  ec: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  organicCarbon: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  nitrogen: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  phosphorus: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  potassium: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  sulphur: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  zinc: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  iron: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  copper: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  manganese: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  boron: Type.Optional(Type.Union([Type.Number(), Type.Null()])),

  // Source-provided Ratings and Recommendations
  nutrientRatings: Type.Optional(Type.Any()),
  recommendations: Type.Optional(Type.Any()),

  status: SoilReportStatus,
  isDemo: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});
export type SoilReportResponse = Static<typeof SoilReportResponseSchema>;

/**
 * Soil Health Card Lookup Request
 */
export const SoilLookupRequestSchema = Type.Object({
  cardId: Type.String({ minLength: 3, maxLength: 64 }),
  farmId: Type.Optional(Type.String({ format: 'uuid' })),
  fieldId: Type.Optional(Type.String({ format: 'uuid' })),
  providerMode: Type.Optional(Type.Union([Type.Literal('auto'), Type.Literal('government'), Type.Literal('demo')])),
});
export type SoilLookupRequest = Static<typeof SoilLookupRequestSchema>;

/**
 * Soil Report List Query
 */
export const SoilReportListQuerySchema = Type.Object({
  farmId: Type.Optional(Type.String({ format: 'uuid' })),
  fieldId: Type.Optional(Type.String({ format: 'uuid' })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  offset: Type.Optional(Type.Integer({ minimum: 0 })),
});
export type SoilReportListQuery = Static<typeof SoilReportListQuerySchema>;

/**
 * Soil Health Dashboard Response
 */
export const SoilDashboardResponseSchema = Type.Object({
  hasReport: Type.Boolean(),
  latestReport: Type.Optional(Type.Union([SoilReportResponseSchema, Type.Null()])),
  summary: Type.Object({
    totalReports: Type.Integer(),
    lastTestedDate: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    primarySoilType: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    overallStatus: Type.String(),
    availableNutrientCount: Type.Integer(),
    criticalDeficiencies: Type.Array(Type.String()),
  }),
  recentReports: Type.Array(SoilReportResponseSchema),
});
export type SoilDashboardResponse = Static<typeof SoilDashboardResponseSchema>;

/**
 * Input Verification Request
 */
export const InputVerificationRequestSchema = Type.Object({
  productName: Type.String({ minLength: 1, maxLength: 256 }),
  category: InputCategory,
  brand: Type.Optional(Type.String({ maxLength: 128 })),
  manufacturer: Type.Optional(Type.String({ maxLength: 128 })),
  batchNumber: Type.Optional(Type.String({ maxLength: 128 })),
  registrationNumber: Type.Optional(Type.String({ maxLength: 128 })),
  providerMode: Type.Optional(Type.Union([Type.Literal('auto'), Type.Literal('official'), Type.Literal('demo')])),
});
export type InputVerificationRequest = Static<typeof InputVerificationRequestSchema>;

/**
 * Input Verification Response
 */
export const InputVerificationResponseSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  farmerId: Type.String({ format: 'uuid' }),
  productName: Type.String(),
  category: Type.String(),
  brand: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  manufacturer: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  batchNumber: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  registrationNumber: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  verificationStatus: InputVerificationStatus,
  provider: Type.String(),
  evidence: Type.Optional(Type.Any()),
  notes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  createdAt: Type.String(),
});
export type InputVerificationResponse = Static<typeof InputVerificationResponseSchema>;

/**
 * Input Verification List Query
 */
export const InputVerificationListQuerySchema = Type.Object({
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  offset: Type.Optional(Type.Integer({ minimum: 0 })),
});
export type InputVerificationListQuery = Static<typeof InputVerificationListQuerySchema>;

// ==============================================================================
// Voice AI Tool Contracts (Dedicated Structured Payloads)
// ==============================================================================

/**
 * Voice AI: Soil Context Payload
 */
export const VoiceSoilContextSchema = Type.Object({
  farmer: Type.Object({
    farmerId: Type.String({ format: 'uuid' }),
    fullName: Type.String(),
    district: Type.String(),
    state: Type.String(),
  }),
  hasReport: Type.Boolean(),
  reportId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  cardId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  reportDate: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  dataFreshnessDays: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
  sourceAuthority: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  isDemo: Type.Boolean(),
  status: SoilReportStatus,
  nutrients: Type.Object({
    ph: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    ec: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    organicCarbonPercent: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    nitrogenKgPerHa: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    phosphorusKgPerHa: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    potassiumKgPerHa: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    zincPpm: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    ironPpm: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  }),
  missingMeasurements: Type.Array(Type.String()),
  sourceRecommendations: Type.Array(Type.Any()),
  aiGuidance: Type.String(),
});
export type VoiceSoilContext = Static<typeof VoiceSoilContextSchema>;

/**
 * Voice AI: Input Verification Context Payload
 */
export const VoiceInputVerificationSchema = Type.Object({
  productName: Type.String(),
  category: Type.String(),
  brand: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  batchNumber: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  status: InputVerificationStatus,
  provider: Type.String(),
  isAuthentic: Type.Boolean(),
  findingsSummary: Type.String(),
  aiGuidance: Type.String(),
});
export type VoiceInputVerification = Static<typeof VoiceInputVerificationSchema>;
