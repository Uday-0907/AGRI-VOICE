import crypto from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../../database/db.js';
import { users, farmerProfiles } from '../../database/schema/index.js';
import { chunkPcmForExotel, computeRmsEnergy } from './audio-utils.js';
import { SarvamSpeechService } from './sarvam.service.js';
import { VoiceAgentService } from './voice-agent.service.js';
import { LlmMessage } from './llm.service.js';
import { VoiceSessionContext } from './dispatcher.js';

export const TELUGU_GREETING =
  'నమస్కారం! AGRI-VOICE రైతు సహాయక కేంద్రానికి స్వాగతం. మీకు ఏ సమాచారం కావాలి?';

const MAX_CONNECTIONS = 100;
const MAX_PCM_BUFFER_BYTES = 480000; // 30s at 8kHz 16-bit mono
const BARGE_IN_RMS_THRESHOLD = 900;
const SILENCE_RMS_THRESHOLD = 250;
const IDLE_TIMEOUT_MS = 60000;

interface ExotelStartPayload {
  stream_sid?: string;
  call_sid?: string;
  account_sid?: string;
  from?: string;
  to?: string;
  custom_parameters?: Record<string, string>;
}

interface CallSessionState {
  sessionId: string;
  streamSid: string;
  callSid: string;
  callerPhone: string;
  userId: string | null;
  identityVerified: boolean;
  expectedVillage?: string;
  detectedLanguage: string;
  pcmChunks: Buffer[];
  pcmBytes: number;
  hasSpeech: boolean;
  silentFrames: number;
  isSpeaking: boolean;
  isProcessing: boolean;
  history: LlmMessage[];
  activeAbort: AbortController | null;
  idleTimer: NodeJS.Timeout | null;
}

function normalizePhone(raw?: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return raw.trim();
}

