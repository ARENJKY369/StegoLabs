package com.steglab.audio;

import com.steglab.exception.ApiException;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/**
 * Minimal reader for uncompressed PCM WAV (RIFF/WAVE) files.
 *
 * The full byte array is kept verbatim; only the PCM sample bytes inside
 * the {@code data} chunk are ever modified. That means any extra chunks
 * (LIST metadata, cue points, padding) survive a hide operation exactly.
 *
 * Supported: PCM (format tag 1), 8-bit or 16-bit samples, mono or stereo.
 */
public final class WavCodec {

    /** A parsed carrier: positions and format info, sharing {@code container}'s bytes. */
    public record Wav(byte[] container, int dataOffset, int dataLength,
                      int channels, int sampleRate, int bitsPerSample) {

        public int bytesPerSample() {
            return bitsPerSample / 8;
        }

        /** Total interleaved samples (frames × channels). */
        public int totalSamples() {
            return dataLength / bytesPerSample();
        }

        public long totalFrames() {
            return totalSamples() / (long) channels;
        }

        public double durationSeconds() {
            return totalFrames() / (double) sampleRate;
        }

        /** Absolute byte offset of the LSB byte of interleaved sample {@code slot}. */
        public int byteOffsetOf(int slot) {
            return dataOffset + slot * bytesPerSample();
        }

        /** Signed value of interleaved sample {@code slot}. */
        public int sampleAt(int slot) {
            int off = byteOffsetOf(slot);
            if (bitsPerSample == 8) {
                return (container[off] & 0xFF) - 128;
            }
            return ByteBuffer.wrap(container, off, 2).order(ByteOrder.LITTLE_ENDIAN).getShort();
        }

        /** Peak magnitude used for PSNR (32767 for 16-bit, 127 for 8-bit). */
        public int peak() {
            return bitsPerSample == 8 ? 127 : 32767;
        }
    }

    private WavCodec() {
    }

    public static Wav parse(byte[] bytes) {
        if (bytes.length < 44) {
            throw ApiException.badRequest("NOT_WAV",
                    "This file is too small to be a WAV file.");
        }
        if (bytes[0] != 'R' || bytes[1] != 'I' || bytes[2] != 'F' || bytes[3] != 'F'
                || bytes[8] != 'W' || bytes[9] != 'A' || bytes[10] != 'V' || bytes[11] != 'E') {
            throw ApiException.badRequest("NOT_WAV",
                    "The magic bytes say this is not really a WAV file. "
                            + "MP3 and other compressed formats cannot carry LSB data — "
                            + "convert to WAV first.");
        }

        ByteBuffer le = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
        int pos = 12;
        int fmtTag = -1;
        int channels = -1;
        int sampleRate = -1;
        int bitsPerSample = -1;
        int dataOffset = -1;
        int dataLength = -1;

        while (pos + 8 <= bytes.length) {
            int fourcc = le.getInt(pos);
            int size = le.getInt(pos + 4);
            if (size < 0 || pos + 8 + size > bytes.length && fourcc != TAG_DATA) {
                // Ignore trailing garbage after a truncated final chunk.
                break;
            }
            if (fourcc == TAG_FMT) {
                fmtTag = le.getShort(pos + 8) & 0xFFFF;
                channels = le.getShort(pos + 10) & 0xFFFF;
                sampleRate = le.getInt(pos + 12);
                bitsPerSample = le.getShort(pos + 22) & 0xFFFF;
            } else if (fourcc == TAG_DATA) {
                dataOffset = pos + 8;
                dataLength = Math.min(size, bytes.length - dataOffset);
                break;
            }
            // Chunks are word-aligned.
            pos += 8 + size + (size & 1);
        }

        if (fmtTag != 1) {
            throw ApiException.badRequest("NOT_PCM",
                    "This WAV uses compressed audio (format tag " + (fmtTag < 0 ? "?" : fmtTag)
                            + "). Only uncompressed PCM WAV can carry hidden data — "
                            + "convert it with Utilities → WAV converter.");
        }
        if (channels < 1 || channels > 2) {
            throw ApiException.badRequest("BAD_WAV_CHANNELS",
                    "Only mono and stereo WAV files are supported; this one has "
                            + channels + " channels.");
        }
        if (bitsPerSample != 8 && bitsPerSample != 16) {
            throw ApiException.badRequest("BAD_WAV_DEPTH",
                    "Only 8-bit and 16-bit PCM WAV files are supported; this one is "
                            + bitsPerSample + "-bit.");
        }
        if (dataOffset < 0 || dataLength <= 0) {
            throw ApiException.badRequest("NOT_WAV",
                    "This WAV has no audio data chunk.");
        }
        return new Wav(bytes, dataOffset, dataLength, channels, sampleRate, bitsPerSample);
    }

    private static final int TAG_FMT = ('f') | ('m' << 8) | ('t' << 16) | (' ' << 24);
    private static final int TAG_DATA = ('d') | ('a' << 8) | ('t' << 16) | ('a' << 24);
}
