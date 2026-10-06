package com.steglab.audio;

/**
 * Signal-quality comparison between an original carrier and its stego copy.
 * SNR answers "how much original signal per unit of added noise"; PSNR
 * answers it against full scale. Both in dB — higher is better, and above
 * ~60 dB the modification is below the audibility threshold for normal
 * listening conditions.
 */
public final class AudioMetrics {

    public record Quality(double snr, double psnr, long changedSamples) {
    }

    private AudioMetrics() {
    }

    public static Quality compare(WavCodec.Wav original, WavCodec.Wav stego) {
        int n = original.totalSamples();
        long errorEnergy = 0;
        long signalEnergy = 0;
        long changed = 0;
        // Accumulate error into a running MSE instead of one giant sum to
        // avoid long overflow on large files (error² ≤ 65535² × samples).
        double mseAcc = 0;
        for (int i = 0; i < n; i++) {
            int a = original.sampleAt(i);
            int b = stego.sampleAt(i);
            long e = (long) b - a;
            errorEnergy += e * e;
            signalEnergy += (long) a * a;
            mseAcc += (e * e);
            if (e != 0) changed++;
        }
        double mse = n == 0 ? 0 : mseAcc / n;
        double peak = original.peak();

        double psnr = Double.POSITIVE_INFINITY;
        if (mse > 0) {
            psnr = 10 * Math.log10((peak * peak) / mse);
        }
        double snr = Double.POSITIVE_INFINITY;
        if (errorEnergy > 0) {
            snr = signalEnergy == 0
                    ? 0
                    : 10 * Math.log10((double) signalEnergy / (double) errorEnergy);
        } else if (signalEnergy == 0) {
            snr = Double.POSITIVE_INFINITY;
        }
        return new Quality(round1(snr), round1(psnr), changed);
    }

    private static double round1(double v) {
        if (Double.isInfinite(v) || Double.isNaN(v)) return v;
        return Math.round(v * 10.0) / 10.0;
    }
}
