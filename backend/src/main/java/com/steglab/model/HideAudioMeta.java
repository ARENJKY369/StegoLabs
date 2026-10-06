package com.steglab.model;

/** Metadata returned alongside the stego WAV (in the X-Steglab-Meta header). */
public record HideAudioMeta(
        double snr,
        double psnr,
        double capacityUsed,   // 0..1 fraction of usable capacity consumed
        long bytesEmbedded,
        long capacityBytes,
        int sampleRate,
        int channelCount,
        int bitsPerSample,
        double durationSeconds,
        long changedSamples,
        String placementMode,
        int bitDepth,
        String channels,
        boolean decoy
) {
}
