import { pcm8kToWav, stripWavHeader } from './audio-utils.js';

export type SarvamErrorCode =
  | 'UNCONFIGURED'
  | 'INVALID_CREDENTIALS'
  | 'QUOTA_EXHAUSTED'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'BAD_REQUEST';

export class SarvamApiError extends Error {
  constructor(
    message: string,
    public readonly code: SarvamErrorCode,
    public readonly statusCode?: number,
    public readonly retryable = false
  ) {
    super(message);
    this.name = 'SarvamApiError';
  }
}

export interface SarvamSttResult {
  transcript: string;
  languageCode: string;
  provider: 'sarvam_saaras';
  model: string;
}

export interface SarvamTtsResult {
  audioBase64Wav: string;
  pcm8kBuffer: Buffer;
  sampleRate: number;
  languageCode: string;
  provider: 'sarvam_bulbul';
  model: string;
}

export const SUPPORTED_SARVAM_LANGUAGES = new Set([
  'te-IN',
  'hi-IN',
  'en-IN',
  'ta-IN',
  'kn-IN',
  'ml-IN',
  'mr-IN',
  'gu-IN',
  'bn-IN',
  'pa-IN',
  'od-IN',
  'unknown',
]);

function normalizeLanguageCode(lang?: string): string {
  if (!lang) return 'unknown';
  const trimmed = lang.trim();
  if (SUPPORTED_SARVAM_LANGUAGES.has(trimmed)) return trimmed;
  const short = trimmed.toLowerCase().split('-')[0];
  const map: Record<string, string> = {
    te: 'te-IN',
    hi: 'hi-IN',
    en: 'en-IN',
    ta: 'ta-IN',
    kn: 'kn-IN',
    ml: 'ml-IN',
    mr: 'mr-IN',
    gu: 'gu-IN',
    bn: 'bn-IN',
    pa: 'pa-IN',
    or: 'od-IN',
    od: 'od-IN',
  };
  return map[short] || 'unknown';
}

function classifyHttpError(status: number, bodyText: string): SarvamApiError {
  if (status === 401 || status === 403) {
    return new SarvamApiError('Sarvam API credentials were rejected.', 'INVALID_CREDENTIALS', status, false);
  }
  if (status === 402) {
    return new SarvamApiError('Sarvam API quota or balance exhausted.', 'QUOTA_EXHAUSTED', status, false);
  }
  if (status === 429) {
    return new SarvamApiError('Sarvam API rate limit exceeded.', 'RATE_LIMITED', status, true);
  }
  if (status >= 500) {
    return new SarvamApiError(`Sarvam service error (${status}).`, 'UPSTREAM_UNAVAILABLE', status, true);
  }
  return new SarvamApiError(`Sarvam request failed (${status}): ${bodyText.slice(0, 160)}`, 'BAD_REQUEST', status, false);
}

/**
 * Centralized Sarvam AI Speech-to-Text (Saaras) & Text-to-Speech (Bulbul) wrapper.
 * Uses a single authorized SARVAM_API_KEY; never rotates accounts or fabricates outputs.
 */
export class SarvamSpeechService {
  private readonly baseUrl = 'https://api.sarvam.ai';
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchFn: typeof fetch;

  constructor(options?: { timeoutMs?: number; maxRetries?: number; fetchFn?: typeof fetch }) {
    this.timeoutMs = options?.timeoutMs ?? 12000;
    this.maxRetries = options?.maxRetries ?? 2;
    this.fetchFn = options?.fetchFn ?? fetch;
  }

  private getApiKey(): string {
    const key = process.env.SARVAM_API_KEY?.trim();
    if (!key || key.includes('placeholder')) {
      throw new SarvamApiError('SARVAM_API_KEY is not configured.', 'UNCONFIGURED', undefined, false);
    }
    return key;
  }

  isConfigured(): boolean {
    const key = process.env.SARVAM_API_KEY?.trim();
    return Boolean(key && !key.includes('placeholder'));
  }

