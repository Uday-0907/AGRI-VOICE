import { apiRequest } from './apiClient';
import { exchangeClerkToken, getAuthMe } from './weatherApi';
import type { AuthSession, FarmSummary } from '../types/api';
import type { AuthContextData, FarmerFarm } from '../types/weather';

const E164_REGEX = /^\+[1-9][0-9]{7,14}$/;

export function normalizeIndianPhone(input: string): string {
  const cleaned = input.replace(/[\s()-]/g, '');
  if (/^[6-9][0-9]{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }
  return cleaned;
}

export function isValidE164Phone(phone: string): boolean {
  return E164_REGEX.test(phone);
}

function mapFarmsToSummary(farms: FarmerFarm[]): FarmSummary[] {
  return farms.map((farm) => ({
    id: farm.id,
    farmName: farm.farmName,
    fieldId: farm.fields[0]?.id,
    fieldName: farm.fields[0]?.fieldName,
    totalAreaAcres: farm.totalAreaAcres ? Number(farm.totalAreaAcres) : undefined,
    fields: farm.fields,
  }));
}

export function buildLiveAuthSession(token: string, context: AuthContextData): AuthSession {
  const mappedFarms = mapFarmsToSummary(context.farms);
  const role = context.user.role || (context.buyerProfile ? 'buyer' : 'farmer');

  return {
    mode: 'live',
    role,
    token: token.trim(),
    user: {
      id: context.user.id,
      phone: context.user.phone,
      role,
    },
    farmerProfile: context.farmerProfile
      ? {
          id: context.farmerProfile.id,
          userId: context.farmerProfile.userId,
          fullName: context.farmerProfile.fullName,
          preferredLanguage: context.farmerProfile.preferredLanguage,
          state: context.farmerProfile.state,
          district: context.farmerProfile.district,
          mandal: context.farmerProfile.mandal,
          village: context.farmerProfile.village,
          pinCode: context.farmerProfile.pinCode,
        }
      : null,
    buyerProfile: context.buyerProfile ?? null,
    farms: mappedFarms,
    selectedFarmId: mappedFarms[0]?.id ?? '',
  };
}

/**
 * Exchanges a verified Clerk session JWT for an AgriVoice backend JWT
 * and returns a live AuthSession populated strictly from the backend DB.
 */
export async function authenticateWithClerkToken(clerkToken: string): Promise<AuthSession> {
  const exchanged = await exchangeClerkToken(clerkToken);
  return buildLiveAuthSession(exchanged.token, exchanged);
}

/**
 * Validates a backend-issued JWT against GET /auth/me on the live server.
 * Rejects unverified/invalid/expired tokens instead of decoding them locally.
 */
export async function authenticateWithBackendToken(token: string): Promise<AuthSession> {
  const trimmed = token.trim();
  const context = await getAuthMe(trimmed);
  return buildLiveAuthSession(trimmed, context);
}

export async function onboardClerkFarmer(
  clerkToken: string,
  payload: {
    role?: 'farmer' | 'buyer';
    fullName?: string;
    phone: string;
    preferredLanguage?: string;
    state: string;
    district: string;
    mandal?: string;
    village?: string;
    pinCode: string;
    farmName?: string;
    totalAreaAcres?: number;
    businessName?: string;
    contactName?: string;
    businessType?: string;
    city?: string;
    gstOrLicenseNumber?: string;
  }
): Promise<AuthSession> {
  const res = await apiRequest<{
    data: AuthContextData & { token: string };
  }>('/auth/clerk/onboard', {
    method: 'POST',
    token: clerkToken,
    body: JSON.stringify(payload),
  });
  return buildLiveAuthSession(res.data.token, res.data);
}

export async function checkBackendHealth(): Promise<{ status: string; timestamp: string }> {
  return apiRequest<{ status: string; timestamp: string }>('/health');
}
