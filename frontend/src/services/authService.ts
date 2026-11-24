import { apiRequest } from './apiClient';
import { createDemoSession } from './demoData';
import type { AuthSession } from '../types/api';

const E164_REGEX = /^\+[1-9][0-9]{7,14}$/;
const OTP_REGEX = /^[0-9]{6}$/;

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

export function isValidOtp(otp: string): boolean {
  return OTP_REGEX.test(otp.trim());
}

export interface RequestOtpResponse {
  data?: {
    message?: string;
    expiresInSeconds?: number;
  };
  message?: string;
}

export interface VerifyOtpResponse {
  data?: {
    token: string;
    user: { id: string; phone: string };
    farmerProfile?: AuthSession['farmerProfile'];
    farms?: AuthSession['farms'];
  };
  token?: string;
}

export async function requestOtp(phone: string): Promise<RequestOtpResponse> {
  return apiRequest<RequestOtpResponse>('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function verifyOtp(phone: string, otp: string): Promise<AuthSession> {
  const response = await apiRequest<VerifyOtpResponse>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otp }),
  });

  const payload = response.data ?? (response as unknown as VerifyOtpResponse['data']);
  if (!payload?.token) {
    throw new Error('Authentication response did not contain a session token.');
  }

  const demoFallback = createDemoSession(payload.user?.phone ?? phone);

  return {
    mode: 'live',
    token: payload.token,
    user: payload.user ?? { id: 'authenticated-user', phone },
    farmerProfile: payload.farmerProfile ?? {
      ...demoFallback.farmerProfile,
      fullName: `Farmer (${phone})`,
    },
    farms: payload.farms && payload.farms.length > 0 ? payload.farms : demoFallback.farms,
    selectedFarmId:
      payload.farms && payload.farms.length > 0
        ? payload.farms[0].id
        : demoFallback.selectedFarmId,
  };
}

export function decodeJwtPayload(token: string): { id?: string; phone?: string } | null {
  try {
    const parts = token.trim().split('.');
    if (parts.length < 2) {
      return null;
    }
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join('')
    );
    return JSON.parse(json) as { id?: string; phone?: string };
  } catch {
    return null;
  }
}

export function createJwtLiveSession(token: string): AuthSession {
  const claims = decodeJwtPayload(token);
  const phone = claims?.phone ?? '+919876543201';
  const userId = claims?.id ?? 'jwt-user';
  const fallback = createDemoSession(phone);

  return {
    mode: 'live',
    token: token.trim(),
    user: { id: userId, phone },
    farmerProfile: {
      ...fallback.farmerProfile,
      userId,
      fullName: `Authenticated Farmer (${phone})`,
    },
    farms: fallback.farms,
    selectedFarmId: fallback.selectedFarmId,
  };
}