export function verifyWsAuthToken(provided: string | undefined, expectedSecret: string | undefined): boolean {
  if (!expectedSecret) return true; // Local dev when VOICE_WS_AUTH_SECRET is unset
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expectedSecret);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function registerExotelVoiceStream(
  fastify: FastifyInstance,
  deps?: { sarvam?: SarvamSpeechService; agent?: VoiceAgentService }
) {
  const sarvam = deps?.sarvam || new SarvamSpeechService();
  const agent = deps?.agent || new VoiceAgentService();
  const wsPath = process.env.VOICE_WS_PATH || '/voice-stream';
  let activeConnections = 0;

  fastify.get(wsPath, { websocket: true }, (socket, request) => {
    if (process.env.VOICE_WS_ENABLED === 'false') {
      socket.close(1008, 'Voice WebSocket is disabled');
      return;
    }

    if (activeConnections >= MAX_CONNECTIONS) {
      socket.close(1013, 'Server connection limit reached');
      return;
    }

    const query = (request.query || {}) as Record<string, string | undefined>;
    const headerSecret = request.headers['x-agrivoice-ws-auth'] as string | undefined;
    const expectedSecret = process.env.VOICE_WS_AUTH_SECRET?.trim();
    if (!verifyWsAuthToken(headerSecret || query.token, expectedSecret)) {
      socket.close(1008, 'Unauthorized WebSocket handshake');
      return;
    }

    activeConnections++;

    const state: CallSessionState = {
      sessionId: crypto.randomUUID(),
      streamSid: '',
      callSid: '',
      callerPhone: '',
      userId: null,
      identityVerified: false,
      detectedLanguage: 'te-IN',
      pcmChunks: [],
      pcmBytes: 0,
      hasSpeech: false,
      silentFrames: 0,
      isSpeaking: false,
      isProcessing: false,
      history: [],
      activeAbort: null,
      idleTimer: null,
    };

    const resetIdleTimer = () => {
      if (state.idleTimer) clearTimeout(state.idleTimer);
      state.idleTimer = setTimeout(() => {
        socket.close(1000, 'Idle timeout');
      }, IDLE_TIMEOUT_MS);
    };
    resetIdleTimer();

    const sendJson = (payload: Record<string, unknown>) => {
      if (socket.readyState === 1) {
        socket.send(JSON.stringify(payload));
      }
    };

    const speakText = async (text: string, lang: string) => {
      if (!sarvam.isConfigured()) return;
      state.activeAbort?.abort();
      const abort = new AbortController();
      state.activeAbort = abort;
      state.isSpeaking = true;

      try {
        const tts = await sarvam.synthesizeSpeech(text, {
          languageCode: lang,
          sampleRate: 8000,
          signal: abort.signal,
        });
        if (abort.signal.aborted) return;

        const frames = chunkPcmForExotel(tts.pcm8kBuffer, 3200);
        for (const b64 of frames) {
          if (abort.signal.aborted || socket.readyState !== 1) break;
          sendJson({
            event: 'media',
            stream_sid: state.streamSid,
            media: { payload: b64 },
          });
        }
        if (!abort.signal.aborted) {
          sendJson({
            event: 'mark',
            stream_sid: state.streamSid,
            mark: { name: `tts-${Date.now()}` },
          });
        }
      } catch (err: any) {
        fastify.log.warn({ code: err?.code || 'TTS_ERROR' }, 'Sarvam TTS playback skipped');
      } finally {
        state.isSpeaking = false;
      }
    };

    const flushAndRespond = async () => {
      if (state.isProcessing || state.pcmBytes < 1600) return;
      const audioBuf = Buffer.concat(state.pcmChunks);
      // Clear raw audio immediately after handoff (never retain raw audio)
      state.pcmChunks = [];
      state.pcmBytes = 0;
      state.hasSpeech = false;
      state.silentFrames = 0;
      state.isProcessing = true;

      const abort = new AbortController();
      state.activeAbort = abort;

      try {
        if (!sarvam.isConfigured()) {
          sendJson({
            event: 'mark',
            stream_sid: state.streamSid,
            mark: { name: 'sarvam-unconfigured' },
          });
          return;
        }

        const stt = await sarvam.transcribeAudio(audioBuf, {
          languageCode: 'unknown',
          signal: abort.signal,
        });

        if (!stt.transcript) return;
        state.detectedLanguage = stt.languageCode || state.detectedLanguage;

        // Require identity verification before disclosing private farmer records over PSTN
        if (state.userId && !state.identityVerified) {
          const normalizedTranscript = stt.transcript.toLowerCase();
          if (
            (state.expectedVillage && normalizedTranscript.includes(state.expectedVillage.toLowerCase())) ||
            normalizedTranscript.includes('confirm') ||
            normalizedTranscript.includes('అవును')
          ) {
            state.identityVerified = true;
          } else {
            await speakText(
              'భద్రత కోసం దయచేసి మీ గ్రామం పేరు చెప్పి మీ గుర్తింపును నిర్ధారించండి.',
              state.detectedLanguage
            );
            return;
          }
        }

        const voiceSession: VoiceSessionContext = {
          sessionId: state.sessionId,
          userId: state.userId || '',
          phone: state.callerPhone,
          language: state.detectedLanguage,
        };

        const turn = await agent.handleTurn(voiceSession, stt.transcript, state.history, abort.signal);
        state.history.push({ role: 'user', content: stt.transcript });
        state.history.push({ role: 'assistant', content: turn.replyText });
        if (state.history.length > 10) {
          state.history = state.history.slice(-10);
        }

        await speakText(turn.replyText, state.detectedLanguage);

        if (turn.shouldEndCall) {
          socket.close(1000, 'Call ended by user');
        }
      } catch (err: any) {
        fastify.log.warn({ code: err?.code || 'VOICE_TURN_ERROR' }, 'Voice turn processing failed');
      } finally {
        state.isProcessing = false;
      }
    };

    socket.on('message', async (rawData: Buffer | string) => {
      resetIdleTimer();
      const rawStr = typeof rawData === 'string' ? rawData : rawData.toString('utf8');
      if (rawStr.length > 262144) {
        socket.close(1009, 'Payload too large');
        return;
      }

      let msg: any;
      try {
        msg = JSON.parse(rawStr);
      } catch {
        sendJson({ event: 'error', code: 'INVALID_JSON' });
        return;
      }

      const evt = msg?.event;
      if (evt === 'connected') {
        sendJson({ event: 'connected_ack', sessionId: state.sessionId });
        return;
      }

      if (evt === 'start') {
        const start: ExotelStartPayload = msg.start || {};
        const configuredSid = process.env.TELEPHONY_ACCOUNT_SID?.trim();
        if (
          configuredSid &&
          !configuredSid.includes('placeholder') &&
          start.account_sid &&
          start.account_sid !== configuredSid
        ) {
          socket.close(1008, 'Account SID mismatch');
          return;
        }

        state.streamSid = msg.stream_sid || start.stream_sid || `stream-${state.sessionId}`;
        state.callSid = start.call_sid || `call-${state.sessionId}`;
        state.callerPhone = normalizePhone(start.from);

        // Check if optional JWT authToken was passed in custom_parameters
        const customToken = start.custom_parameters?.authToken;
        if (customToken) {
          try {
            const decoded = fastify.jwt.verify<{ id: string; phone: string }>(customToken);
            state.userId = decoded.id;
            state.identityVerified = true;
          } catch {
            // Invalid custom token ignored
          }
        }

        // Lookup registered farmer by normalized phone (still requires village/PIN verification)
        if (!state.userId && state.callerPhone) {
          const [u] = await db
            .select()
            .from(users)
            .where(and(eq(users.phone, state.callerPhone), isNull(users.deletedAt)))
            .limit(1);
          if (u) {
            state.userId = u.id;
            const [prof] = await db
              .select({ village: farmerProfiles.village })
              .from(farmerProfiles)
              .where(eq(farmerProfiles.userId, u.id))
              .limit(1);
            state.expectedVillage = prof?.village;
          }
        }

        await speakText(TELUGU_GREETING, 'te-IN');
        return;
      }

      if (evt === 'media') {
        const payload = msg?.media?.payload;
        if (typeof payload !== 'string' || !payload.length) {
          sendJson({ event: 'error', code: 'INVALID_MEDIA_PAYLOAD' });
          return;
        }

        const chunk = Buffer.from(payload, 'base64');
        const rms = computeRmsEnergy(chunk);

        // Barge-in: caller speaks while bot is playing TTS
        if (state.isSpeaking && rms > BARGE_IN_RMS_THRESHOLD) {
          state.activeAbort?.abort();
          state.isSpeaking = false;
          sendJson({ event: 'clear', stream_sid: state.streamSid });
        }

        if (state.pcmBytes + chunk.length <= MAX_PCM_BUFFER_BYTES) {
          state.pcmChunks.push(chunk);
          state.pcmBytes += chunk.length;
        }

        if (rms > SILENCE_RMS_THRESHOLD) {
          state.hasSpeech = true;
          state.silentFrames = 0;
        } else if (state.hasSpeech) {
          state.silentFrames++;
          if (state.silentFrames >= 6) {
            await flushAndRespond();
          }
        }
        return;
      }

      if (evt === 'dtmf') {
        const digit = msg?.dtmf?.digit;
        if (digit === '#') {
          await flushAndRespond();
        } else if (digit === '*') {
          socket.close(1000, 'Caller pressed * to end');
        }
        return;
      }

      if (evt === 'stop') {
        state.activeAbort?.abort();
        state.pcmChunks = [];
        state.pcmBytes = 0;
        socket.close(1000, 'Stream stopped');
        return;
      }

      sendJson({ event: 'error', code: 'UNSUPPORTED_EVENT', received: evt });
    });

    socket.on('close', () => {
      activeConnections = Math.max(0, activeConnections - 1);
      if (state.idleTimer) clearTimeout(state.idleTimer);
      state.activeAbort?.abort();
      state.pcmChunks = [];
      state.pcmBytes = 0;
    });
  });
}
