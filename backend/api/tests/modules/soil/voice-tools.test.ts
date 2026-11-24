import { describe, it, expect, vi } from 'vitest';
import { createSoilVoiceTools } from '../../../src/modules/soil/voice-tools.js';
import { SoilVoiceService } from '../../../src/modules/soil/services/soil-voice.service.js';

describe('Pillar 6: Voice AI Tools Orchestration Integration', () => {
  const mockVoiceService = {
    getVoiceSoilContext: vi.fn(),
    verifyInputForVoice: vi.fn(),
  } as unknown as SoilVoiceService;

  const tools = createSoilVoiceTools(mockVoiceService);

  it('should expose exactly 2 structured Voice AI tools with valid parameter schemas', () => {
    expect(tools.length).toBe(2);
    const names = tools.map((t) => t.name);
    expect(names).toContain('get_farmer_soil_health_context');
    expect(names).toContain('verify_agricultural_input_product');

    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.parameters.type).toBe('object');
    }
  });

  describe('get_farmer_soil_health_context tool', () => {
    const tool = tools.find((t) => t.name === 'get_farmer_soil_health_context')!;

    it('should reject execution when session has no verified userId', async () => {
      await expect(tool.execute({ userId: '' }, {})).rejects.toThrow('UNAUTHORIZED_CALLER_SESSION');
    });

    it('should invoke voice service and return structured soil context', async () => {
      const mockResult = {
        farmer: { farmerId: 'f1', fullName: 'Ramesh', district: 'Guntur', state: 'AP' },
        hasReport: true,
        nutrients: { ph: 7.5 },
      };
      vi.mocked(mockVoiceService.getVoiceSoilContext).mockResolvedValueOnce(mockResult as any);

      const res = await tool.execute({ userId: 'u1' }, {});
      expect(mockVoiceService.getVoiceSoilContext).toHaveBeenCalledWith('u1');
      expect(res).toEqual(mockResult);
    });
  });

  describe('verify_agricultural_input_product tool', () => {
    const tool = tools.find((t) => t.name === 'verify_agricultural_input_product')!;

    it('should reject execution when session has no verified userId', async () => {
      await expect(tool.execute({ userId: '' }, { productName: 'Urea', category: 'fertilizer' })).rejects.toThrow('UNAUTHORIZED_CALLER_SESSION');
    });

    it('should invoke input verification service and return speech-ready result', async () => {
      const mockResult = {
        productName: 'Urea',
        isAuthentic: true,
        findingsSummary: 'Product registered',
      };
      vi.mocked(mockVoiceService.verifyInputForVoice).mockResolvedValueOnce(mockResult as any);

      const res = await tool.execute({ userId: 'u1' }, {
        productName: 'Urea',
        category: 'fertilizer',
        brand: 'Gromor',
        batchNumber: 'B1',
      });

      expect(mockVoiceService.verifyInputForVoice).toHaveBeenCalledWith('u1', {
        productName: 'Urea',
        category: 'fertilizer',
        brand: 'Gromor',
        batchNumber: 'B1',
      });
      expect(res).toEqual(mockResult);
    });
  });
});
