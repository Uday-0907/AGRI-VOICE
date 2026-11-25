import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  pcm8kToWav,
  stripWavHeader,
  chunkPcmForExotel,
  computeRmsEnergy,
  SarvamSpeechService,
  SarvamApiError,
  LlmOrchestrator,
  ILlmProvider,
  LlmProviderError,
  VoiceAgentService,
} from '../../../src/modules/voice/index.js';
import { buildApp } from '../../../src/app.js';

describe('Phone Voice Agent: Audio, Sarvam STT/TTS, LLM Fallback & Voice APIs', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let buyerToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    buyerToken = app.jwt.sign({ id: 'b0000000-0000-0000-0000-000000000099', phone: '+919000000099', role: 'buyer' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('converts 8kHz PCM <-> WAV and chunks into 320-byte aligned Exotel frames', () => {
    const pcm = Buffer.alloc(6500, 10);
    const wav = pcm8kToWav(pcm, 8000);
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');

    const stripped = stripWavHeader(wav);
    expect(stripped.length).toBe(pcm.length);

    const chunks = chunkPcmForExotel(pcm, 3200);
    expect(chunks.length).toBe(3);
    for (const c of chunks) {
      expect(Buffer.from(c, 'base64').length % 320).toBe(0);
    }

    const silent = Buffer.alloc(320, 0);
    expect(computeRmsEnergy(silent)).toBe(0);
  });

  it('SarvamSpeechService handles mocked STT/TTS and classifies 402/429 errors cleanly', async () => {
    const origKey = process.env.SARVAM_API_KEY;
    process.env.SARVAM_API_KEY = 'test-sarvam-key';

    try {
      const wavSample = pcm8kToWav(Buffer.alloc(640, 1)).toString('base64');
      const mockFetch = async (url: string) => {
        if (url.includes('speech-to-text')) {
          return new Response(JSON.stringify({ transcript: 'నా పొలంలో వాతావరణం ఎలా ఉంది?', language_code: 'te-IN' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ audios: [wavSample] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      const sarvam = new SarvamSpeechService({ fetchFn: mockFetch as any, maxRetries: 0 });
      const stt = await sarvam.transcribeAudio(Buffer.alloc(640, 1));
      expect(stt.transcript).toContain('వాతావరణం');
      expect(stt.languageCode).toBe('te-IN');

      const tts = await sarvam.synthesizeSpeech('నమస్కారం రైతు సోదరా', { languageCode: 'te-IN' });
      expect(tts.pcm8kBuffer.length).toBe(640);

      const quotaSarvam = new SarvamSpeechService({
        fetchFn: (async () => new Response('Quota exceeded', { status: 402 })) as any,
        maxRetries: 0,
      });
      await expect(quotaSarvam.transcribeAudio(Buffer.alloc(320))).rejects.toMatchObject({
        code: 'QUOTA_EXHAUSTED',
      });

      const rateSarvam = new SarvamSpeechService({
        fetchFn: (async () => new Response('Rate limited', { status: 429 })) as any,
        maxRetries: 0,
      });
      await expect(rateSarvam.synthesizeSpeech('test')).rejects.toBeInstanceOf(SarvamApiError);
    } finally {
      process.env.SARVAM_API_KEY = origKey;
    }
  });

  it('LlmOrchestrator falls back from Gemini -> Claude -> OpenAI and handles total failure', async () => {
    const geminiFail: ILlmProvider = {
      name: 'gemini',
      model: 'gemini-2.5-flash',
      isConfigured: () => true,
      generate: async () => {
        throw new LlmProviderError('429', 'gemini', 'RATE_LIMITED', 429, true);
      },
    };
    const claudeFail: ILlmProvider = {
      name: 'claude',
      model: 'claude-sonnet-4-20250514',
      isConfigured: () => true,
      generate: async () => {
        throw new LlmProviderError('503', 'claude', 'UPSTREAM_UNAVAILABLE', 503, true);
      },
    };
    const openaiOk: ILlmProvider = {
      name: 'openai',
      model: 'gpt-4o-mini',
      isConfigured: () => true,
      generate: async () => ({
        provider: 'openai',
        model: 'gpt-4o-mini',
        text: 'ఈ రోజు వాతావరణం పొడిగా ఉంటుంది.',
        toolCalls: [],
      }),
    };

    const orchestrator = new LlmOrchestrator([geminiFail, claudeFail, openaiOk]);
    const res = await orchestrator.generateWithFallback({
      systemPrompt: 'sys',
      messages: [{ role: 'user', content: 'weather?' }],
      tools: [],
    });
    expect(res.provider).toBe('openai');
    expect(res.text).toContain('వాతావరణం');

    const allFail = new LlmOrchestrator([geminiFail, claudeFail]);
    await expect(
      allFail.generateWithFallback({ systemPrompt: 'sys', messages: [{ role: 'user', content: 'hi' }], tools: [] })
    ).rejects.toBeInstanceOf(LlmProviderError);
  });

  it('VoiceAgentService prevents duplicate tool execution in a single turn', async () => {
    let calls = 0;
    const dupProvider: ILlmProvider = {
      name: 'gemini',
      model: 'gemini-2.5-flash',
      isConfigured: () => true,
      generate: async () => {
        calls++;
        if (calls === 1) {
          return {
            provider: 'gemini',
            model: 'gemini-2.5-flash',
            text: '',
            toolCalls: [
              { id: '1', name: 'end_call', arguments: { reason: 'done' } },
              { id: '2', name: 'end_call', arguments: { reason: 'done' } },
            ],
          };
        }
        return { provider: 'gemini', model: 'gemini-2.5-flash', text: 'ధన్యవాదాలు!', toolCalls: [] };
      },
    };

    const agent = new VoiceAgentService(new LlmOrchestrator([dupProvider]));
    const result = await agent.handleTurn(
      { sessionId: 's1', userId: 'u1', phone: '+919000000000' },
      'bye'
    );
    expect(result.toolNamesExecuted).toEqual(['end_call']);
    expect(result.shouldEndCall).toBe(true);
  });

  it('GET /voice/status exposes non-secret readiness and POST /voice/ask blocks Buyer accounts (403)', async () => {
    const statusRes = await app.inject({ method: 'GET', url: '/voice/status' });
    expect(statusRes.statusCode).toBe(200);
    const body = statusRes.json();
    expect(body.data.wsPath).toBe('/voice-stream');
    expect(JSON.stringify(body)).not.toContain('sk-');

    const buyerAsk = await app.inject({
      method: 'POST',
      url: '/voice/ask',
      headers: { Authorization: `Bearer ${buyerToken}` },
      payload: { query: 'What is my soil health?' },
    });
    expect(buyerAsk.statusCode).toBe(403);
  });
});
