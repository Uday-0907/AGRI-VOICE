import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSoilVoiceTools } from '../../../src/modules/soil/voice-tools.js';
import { SoilVoiceService } from '../../../src/modules/soil/services/soil-voice.service.js';
import { VoiceDispatcher, VoiceSessionContext } from '../../../src/modules/voice/dispatcher.js';

describe('Pillar 6: Voice AI Tools & Dispatcher Orchestration Integration', () => {
  let mockVoiceService: SoilVoiceService;
  let dispatcher: VoiceDispatcher;

  const validSession: VoiceSessionContext = {
    sessionId: 'sess-1001',
    userId: 'u1',
    phone: '+919876543210',
    language: 'te',
  };

  beforeEach(() => {
    mockVoiceService = {
      getVoiceSoilContext: vi.fn(),
      verifyInputForVoice: vi.fn(),
    } as unknown as SoilVoiceService;

    dispatcher = new VoiceDispatcher();
    const tools = createSoilVoiceTools(mockVoiceService);
    for (const tool of tools) {
      dispatcher.registerTool(tool);
    }
  });

  it('should expose exactly 2 structured Voice AI tools with valid parameter schemas', () => {
    const tools = dispatcher.getTools();
    expect(tools.length).toBe(2);
    const names = tools.map((t) => t.name);
    expect(names).toContain('get_farmer_soil_health_context');
    expect(names).toContain('verify_agricultural_input_product');

    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.parameters.type).toBe('object');
    }
  });

  describe('Voice Dispatcher — get_farmer_soil_health_context', () => {
    it('should reject unauthenticated caller session with UNAUTHORIZED_CALLER_SESSION', async () => {
      const res = await dispatcher.dispatch({ sessionId: 's1', userId: '', phone: '' }, 'get_farmer_soil_health_context', {});
      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('UNAUTHORIZED_CALLER_SESSION');
    });

    it('should invoke voice service through dispatcher and return structured soil context', async () => {
      const mockResult = {
        farmer: { farmerId: 'f1', fullName: 'Ramesh', district: 'Guntur', state: 'AP' },
        hasReport: true,
        nutrients: { ph: 7.5 },
      };
      vi.mocked(mockVoiceService.getVoiceSoilContext).mockResolvedValueOnce(mockResult as any);

      const res = await dispatcher.dispatch(validSession, 'get_farmer_soil_health_context', {});
      expect(res.success).toBe(true);
      expect(mockVoiceService.getVoiceSoilContext).toHaveBeenCalledWith('u1');
      expect(res.result).toEqual(mockResult);
    });
  });

  describe('Voice Dispatcher — verify_agricultural_input_product', () => {
    it('should reject call when required arguments are missing', async () => {
      const res = await dispatcher.dispatch(validSession, 'verify_agricultural_input_product', {
        category: 'fertilizer',
        // missing productName
      });
      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('INVALID_TOOL_ARGUMENTS');
      expect(res.error?.message).toContain('productName');
    });

    it('should invoke input verification service and return speech-ready result', async () => {
      const mockResult = {
        productName: 'Gromor Urea 46% N',
        isAuthentic: true,
        findingsSummary: 'Product registered under FCO-AP',
      };
      vi.mocked(mockVoiceService.verifyInputForVoice).mockResolvedValueOnce(mockResult as any);

      const res = await dispatcher.dispatch(validSession, 'verify_agricultural_input_product', {
        productName: 'Gromor Urea 46% N',
        category: 'fertilizer',
        brand: 'Gromor',
        batchNumber: 'B101',
      });

      expect(res.success).toBe(true);
      expect(mockVoiceService.verifyInputForVoice).toHaveBeenCalledWith('u1', {
        productName: 'Gromor Urea 46% N',
        category: 'fertilizer',
        brand: 'Gromor',
        batchNumber: 'B101',
      });
      expect(res.result).toEqual(mockResult);
    });
  });

  describe('Voice Dispatcher — Error handling', () => {
    it('should return TOOL_NOT_FOUND when requesting unregistered tool', async () => {
      const res = await dispatcher.dispatch(validSession, 'non_existent_tool', {});
      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('TOOL_NOT_FOUND');
    });

    it('should handle service execution errors gracefully without crashing', async () => {
      vi.mocked(mockVoiceService.getVoiceSoilContext).mockRejectedValueOnce(new Error('Database timeout'));

      const res = await dispatcher.dispatch(validSession, 'get_farmer_soil_health_context', {});
      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('TOOL_EXECUTION_ERROR');
      expect(res.error?.message).toContain('Database timeout');
    });
  });
});