  private async withRetries<T>(fn: (signal: AbortSignal) => Promise<T>, externalSignal?: AbortSignal): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (externalSignal?.aborted) {
        throw new SarvamApiError('Sarvam request cancelled.', 'CANCELLED', undefined, false);
      }

      const controller = new AbortController();
      const onExternalAbort = () => controller.abort();
      externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        return await fn(controller.signal);
      } catch (err: any) {
        if (externalSignal?.aborted) {
          throw new SarvamApiError('Sarvam request cancelled.', 'CANCELLED', undefined, false);
        }
        if (err?.name === 'AbortError') {
          lastError = new SarvamApiError(`Sarvam request timed out after ${this.timeoutMs}ms.`, 'TIMEOUT', undefined, true);
        } else {
          lastError = err;
        }

        const retryable = lastError instanceof SarvamApiError ? lastError.retryable : false;
        if (!retryable || attempt === this.maxRetries) {
          throw lastError;
        }
        await new Promise((r) => setTimeout(r, 250 * Math.pow(2, attempt)));
      } finally {
        clearTimeout(timer);
        externalSignal?.removeEventListener('abort', onExternalAbort);
      }
    }
    throw lastError;
  }

  async transcribeAudio(
    audioBuffer: Buffer,
    options?: { languageCode?: string; isWav?: boolean; signal?: AbortSignal }
  ): Promise<SarvamSttResult> {
    const apiKey = this.getApiKey();
    const wavBuffer = options?.isWav ? audioBuffer : pcm8kToWav(audioBuffer, 8000);
    const languageCode = normalizeLanguageCode(options?.languageCode);
    const model = 'saaras:v3';

    return this.withRetries(async (signal) => {
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(wavBuffer)], { type: 'audio/wav' }), 'audio.wav');
      form.append('model', model);
      form.append('language_code', languageCode);

      const res = await this.fetchFn(`${this.baseUrl}/speech-to-text`, {
        method: 'POST',
        headers: { 'api-subscription-key': apiKey },
        body: form,
        signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw classifyHttpError(res.status, text);
      }

      const data = (await res.json()) as { transcript?: string; language_code?: string };
      return {
        transcript: (data.transcript || '').trim(),
        languageCode: data.language_code || (languageCode === 'unknown' ? 'te-IN' : languageCode),
        provider: 'sarvam_saaras',
        model,
      };
    }, options?.signal);
  }

  async synthesizeSpeech(
    text: string,
    options?: { languageCode?: string; speaker?: string; sampleRate?: number; signal?: AbortSignal }
  ): Promise<SarvamTtsResult> {
    const apiKey = this.getApiKey();
    const cleaned = text.trim().slice(0, 2400);
    if (!cleaned) {
      throw new SarvamApiError('Cannot synthesize empty text.', 'BAD_REQUEST', 400, false);
    }

    const languageCode = normalizeLanguageCode(options?.languageCode);
    const targetLanguage = languageCode === 'unknown' ? 'te-IN' : languageCode;
    const sampleRate = options?.sampleRate ?? 8000;
    const model = 'bulbul:v3';
    const speaker = options?.speaker || 'priya';

    return this.withRetries(async (signal) => {
      const res = await this.fetchFn(`${this.baseUrl}/text-to-speech`, {
        method: 'POST',
        headers: {
          'api-subscription-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: cleaned,
          target_language_code: targetLanguage,
          model,
          speaker,
          speech_sample_rate: sampleRate,
        }),
        signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw classifyHttpError(res.status, errText);
      }

      const data = (await res.json()) as { audios?: string[] };
      const audioBase64Wav = data.audios?.[0];
      if (!audioBase64Wav) {
        throw new SarvamApiError('Sarvam TTS returned no audio payload.', 'UPSTREAM_UNAVAILABLE', 502, true);
      }

      const wavBuf = Buffer.from(audioBase64Wav, 'base64');
      const pcm8kBuffer = stripWavHeader(wavBuf);

      return {
        audioBase64Wav,
        pcm8kBuffer,
        sampleRate,
        languageCode: targetLanguage,
        provider: 'sarvam_bulbul',
        model,
      };
    }, options?.signal);
  }
}
