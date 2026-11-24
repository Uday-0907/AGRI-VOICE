import { SoilVoiceService } from './services/soil-voice.service.js';
import { InputCategoryType } from './contracts.js';
import { VoiceTool, VoiceSessionContext } from '../voice/dispatcher.js';

export type VoiceToolDefinition = VoiceTool;

/**
 * Pillar 6 Voice AI Tools Registry.
 * Exposes authoritative, server-side validated tools for the phone-call Voice AI pipeline.
 * Invariant: All tools require verified caller session context (`session.userId`).
 */
export function createSoilVoiceTools(
  voiceService: SoilVoiceService = new SoilVoiceService()
): VoiceTool[] {
  return [
    {
      name: 'get_farmer_soil_health_context',
      description:
        'Retrieves verified soil test measurements (pH, EC, organic carbon, NPK, micronutrients), data freshness in days, and official source recommendations for the authenticated caller. Never invent readings for nutrients listed in missingMeasurements.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      execute: async (session: VoiceSessionContext) => {
        if (!session?.userId) {
          throw new Error('UNAUTHORIZED_CALLER_SESSION: Caller session identity is not verified.');
        }
        return await voiceService.getVoiceSoilContext(session.userId);
      },
    },
    {
      name: 'verify_agricultural_input_product',
      description:
        'Verifies an agricultural seed, fertilizer, or pesticide batch against regulatory gazette registries. Returns authentic registration status, expiry, or official vigilance alerts.',
      parameters: {
        type: 'object',
        properties: {
          productName: {
            type: 'string',
            description: 'Name of the fertilizer, seed, or chemical product.',
          },
          category: {
            type: 'string',
            enum: ['fertilizer', 'seed', 'pesticide', 'bio_stimulant', 'other'],
            description: 'Category of the agricultural input.',
          },
          brand: {
            type: 'string',
            description: 'Brand or manufacturer name printed on the packaging.',
          },
          batchNumber: {
            type: 'string',
            description: 'Lot or batch number printed on the bag/container.',
          },
        },
        required: ['productName', 'category'],
      },
      execute: async (session: VoiceSessionContext, args: any) => {
        if (!session?.userId) {
          throw new Error('UNAUTHORIZED_CALLER_SESSION: Caller session identity is not verified.');
        }
        return await voiceService.verifyInputForVoice(session.userId, {
          productName: args.productName,
          category: args.category as InputCategoryType,
          brand: args.brand,
          batchNumber: args.batchNumber,
        });
      },
    },
  ];
}
