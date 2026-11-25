import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import { resetClerkJwksCache } from '../../../src/modules/auth/routes.js';

function signTestRs256Jwt(
  payload: Record<string, unknown>,
  privateKey: crypto.KeyObject,
  kid = 'test-kid-1'
): string {
  const header = { alg: 'RS256', typ: 'JWT', kid };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8');
  const signature = crypto.sign('RSA-SHA256', signingInput, privateKey).toString('base64url');
  return `${headerB64}.${payloadB64}.${signature}`;
}

describe('Auth Bridge API (/auth)', () => {
  let app: FastifyInstance;
  let privateKey: crypto.KeyObject;
  let publicJwk: JsonWebKey;
  const originalSecretKey = process.env.CLERK_SECRET_KEY;

  beforeAll(async () => {
    const keyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    privateKey = keyPair.privateKey;
    publicJwk = {
      ...(keyPair.publicKey.export({ format: 'jwk' }) as JsonWebKey),
      kid: 'test-kid-1',
      alg: 'RS256',
      use: 'sig',
    };

    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    process.env.CLERK_SECRET_KEY = originalSecretKey;
    vi.restoreAllMocks();
    await app.close();
  });

  beforeEach(() => {
    resetClerkJwksCache();
    vi.restoreAllMocks();
    process.env.CLERK_SECRET_KEY = 'sk_test_mock_secret';
  });

  it('POST /auth/clerk/exchange → 401 when token is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/clerk/exchange',
      payload: {},
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error?.code).toBe('UNAUTHORIZED');
  });

  it('POST /auth/clerk/exchange → 401 for expired Clerk JWT', async () => {
    const expiredJwt = signTestRs256Jwt(
      { sub: 'user_123', exp: Math.floor(Date.now() / 1000) - 60 },
      privateKey
    );

    const res = await app.inject({
      method: 'POST',
      url: '/auth/clerk/exchange',
      headers: { authorization: `Bearer ${expiredJwt}` },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error?.code).toBe('INVALID_CLERK_TOKEN');
  });

  it('POST /auth/clerk/exchange → 403 FARMER_NOT_LINKED when Clerk user has no matching AgriVoice user', async () => {
    const validJwt = signTestRs256Jwt(
      { sub: 'user_unlinked', exp: Math.floor(Date.now() / 1000) + 300 },
      privateKey
    );

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/v1/jwks')) {
        return new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 });
      }
      if (url.includes('/v1/users/user_unlinked')) {
        return new Response(
          JSON.stringify({
            id: 'user_unlinked',
            phone_numbers: [],
            public_metadata: {},
          }),
          { status: 200 }
        );
      }
      return new Response('Not found', { status: 404 });
    });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/clerk/exchange',
      headers: { authorization: `Bearer ${validJwt}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error?.code).toBe('FARMER_NOT_LINKED');
  });

  it('POST /auth/clerk/exchange → 200 and issues AgriVoice JWT for verified linked user', async () => {
    const validJwt = signTestRs256Jwt(
      { sub: 'user_linked_1', exp: Math.floor(Date.now() / 1000) + 300 },
      privateKey
    );

    const mockUser = {
      id: 'u1000000-0000-0000-0000-000000000001',
      phone: '+919876543210',
      status: 'active',
      deletedAt: null,
    };
    const mockProfile = {
      id: 'f1000000-0000-0000-0000-000000000001',
      userId: mockUser.id,
      fullName: 'Ravi Kumar',
      preferredLanguage: 'te',
      state: 'Andhra Pradesh',
      district: 'Krishna',
      mandal: 'Vijayawada',
      village: 'Moghalrajpuram',
      pinCode: '520010',
      status: 'active',
    };
    const mockFarms = [
      { id: 'f2000000-0000-0000-0000-000000000001', farmName: 'Ravi Farm', totalAreaAcres: '5.00', ownershipType: 'owned' },
    ];
    const mockFields = [
      { id: 'f3000000-0000-0000-0000-000000000001', farmId: mockFarms[0].id, fieldName: 'North Field', areaAcres: '2.50', soilType: 'alluvial', irrigationSource: 'canal' },
    ];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/v1/jwks')) {
        return new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 });
      }
      if (url.includes('/v1/users/user_linked_1')) {
        return new Response(
          JSON.stringify({
            id: 'user_linked_1',
            primary_phone_number_id: 'ph_1',
            phone_numbers: [
              { id: 'ph_1', phone_number: '+919876543210', verification: { status: 'verified' } },
            ],
          }),
          { status: 200 }
        );
      }
      return new Response('Not found', { status: 404 });
    });

    const { db } = await import('../../../src/database/db.js');
    vi.spyOn(db, 'select')
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockProfile]),
          }),
        }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockFarms),
        }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockFields),
        }),
      } as any);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/clerk/exchange',
      headers: { authorization: `Bearer ${validJwt}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.data.token).toBe('string');
    const decoded = app.jwt.verify<{ id: string; phone: string }>(body.data.token);
    expect(decoded.id).toBe(mockUser.id);
    expect(decoded.phone).toBe(mockUser.phone);
    expect(body.data.farms).toHaveLength(1);
    expect(body.data.farms[0].fields).toHaveLength(1);
  });

  it('GET /auth/me → 401 without bearer token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /auth/me → 200 with authenticated farmer farms and fields', async () => {
    const token = app.jwt.sign({
      id: 'u1000000-0000-0000-0000-000000000001',
      phone: '+919876543210',
    });

    const mockUser = {
      id: 'u1000000-0000-0000-0000-000000000001',
      phone: '+919876543210',
      status: 'active',
      deletedAt: null,
    };
    const mockProfile = {
      id: 'f1000000-0000-0000-0000-000000000001',
      userId: mockUser.id,
      fullName: 'Ravi Kumar',
      preferredLanguage: 'te',
      state: 'Andhra Pradesh',
      district: 'Krishna',
      mandal: 'Vijayawada',
      village: 'Moghalrajpuram',
      pinCode: '520010',
      status: 'active',
    };
    const mockFarms = [
      { id: 'f2000000-0000-0000-0000-000000000001', farmName: 'Ravi Farm', totalAreaAcres: '5.00', ownershipType: 'owned' },
    ];

    const { db } = await import('../../../src/database/db.js');
    vi.spyOn(db, 'select')
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockProfile]),
          }),
        }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockFarms),
        }),
      } as any)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.farmerProfile.fullName).toBe('Ravi Kumar');
    expect(res.json().data.farms).toHaveLength(1);
  });
});
