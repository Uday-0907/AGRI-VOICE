/**
 * Audio conversion utilities for Exotel AgentStream (8kHz 16-bit mono PCM)
 * and Sarvam AI Speech APIs (WAV / 8kHz).
 */

export function pcm8kToWav(pcmBuffer: Buffer, sampleRate = 8000, channels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // AudioFormat = 1 (PCM)
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([header, pcmBuffer]);
}

/**
 * Strips the RIFF/WAVE header from a WAV buffer to return raw PCM bytes.
 * Finds the 'data' subchunk dynamically rather than assuming a fixed 44-byte offset.
 */
export function stripWavHeader(wavBuffer: Buffer): Buffer {
  if (wavBuffer.length < 44) return wavBuffer;
  if (wavBuffer.toString('ascii', 0, 4) !== 'RIFF' || wavBuffer.toString('ascii', 8, 12) !== 'WAVE') {
    return wavBuffer;
  }

  let offset = 12;
  while (offset + 8 <= wavBuffer.length) {
    const chunkId = wavBuffer.toString('ascii', offset, offset + 4);
    const chunkSize = wavBuffer.readUInt32LE(offset + 4);
    if (chunkId === 'data') {
      const start = offset + 8;
      const end = Math.min(start + chunkSize, wavBuffer.length);
      return wavBuffer.subarray(start, end);
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  return wavBuffer.subarray(44);
}

/**
 * Chunks raw 8kHz 16-bit mono PCM into Exotel-compatible base64 frames.
 * Exotel recommends 3.2 KB - 100 KB chunks, strictly multiples of 320 bytes.
 */
export function chunkPcmForExotel(pcmBuffer: Buffer, chunkBytes = 3200): string[] {
  const alignedSize = Math.max(320, Math.floor(chunkBytes / 320) * 320);
  const chunks: string[] = [];

  for (let offset = 0; offset < pcmBuffer.length; offset += alignedSize) {
    let slice = pcmBuffer.subarray(offset, offset + alignedSize);
    const remainder = slice.length % 320;
    if (remainder !== 0) {
      const pad = Buffer.alloc(320 - remainder, 0);
      slice = Buffer.concat([slice, pad]);
    }
    chunks.push(slice.toString('base64'));
  }

  return chunks;
}

/**
 * Computes RMS energy of a 16-bit signed little-endian PCM buffer (0..32768).
 * Used for lightweight voice activity & barge-in detection.
 */
export function computeRmsEnergy(pcmBuffer: Buffer): number {
  const sampleCount = Math.floor(pcmBuffer.length / 2);
  if (sampleCount === 0) return 0;

  let sumSq = 0;
  for (let i = 0; i < sampleCount; i++) {
    const sample = pcmBuffer.readInt16LE(i * 2);
    sumSq += sample * sample;
  }
  return Math.sqrt(sumSq / sampleCount);
}
