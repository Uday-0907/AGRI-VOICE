import { db } from '../../../database/db.js';
import { inputVerifications } from '../../../database/schema/index.js';
import { eq, and, desc, count } from 'drizzle-orm';
import { IInputVerificationProvider } from '../providers/input-verification-provider.interface.js';
import { NationalInputRegistryProvider } from '../providers/national-input.provider.js';
import { MockInputVerificationProvider } from '../providers/mock-input.provider.js';
import {
  InputVerificationRequest,
  InputVerificationResponse,
  InputVerificationListQuery
} from '../contracts.js';
import { NotFoundError } from '../../../common/errors/index.js';

export class InputVerificationService {
  private nationalProvider: IInputVerificationProvider;
  private mockProvider: IInputVerificationProvider;

  constructor(
    nationalProvider?: IInputVerificationProvider,
    mockProvider?: IInputVerificationProvider
  ) {
    this.nationalProvider = nationalProvider || new NationalInputRegistryProvider();
    this.mockProvider = mockProvider || new MockInputVerificationProvider();
  }

  private getProvider(mode?: 'auto' | 'official' | 'demo'): IInputVerificationProvider {
    if (mode === 'demo') {
      return this.mockProvider;
    }
    if (mode === 'official') {
      return this.nationalProvider;
    }
    // Auto: default to official unless unconfigured in dev/test
    const hasKey = process.env.INPUT_REGISTRY_API_KEY && process.env.INPUT_REGISTRY_BASE_URL;
    if (!hasKey && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')) {
      return this.mockProvider;
    }
    return this.nationalProvider;
  }

  private formatResponse(row: typeof inputVerifications.$inferSelect): InputVerificationResponse {
    return {
      id: row.id,
      farmerId: row.farmerId,
      productName: row.productName,
      category: row.category,
      brand: row.brand || undefined,
      manufacturer: row.manufacturer || undefined,
      batchNumber: row.batchNumber || undefined,
      registrationNumber: row.registrationNumber || undefined,
      verificationStatus: row.verificationStatus as any,
      provider: row.provider,
      evidence: row.evidence || undefined,
      notes: row.notes || undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Submits an agricultural product for authenticity/licence verification and records history.
   */
  async verifyAndSave(
    farmerId: string,
    req: InputVerificationRequest
  ): Promise<InputVerificationResponse> {
    const provider = this.getProvider(req.providerMode);

    const result = await provider.verifyInput({
      productName: req.productName,
      category: req.category,
      brand: req.brand,
      manufacturer: req.manufacturer,
      batchNumber: req.batchNumber,
      registrationNumber: req.registrationNumber,
    });

    const [inserted] = await db
      .insert(inputVerifications)
      .values({
        farmerId,
        productName: req.productName,
        category: req.category,
        brand: result.brand || req.brand || null,
        manufacturer: result.manufacturer || req.manufacturer || null,
        batchNumber: req.batchNumber || null,
        registrationNumber: result.registrationNumber || req.registrationNumber || null,
        verificationStatus: result.verificationStatus,
        provider: result.provider,
        evidence: result.evidence || null,
        notes: result.notes || null,
      })
      .returning();

    return this.formatResponse(inserted);
  }

  /**
   * Lists input verification history for the authenticated farmer.
   */
  async listVerifications(
    farmerId: string,
    query: InputVerificationListQuery
  ): Promise<{ data: InputVerificationResponse[]; total: number; limit: number; offset: number }> {
    const limit = query.limit || 20;
    const offset = query.offset || 0;

    const rows = await db
      .select()
      .from(inputVerifications)
      .where(eq(inputVerifications.farmerId, farmerId))
      .orderBy(desc(inputVerifications.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalRow] = await db
      .select({ val: count() })
      .from(inputVerifications)
      .where(eq(inputVerifications.farmerId, farmerId));

    return {
      data: rows.map((r) => this.formatResponse(r)),
      total: totalRow ? Number(totalRow.val) : 0,
      limit,
      offset,
    };
  }

  /**
   * Retrieves single input verification detail with ownership enforcement.
   */
  async getVerificationById(
    farmerId: string,
    verificationId: string
  ): Promise<InputVerificationResponse> {
    const [row] = await db
      .select()
      .from(inputVerifications)
      .where(and(eq(inputVerifications.id, verificationId), eq(inputVerifications.farmerId, farmerId)))
      .limit(1);

    if (!row) {
      throw new NotFoundError(`Input verification record ${verificationId} not found or access denied.`);
    }

    return this.formatResponse(row);
  }
}
