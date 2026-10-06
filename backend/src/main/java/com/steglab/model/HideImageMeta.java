package com.steglab.model;

/** Metadata returned alongside the stego PNG (in the X-Steglab-Meta header). */
public record HideImageMeta(
        double psnr,
        double ssim,
        double mse,
        double capacityUsed,   // 0..1 fraction of usable capacity consumed
        long bytesEmbedded,    // total envelope bytes written to the LSB plane
        long capacityBytes,    // usable payload capacity at these settings
        int width,
        int height,
        String placementMode,
        int bitDepth,
        String channels,
        boolean decoy
) {
}
