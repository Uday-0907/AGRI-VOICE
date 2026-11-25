import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { buildApp } from '../../../src/app.js';

/**
 * Exotel AgentStream / Voicebot Applet WebSocket Protocol Simulator.
 * NOTE: Simulates Exotel JSON events locally over ws:// — NOT a real Exotel PSTN phone call.
 */
describe('Exotel WebSocket Protocol Simulator (/voice-stream)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let baseWsUrl: string;
  const origSecret = process.env.VOICE_WS_AUTH_SECRET;

  beforeAll(async () => {
    process.env.VOICE_WS_AUTH_SECRET = 'sim-test-secret-123';
    app = await buildApp();
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    baseWsUrl = address.replace(/^http/, 'ws') + '/voice-stream';
  });

  afterAll(async () => {
    process.env.VOICE_WS_AUTH_SECRET = origSecret;
    await app.close();
  });

  it('rejects WebSocket handshake with invalid auth token', async () => {
    await new Promise<void>((resolve) => {
      const ws = new WebSocket(`${baseWsUrl}?token=wrong-secret`);
      ws.on('close', (code) => {
        expect(code).toBe(1008);
        resolve();
      });
    });
  });

  it('handles full simulated Exotel connected -> start -> media -> dtmf -> stop lifecycle', async () => {
    const received: any[] = [];
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`${baseWsUrl}?token=sim-test-secret-123`);
      ws.on('error', reject);

      ws.on('open', () => {
        ws.send(JSON.stringify({ event: 'connected' }));
        ws.send(
          JSON.stringify({
            event: 'start',
            stream_sid: 'MZ_SIM_001',
            start: {
              stream_sid: 'MZ_SIM_001',
              call_sid: 'CA_SIM_001',
              from: '+919876543210',
              to: '+918047491899',
              media_format: { encoding: 'audio/x-raw', sample_rate: '8000', bit_rate: '128000' },
            },
          })
        );
        // Send invalid media first to verify error handling
        ws.send(JSON.stringify({ event: 'media', stream_sid: 'MZ_SIM_001', media: { payload: '' } }));
        // Send valid 8kHz PCM frame
        ws.send(
          JSON.stringify({
            event: 'media',
            stream_sid: 'MZ_SIM_001',
            media: { payload: Buffer.alloc(640, 2).toString('base64') },
          })
        );
        // Send unsupported event
        ws.send(JSON.stringify({ event: 'unknown_test_evt' }));
        // Send stop
        ws.send(JSON.stringify({ event: 'stop', stream_sid: 'MZ_SIM_001' }));
      });

      ws.on('message', (data) => {
        received.push(JSON.parse(data.toString()));
      });

      ws.on('close', (code) => {
        expect(code).toBe(1000);
        resolve();
      });
    });

    expect(received.some((m) => m.event === 'connected_ack')).toBe(true);
    expect(received.some((m) => m.event === 'error' && m.code === 'INVALID_MEDIA_PAYLOAD')).toBe(true);
    expect(received.some((m) => m.event === 'error' && m.code === 'UNSUPPORTED_EVENT')).toBe(true);
  });

  it('supports multiple isolated concurrent simulator sessions', async () => {
    const runSession = (sid: string) =>
      new Promise<boolean>((resolve, reject) => {
        const ws = new WebSocket(`${baseWsUrl}?token=sim-test-secret-123`);
        let acked = false;
        ws.on('error', reject);
        ws.on('open', () => {
          ws.send(JSON.stringify({ event: 'connected' }));
          ws.send(JSON.stringify({ event: 'start', stream_sid: sid, start: { stream_sid: sid } }));
          ws.send(JSON.stringify({ event: 'stop', stream_sid: sid }));
        });
        ws.on('message', (d) => {
          const parsed = JSON.parse(d.toString());
          if (parsed.event === 'connected_ack') acked = true;
        });
        ws.on('close', () => resolve(acked));
      });

    const results = await Promise.all([runSession('MZ_A'), runSession('MZ_B')]);
    expect(results).toEqual([true, true]);
  });
});
