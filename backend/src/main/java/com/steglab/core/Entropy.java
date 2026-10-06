package com.steglab.core;

/**
 * Shannon entropy helpers, used by the payload classifier, the scanner
 * and the utilities module. Results are bits per byte (0.0 – 8.0) or
 * bits per bit (0.0 – 1.0) for bit planes.
 */
public final class Entropy {

    private Entropy() {
    }

    /** Shannon entropy in bits/byte over the whole buffer. */
    public static double ofBytes(byte[] data) {
        return ofBytes(data, 0, data.length);
    }

    /** Shannon entropy in bits/byte over a slice. */
    public static double ofBytes(byte[] data, int offset, int length) {
        if (data == null || length <= 0) return 0.0;
        int[] counts = new int[256];
        int end = Math.min(data.length, offset + length);
        int n = 0;
        for (int i = offset; i < end; i++) {
            counts[data[i] & 0xFF]++;
            n++;
        }
        if (n == 0) return 0.0;
        double entropy = 0.0;
        for (int count : counts) {
            if (count == 0) continue;
            double p = (double) count / n;
            entropy -= p * (Math.log(p) / Math.log(2));
        }
        return entropy;
    }

    /** Entropy of a 0/1 sequence in bits per bit (max 1.0). */
    public static double ofBits(int ones, int total) {
        if (total <= 0 || ones <= 0 || ones >= total) return ones == 0 || ones == total ? 0.0 : 0.0;
        double p = (double) ones / total;
        return -(p * log2(p) + (1 - p) * log2(1 - p));
    }

    /** Fraction of bytes that are printable ASCII (incl. tab/newline/CR). */
    public static double printableRatio(byte[] data) {
        if (data == null || data.length == 0) return 0.0;
        int printable = 0;
        for (byte b : data) {
            int v = b & 0xFF;
            if ((v >= 0x20 && v < 0x7F) || v == '\t' || v == '\n' || v == '\r') {
                printable++;
            }
        }
        return (double) printable / data.length;
    }

    private static double log2(double x) {
        return Math.log(x) / Math.log(2);
    }
}
