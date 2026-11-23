import { Type } from '@sinclair/typebox';

// --- Identity ---
export const UserRegistrationSchema = Type.Object({
  phone: Type.String({ pattern: '^\\+[1-9][0-9]{7,14}$' }), // E.164 normalized
});

export const OtpVerificationSchema = Type.Object({
  phone: Type.String({ pattern: '^\\+[1-9][0-9]{7,14}$' }),
  otp: Type.String({ pattern: '^[0-9]{6}$' }),
});

// --- Foundational Entities (Core Farmer Context) ---
export const FarmerProfileSchema = Type.Object({
  fullName: Type.String({ minLength: 1 }),
  preferredLanguage: Type.String(),
  state: Type.String(),
  district: Type.String(),
  mandal: Type.String(),
  village: Type.String(),
  pinCode: Type.String({ pattern: '^[1-9][0-9]{5}$' }),
});

export const FarmSchema = Type.Object({
  farmName: Type.String({ minLength: 1 }),
  totalAreaAcres: Type.Optional(Type.Number()),
  ownershipType: Type.Union([Type.Literal('owned'), Type.Literal('leased'), Type.Literal('shared')]),
});

export const FieldSchema = Type.Object({
  fieldName: Type.String({ minLength: 1 }),
  areaAcres: Type.Optional(Type.Number()),
  soilType: Type.Optional(Type.String()),
  irrigationSource: Type.Optional(Type.String()),
});

export const CropSeasonSchema = Type.Object({
  fieldId: Type.String({ format: 'uuid' }),
  cropId: Type.String({ format: 'uuid' }),
  season: Type.Union([Type.Literal('kharif'), Type.Literal('rabi'), Type.Literal('zaid')]),
  sowingDate: Type.Optional(Type.String({ format: 'date' })),
  expectedHarvestDate: Type.Optional(Type.String({ format: 'date' })),
  areaPlantedAcres: Type.Optional(Type.Number()),
});

// --- Common ---
export const PaginationSchema = Type.Object({
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  offset: Type.Optional(Type.Integer({ minimum: 0 })),
});
