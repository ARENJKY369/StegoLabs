/** Client-side WAV parsing for the audio workbench (UI only — the backend re-parses everything). */

export interface WavInfo {
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  dataOffset: number;
  dataLength: number;
  frames: number;
  durationSeconds: number;
}

export interface HideAudioMeta {
  snr: number;
  psnr: number;
  capacityUsed: number;
  bytesEmbedded: number;
  capacityBytes: number;
  sampleRate: number;
  channelCount: number;
  bitsPerSample: number;
  durationSeconds: number;
  changedSamples: number;
  placementMode: string;
  bitDepth: number;
  channels: string;
  decoy: boolean;
}

export interface ExtractAudioResponse {
  message: string;
  placementMode: string;
  revealMode: string;
  decoyPresent: boolean;
  bitDepth: number;
  channels: string;
  contentVerdict: string;
  matchedKeywords: string[];
  entropy: number;
}

export interface AudioProbe {
  stegoDetected: boolean;
  placementMode?: string;
  decoyDetected?: boolean;
  bitDepth?: number;
}

/** Parse a PCM WAV from its raw bytes; throws a friendly Error when unsupported. */
export function parseWav(bytes: ArrayBuffer): WavInfo {
  const u8 = new Uint8Array(bytes);
  const view = new DataView(bytes);
  if (u8.length < 44) throw new Error("This file is too small to be a WAV file.");
  const four = (o: number) =>
    String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
  if (four(0) !== "RIFF" || four(8) !== "WAVE") {
    throw new Error(
      "Magic bytes say this is not a WAV file. MP3 and other compressed formats are not supported.",
    );
  }
  let pos = 12;
  let fmtTag = -1;
  let channels = -1;
  let sampleRate = -1;
  let bitsPerSample = -1;
  let dataOffset = -1;
  let dataLength = -1;
  while (pos + 8 <= u8.length) {
    const id = four(pos);
    const size = view.getUint32(pos + 4, true);
    if (pos + 8 + size > u8.length && id !== "data") break;
    if (id === "fmt ") {
      fmtTag = view.getUint16(pos + 8, true);
      channels = view.getUint16(pos + 10, true);
      sampleRate = view.getUint32(pos + 12, true);
      bitsPerSample = view.getUint16(pos + 22, true);
    } else if (id === "data") {
      dataOffset = pos + 8;
      dataLength = Math.min(size, u8.length - dataOffset);
      break;
    }
    pos += 8 + size + (size & 1);
  }
  if (fmtTag !== 1) {
    throw new Error(
      `This WAV uses compressed audio (format tag ${fmtTag < 0 ? "?" : fmtTag}). Only uncompressed PCM is supported.`,
    );
  }
  if (channels < 1 || channels > 2) {
    throw new Error(`Only mono and stereo WAV files are supported; this one has ${channels} channels.`);
  }
  if (bitsPerSample !== 8 && bitsPerSample !== 16) {
    throw new Error(`Only 8-bit and 16-bit PCM WAV is supported; this one is ${bitsPerSample}-bit.`);
  }
  if (dataOffset < 0 || dataLength <= 0) throw new Error("This WAV has no audio data chunk.");
  const frames = Math.floor(dataLength / (bitsPerSample / 8) / channels);
  return {
    channels,
    sampleRate,
    bitsPerSample,
    dataOffset,
    dataLength,
    frames,
    durationSeconds: frames / sampleRate,
  };
}

/** Min/max waveform buckets in [-1, 1] for drawing. */
export function waveformBuckets(
  bytes: ArrayBuffer,
  info: WavInfo,
  buckets: number,
): { min: Float32Array; max: Float32Array } {
  const view = new DataView(bytes);
  const framesPerBucket = Math.max(1, Math.floor(info.frames / buckets));
  const min = new Float32Array(buckets).fill(1);
  const max = new Float32Array(buckets).fill(-1);
  const sample = (frame: number, ch: number) => {
    const off = info.dataOffset + (frame * info.channels + ch) * (info.bitsPerSample / 8);
    if (off + info.bitsPerSample / 8 > bytes.byteLength) return 0;
    return info.bitsPerSample === 16
      ? view.getInt16(off, true) / 32768
      : (view.getUint8(off) - 128) / 128;
  };
  for (let b = 0; b < buckets; b++) {
    const start = b * framesPerBucket;
    const end = Math.min(info.frames, start + framesPerBucket);
    for (let f = start; f < end; f += info.frames > 500_000 ? 7 : 1) {
      for (let ch = 0; ch < info.channels; ch++) {
        const v = sample(f, ch);
        if (v < min[b]) min[b] = v;
        if (v > max[b]) max[b] = v;
      }
    }
  }
  return { min, max };
}

/** Mirrors the backend capacity math exactly (header reserve 120 slots = whole frames). */
export function audioCapacity(
  info: WavInfo,
  bitDepth: 1 | 2,
  selectedChannels: 1 | 2,
  decoy: boolean,
): number {
  const headerFrames = Math.ceil(120 / info.channels);
  const usable = Math.max(0, info.frames - headerFrames);
  const raw = Math.floor((usable * selectedChannels * bitDepth) / 8);
  const region = decoy ? Math.floor(raw / 2) : raw;
  return Math.max(0, region - 54); // envelope overhead
}

export function formatDuration(seconds: number): string {
  if (!isFinite(seconds)) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return m > 0 ? `${m}m ${s.toFixed(1)}s` : `${s.toFixed(1)}s`;
}

export function formatDb(db: number): string {
  if (!isFinite(db)) return "∞ dB";
  return `${db.toFixed(1)} dB`;
}
