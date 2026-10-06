package com.steglab.clean;

import com.steglab.audio.WavCodec;
import com.steglab.model.CleanReport.CleanItem;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;

/**
 * WAV sanitation: rebuild the file as a canonical RIFF — 12-byte header,
 * a minimal PCM fmt chunk, the data chunk — so every ancillary chunk
 * (LIST metadata, cue points, bext broadcast data, padding) disappears.
 *
 * "Deep" profile randomises the lowest bit of every sample.
 */
public final class WavCleaner {

    private static final SecureRandom RANDOM = new SecureRandom();

    private WavCleaner() {
    }

    public record Result(byte[] bytes, List<CleanItem> items, List<String> notes) {
    }

    public static Result clean(byte[] data, boolean deep) {
        WavCodec.Wav wav = WavCodec.parse(data);
        List<CleanItem> items = new ArrayList<>();
        List<String> notes = new ArrayList<>();

        int sampleBytes = wav.bytesPerSample();
        byte[] samples = new byte[wav.dataLength()];
        System.arraycopy(data, wav.dataOffset(), samples, 0, wav.dataLength());

        long droppedBytes = data.length - (12 + 8 + 16 + 8 + samples.length);
        if (droppedBytes > 0) {
            items.add(new CleanItem("Container",
                    "Ancillary RIFF chunks removed (metadata, cue points, padding)", droppedBytes));
        }

        if (deep) {
            for (int s = 0; s < wav.totalSamples(); s++) {
                int off = s * sampleBytes;
                samples[off] = (byte) ((samples[off] & 0xFE) | RANDOM.nextInt(2));
            }
            items.add(new CleanItem("LSB plane",
                    "Lowest bit of every sample randomised", wav.totalSamples()));
        }

        // Canonical rebuild.
        ByteBuffer out = ByteBuffer.allocate(12 + 8 + 16 + 8 + samples.length)
                .order(ByteOrder.LITTLE_ENDIAN);
        out.put("RIFF".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        out.putInt(36 + samples.length);
        out.put("WAVE".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        out.put("fmt ".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        out.putInt(16);
        out.putShort((short) 1);                    // PCM
        out.putShort((short) wav.channels());
        out.putInt(wav.sampleRate());
        out.putInt(wav.sampleRate() * wav.channels() * sampleBytes);
        out.putShort((short) (wav.channels() * sampleBytes));
        out.putShort((short) wav.bitsPerSample());
        out.put("data".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        out.putInt(samples.length);
        out.put(samples);
        return new Result(out.array(), items, notes);
    }
}
