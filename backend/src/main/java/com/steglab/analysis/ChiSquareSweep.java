package com.steglab.analysis;

/**
 * Westfeld–Pfitzmann chi-square attack, swept over growing prefixes.
 *
 * For one colour channel in raster order we maintain a histogram of
 * "pairs of values" (2k, 2k+1). Sequential LSB embedding equalises each
 * pair; the chi-square statistic against the equalised expectation
 * collapses towards its degrees of freedom, driving the z-score down.
 *
 * At every 256-sample checkpoint we compute
 *   z = (chi2 - dof) / sqrt(2*dof)
 * and track the longest prefix (from the start) during which z stayed
 * <= +1.0 — i.e. the region that looks statistically equalised.
 */
public final class ChiSquareSweep {

    public record Result(
            double finalZ,          // z at the end of the channel
            double minZ,            // most equalised point seen
            long equalizedPrefix,   // samples in the longest equalised prefix
            double equalizedFraction, // prefix / total samples
            long totalSamples
    ) {
    }

    private static final int CHECKPOINT = 256;

    private ChiSquareSweep() {
    }

    /** channelValues: one 0-255 sample per pixel, raster order. */
    public static Result sweep(int[] channelValues) {
        int[] hist = new int[256];
        long samples = 0;
        long equalizedPrefix = 0;
        double minZ = Double.MAX_VALUE;
        double z = 0;

        // The prefix is the largest checkpoint at which the cumulative
        // statistic still reads as equalised (z <= +1.0). A momentary
        // jitter above the threshold must not erase the measurement —
        // with few populated pairs, z wobbles by whole units.
        for (int value : channelValues) {
            hist[value]++;
            samples++;
            if (samples % CHECKPOINT == 0) {
                z = zScore(hist);
                if (z < minZ) minZ = z;
                if (z <= 1.0) equalizedPrefix = samples;
            }
        }
        if (samples % CHECKPOINT != 0) {
            z = zScore(hist);
            if (z < minZ) minZ = z;
            if (z <= 1.0) equalizedPrefix = samples;
        }
        if (minZ == Double.MAX_VALUE) minZ = z;

        return new Result(
                round(z), round(minZ), equalizedPrefix,
                samples == 0 ? 0 : (double) equalizedPrefix / samples,
                samples);
    }

    private static double zScore(int[] hist) {
        double chi2 = 0;
        int dof = 0;
        for (int k = 0; k < 128; k++) {
            int a = hist[2 * k];
            int b = hist[2 * k + 1];
            double expected = (a + b) / 2.0;
            if (expected < 4) continue; // too sparse to be meaningful
            double d = a - expected;
            chi2 += (d * d) / expected; // Westfeld–Pfitzmann statistic, one term per pair
            dof++;
        }
        // Even a single well-populated pair discriminates: an untouched flat
        // region piles everything on one value of the pair (huge chi2), an
        // embedded one splits it 50/50 (tiny chi2).
        if (dof < 1) return 10.0; // literally no mass — nothing to say
        return (chi2 - dof) / Math.sqrt(2.0 * dof);
    }

    private static double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
