import crypto from 'node:crypto';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { db } from '../../database/db.js';
import { users, farmerProfiles, buyerProfiles, farms, fields } from '../../database/schema/index.js';

interface JwkKey {
  kid?: string;
  kty: string;
  n?: string;
  e?: string;
  alg?: string;
  use?: string;
}

interface ClerkUserPayload {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  primary_phone_number_id?: string | null;
  phone_numbers?: Array<{
    id: string;
    phone_number: string;
    verification?: { status?: string } | null;
  }>;
  public_metadata?: {
    agrivoiceUserId?: string;
    phone?: string;
  };
}

let cachedJwks: { keys: JwkKey[]; fetchedAt: number } | null = null;
const JWKS_TTL_MS = 5 * 60 * 1000;

function decodeBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return Buffer.from(padded, 'base64');
}

function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('+')) {
    return '+' + trimmed.slice(1).replace(/\D/g, '');
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  return `+${digits}`;
}

async function fetchClerkJwks(secretKey: string, forceRefresh = false): Promise<JwkKey[]> {
  if (!forceRefresh && cachedJwks && Date.now() - cachedJwks.fetchedAt < JWKS_TTL_MS) {
    return cachedJwks.keys;
  }

  const res = await fetch('https://api.clerk.com/v1/jwks', {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Clerk JWKS request failed with HTTP ${res.status}`);
  }

  const data = (await res.json()) as { keys?: JwkKey[] };
  if (!Array.isArray(data.keys) || data.keys.length === 0) {
    throw new Error('Clerk JWKS response contained no keys');
  }

  cachedJwks = { keys: data.keys, fetchedAt: Date.now() };
  return data.keys;
}

export function resetClerkJwksCache() {
  cachedJwks = null;
}

async function verifyClerkSessionJwt(token: string, secretKey: string): Promise<{ sub: string }> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = JSON.parse(decodeBase64Url(headerB64).toString('utf8')) as {
    alg?: string;
    kid?: string;
    typ?: string;
  };
  const payload = JSON.parse(decodeBase64Url(payloadB64).toString('utf8')) as {
    sub?: string;
    exp?: number;
    nbf?: number;
  };

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Unsupported JWT algorithm or missing key ID');
  }

  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('JWT missing subject claim');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) {
    throw new Error('Clerk token expired');
  }
  if (typeof payload.nbf === 'number' && payload.nbf > nowSeconds + 60) {
    throw new Error('Clerk token not yet valid');
  }

  let keys = await fetchClerkJwks(secretKey, false);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    keys = await fetchClerkJwks(secretKey, true);
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) {
    throw new Error('Matching Clerk signing key not found');
  }

  const publicKey = crypto.createPublicKey({ key: jwk as any, format: 'jwk' });
  const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8');
  const signature = decodeBase64Url(signatureB64);

  const valid = crypto.verify('RSA-SHA256', signingInput, publicKey, signature);
  if (!valid) {
    throw new Error('Invalid Clerk JWT signature');
  }

  return { sub: payload.sub };
}

async function fetchUserContext(userId: string, role: string) {
  if (role === 'buyer') {
    const [buyer] = await db
      .select()
      .from(buyerProfiles)
      .where(eq(buyerProfiles.userId, userId))
      .limit(1);

    return {
      farmerProfile: null,
      buyerProfile: buyer || null,
      farms: [],
    };
  }

  const [profile] = await db
    .select()
    .from(farmerProfiles)
    .where(eq(farmerProfiles.userId, userId))
    .limit(1);

  if (!profile) {
    return { farmerProfile: null, buyerProfile: null, farms: [] };
  }

  const farmerFarms = await db
    .select({
      id: farms.id,
      farmName: farms.farmName,
      totalAreaAcres: farms.totalAreaAcres,
      ownershipType: farms.ownershipType,
    })
    .from(farms)
    .where(eq(farms.farmerId, profile.id));

  const farmIds = farmerFarms.map((f) => f.id);
  const farmerFields =
    farmIds.length > 0
      ? await db
          .select({
            id: fields.id,
            farmId: fields.farmId,
            fieldName: fields.fieldName,
            areaAcres: fields.areaAcres,
            soilType: fields.soilType,
            irrigationSource: fields.irrigationSource,
          })
          .from(fields)
          .where(inArray(fields.farmId, farmIds))
      : [];

  const fieldsByFarm = new Map<string, typeof farmerFields>();
  for (const field of farmerFields) {
    const existing = fieldsByFarm.get(field.farmId) || [];
    existing.push(field);
    fieldsByFarm.set(field.farmId, existing);
  }

  return {
    farmerProfile: {
      id: profile.id,
      userId: profile.userId,
      fullName: profile.fullName,
      preferredLanguage: profile.preferredLanguage,
      state: profile.state,
      district: profile.district,
      mandal: profile.mandal,
      village: profile.village,
      pinCode: profile.pinCode,
      status: profile.status,
    },
    buyerProfile: null,
    farms: farmerFarms.map((farm) => ({
      ...farm,
      fields: fieldsByFarm.get(farm.id) || [],
    })),
  };
}

export const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * POST /auth/clerk/exchange
   * Verifies a Clerk session JWT and issues an AgriVoice backend JWT
   * only when the Clerk identity maps to a verified, active AgriVoice user.
   */
  fastify.post<{ Body?: { token?: string } }>(
    '/clerk/exchange',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Exchange Clerk JWT for AgriVoice backend JWT',
      },
    },
    async (request, reply) => {
      const secretKey = process.env.CLERK_SECRET_KEY;
      if (!secretKey) {
        return reply.status(503).send({
          error: {
            code: 'AUTH_PROVIDER_UNCONFIGURED',
            message: 'Clerk server verification is not configured on the backend.',
          },
        });
      }

      const authHeader = request.headers.authorization;
      const bearerToken =
        authHeader && authHeader.startsWith('Bearer ')
          ? authHeader.slice('Bearer '.length).trim()
          : undefined;
      const clerkToken = bearerToken || request.body?.token;

      if (!clerkToken) {
        return reply.status(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing Clerk bearer token.',
          },
        });
      }

      let sub: string;
      try {
        const verified = await verifyClerkSessionJwt(clerkToken, secretKey);
        sub = verified.sub;
      } catch (err) {
        return reply.status(401).send({
          error: {
            code: 'INVALID_CLERK_TOKEN',
            message: err instanceof Error ? err.message : 'Invalid Clerk token',
          },
        });
      }

      // Fetch verified Clerk user metadata using CLERK_SECRET_KEY
      let clerkUser: ClerkUserPayload;
      try {
        const userRes = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(sub)}`, {
          headers: {
            Authorization: `Bearer ${secretKey}`,
            Accept: 'application/json',
          },
        });

        if (!userRes.ok) {
          return reply.status(401).send({
            error: {
              code: 'CLERK_USER_LOOKUP_FAILED',
              message: `Could not verify Clerk user (${userRes.status}).`,
            },
          });
        }
        clerkUser = (await userRes.json()) as ClerkUserPayload;
      } catch (err) {
        return reply.status(503).send({
          error: {
            code: 'CLERK_UNREACHABLE',
            message: 'Unable to reach Clerk user verification service.',
          },
        });
      }

      // Resolve AgriVoice user ONLY via Clerk-verified phone number or server-trusted public_metadata
      const verifiedPhones = (clerkUser.phone_numbers || []).filter(
        (p) => p.verification?.status === 'verified'
      );
      const primaryPhone =
        verifiedPhones.find((p) => p.id === clerkUser.primary_phone_number_id) || verifiedPhones[0];

      const metadataUserId = clerkUser.public_metadata?.agrivoiceUserId;
      const metadataPhone = clerkUser.public_metadata?.phone;
      const candidatePhone = primaryPhone?.phone_number || metadataPhone;

      let matchedUser: typeof users.$inferSelect | undefined;

      if (metadataUserId && /^[0-9a-f-]{36}$/i.test(metadataUserId)) {
        const [byId] = await db
          .select()
          .from(users)
          .where(and(eq(users.id, metadataUserId), isNull(users.deletedAt)))
          .limit(1);
        matchedUser = byId;
      }

      if (!matchedUser && candidatePhone) {
        const normalized = normalizePhone(candidatePhone);
        const [byPhone] = await db
          .select()
          .from(users)
          .where(and(eq(users.phone, normalized), isNull(users.deletedAt)))
          .limit(1);
        matchedUser = byPhone;
      }

      if (!matchedUser) {
        return reply.status(403).send({
          error: {
            code: 'FARMER_NOT_LINKED',
            message:
              'Your Clerk account is authenticated, but it is not linked to a registered AgriVoice farmer phone number.',
          },
        });
      }

      if (matchedUser.status !== 'active') {
        return reply.status(403).send({
          error: {
            code: 'USER_INACTIVE',
            message: `AgriVoice account status is "${matchedUser.status}".`,
          },
        });
      }

      const token = fastify.jwt.sign({
        id: matchedUser.id,
        phone: matchedUser.phone,
        role: matchedUser.role,
      });

      const context = await fetchUserContext(matchedUser.id, matchedUser.role);

      return {
        data: {
          token,
          user: {
            id: matchedUser.id,
            phone: matchedUser.phone,
            role: matchedUser.role,
            status: matchedUser.status,
          },
          farmerProfile: context.farmerProfile,
          buyerProfile: context.buyerProfile,
          farms: context.farms,
        },
      };
    }
  );

  /**
   * GET /auth/me
   * Returns the authenticated user's profile and owned farms/fields.
   */
  fastify.get(
    '/me',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Get authenticated farmer context and owned farms/fields',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch {
        return reply.status(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }

      const jwtUser = request.user as { id?: string; phone?: string };
      if (!jwtUser?.id) {
        return reply.status(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid authentication token payload',
          },
        });
      }

      const [user] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, jwtUser.id), isNull(users.deletedAt)))
        .limit(1);

      if (!user) {
        return reply.status(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authenticated user no longer exists',
          },
        });
      }

      const context = await fetchUserContext(user.id, user.role);

      return {
        data: {
          user: {
            id: user.id,
            phone: user.phone,
            role: user.role,
            status: user.status,
          },
          farmerProfile: context.farmerProfile,
          buyerProfile: context.buyerProfile,
          farms: context.farms,
        },
      };
    }
  );

  /**
   * POST /auth/clerk/onboard
   * Verifies a Clerk session JWT and creates/links an AgriVoice user + farmer_profile + optional initial farm
   * inside a single database transaction.
   */
  fastify.post<{
    Body: {
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
    };
  }>(
    '/clerk/onboard',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Onboard a verified Clerk user into AgriVoice as Farmer or Buyer',
        body: Type.Object({
          role: Type.Optional(Type.Union([Type.Literal('farmer'), Type.Literal('buyer')])),
          fullName: Type.Optional(Type.String({ minLength: 2, maxLength: 128 })),
          phone: Type.String({ minLength: 10, maxLength: 16 }),
          preferredLanguage: Type.Optional(Type.String({ minLength: 2, maxLength: 16 })),
          state: Type.String({ minLength: 2, maxLength: 64 }),
          district: Type.String({ minLength: 2, maxLength: 64 }),
          mandal: Type.Optional(Type.String({ minLength: 2, maxLength: 64 })),
          village: Type.Optional(Type.String({ minLength: 2, maxLength: 64 })),
          pinCode: Type.String({ minLength: 4, maxLength: 10 }),
          farmName: Type.Optional(Type.String({ minLength: 2, maxLength: 128 })),
          totalAreaAcres: Type.Optional(Type.Number({ minimum: 0.1, maximum: 10000 })),
          businessName: Type.Optional(Type.String({ minLength: 2, maxLength: 160 })),
          contactName: Type.Optional(Type.String({ minLength: 2, maxLength: 128 })),
          businessType: Type.Optional(Type.String({ minLength: 2, maxLength: 64 })),
          city: Type.Optional(Type.String({ minLength: 2, maxLength: 64 })),
          gstOrLicenseNumber: Type.Optional(Type.String({ maxLength: 64 })),
        }),
      },
    },
    async (request, reply) => {
      const secretKey = process.env.CLERK_SECRET_KEY;
      if (!secretKey) {
        return reply.status(503).send({
          error: {
            code: 'AUTH_PROVIDER_UNCONFIGURED',
            message: 'Clerk server verification is not configured on the backend.',
          },
        });
      }

      const authHeader = request.headers.authorization;
      const clerkToken =
        authHeader && authHeader.startsWith('Bearer ')
          ? authHeader.slice('Bearer '.length).trim()
          : undefined;

      if (!clerkToken) {
        return reply.status(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing Clerk bearer token.',
          },
        });
      }

      let clerkSub: string;
      try {
        const verified = await verifyClerkSessionJwt(clerkToken, secretKey);
        clerkSub = verified.sub;
      } catch (err) {
        return reply.status(401).send({
          error: {
            code: 'INVALID_CLERK_TOKEN',
            message: err instanceof Error ? err.message : 'Invalid Clerk token',
          },
        });
      }

      const targetRole = request.body.role || 'farmer';
      if (targetRole === 'farmer' && (!request.body.fullName || !request.body.mandal || !request.body.village)) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Farmer onboarding requires fullName, mandal, and village.',
          },
        });
      }
      if (targetRole === 'buyer' && (!request.body.businessName || !request.body.contactName || !request.body.city)) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Buyer onboarding requires businessName, contactName, and city.',
          },
        });
      }

      const normalizedPhone = normalizePhone(request.body.phone);
      if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_PHONE',
            message: 'Please provide a valid phone number.',
          },
        });
      }

      const [existingUser] = await db
        .select()
        .from(users)
        .where(and(eq(users.phone, normalizedPhone), isNull(users.deletedAt)))
        .limit(1);

      if (existingUser && existingUser.role !== targetRole) {
        return reply.status(409).send({
          error: {
            code: 'ROLE_CONFLICT',
            message: `This phone number is already registered as a ${existingUser.role}. Please use a separate account for ${targetRole} access.`,
          },
        });
      }

      const result = await db.transaction(async (tx) => {
        let user = existingUser;
        if (!user) {
          [user] = await tx
            .insert(users)
            .values({
              phone: normalizedPhone,
              role: targetRole,
              status: 'active',
            })
            .returning();
        }

        if (targetRole === 'buyer') {
          const [existingBuyer] = await tx
            .select()
            .from(buyerProfiles)
            .where(eq(buyerProfiles.userId, user.id))
            .limit(1);

          if (!existingBuyer) {
            await tx.insert(buyerProfiles).values({
              userId: user.id,
              businessName: request.body.businessName!.trim(),
              contactName: request.body.contactName!.trim(),
              businessType: request.body.businessType?.trim() || 'wholesaler',
              state: request.body.state.trim(),
              district: request.body.district.trim(),
              city: request.body.city!.trim(),
              pinCode: request.body.pinCode.trim(),
              gstOrLicenseNumber: request.body.gstOrLicenseNumber?.trim() || null,
              verificationStatus: 'self_declared',
              status: 'active',
            });
          }
          return user;
        }

        let [profile] = await tx
          .select()
          .from(farmerProfiles)
          .where(eq(farmerProfiles.userId, user.id))
          .limit(1);

        if (!profile) {
          [profile] = await tx
            .insert(farmerProfiles)
            .values({
              userId: user.id,
              fullName: request.body.fullName!.trim(),
              preferredLanguage: request.body.preferredLanguage?.trim() || 'en',
              state: request.body.state.trim(),
              district: request.body.district.trim(),
              mandal: request.body.mandal!.trim(),
              village: request.body.village!.trim(),
              pinCode: request.body.pinCode.trim(),
              status: 'active',
            })
            .returning();
        }

        if (request.body.farmName?.trim()) {
          const existingFarms = await tx
            .select()
            .from(farms)
            .where(eq(farms.farmerId, profile.id))
            .limit(1);

          if (existingFarms.length === 0) {
            await tx.insert(farms).values({
              farmerId: profile.id,
              farmName: request.body.farmName.trim(),
              totalAreaAcres: (request.body.totalAreaAcres ?? 2.5).toString(),
              ownershipType: 'owned',
            });
          }
        }

        return user;
      });

      // Best-effort sync of agrivoiceUserId to Clerk public_metadata so future /clerk/exchange calls link automatically
      try {
        await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(clerkSub)}/metadata`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            public_metadata: {
              agrivoiceUserId: result.id,
              phone: result.phone,
              role: result.role,
            },
          }),
        });
      } catch {
        // Non-fatal: onboarding succeeded in AgriVoice DB
      }

      const token = fastify.jwt.sign({
        id: result.id,
        phone: result.phone,
        role: result.role,
      });

      const context = await fetchUserContext(result.id, result.role);

      reply.status(201);
      return {
        data: {
          token,
          user: {
            id: result.id,
            phone: result.phone,
            role: result.role,
            status: result.status,
          },
          farmerProfile: context.farmerProfile,
          buyerProfile: context.buyerProfile,
          farms: context.farms,
        },
      };
    }
  );
};
