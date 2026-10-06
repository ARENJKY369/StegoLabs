package com.steglab.image;

import java.awt.image.BufferedImage;

/**
 * Objective quality metrics between a carrier and its stego twin.
 * MSE/PSNR over all RGB samples; SSIM on luminance with 8x8 windows
 * (standard K1=0.01, K2=0.03 constants).
 */
public final class ImageMetrics {

    public record Quality(double psnr, double ssim, double mse) {
    }

    private ImageMetrics() {
    }

    public static Quality compare(BufferedImage a, BufferedImage b) {
        int width = a.getWidth();
        int height = a.getHeight();

        double sumSq = 0;
        int[] rowA = new int[width];
        int[] rowB = new int[width];
        double[] lumaA = new double[width * height];
        double[] lumaB = new double[width * height];

        for (int y = 0; y < height; y++) {
            a.getRGB(0, y, width, 1, rowA, 0, width);
            b.getRGB(0, y, width, 1, rowB, 0, width);
            for (int x = 0; x < width; x++) {
                int pa = rowA[x], pb = rowB[x];
                int ra = (pa >> 16) & 0xFF, ga = (pa >> 8) & 0xFF, ba = pa & 0xFF;
                int rb = (pb >> 16) & 0xFF, gb = (pb >> 8) & 0xFF, bb = pb & 0xFF;
                int dr = ra - rb, dg = ga - gb, db = ba - bb;
                sumSq += (double) dr * dr + (double) dg * dg + (double) db * db;
                int i = y * width + x;
                lumaA[i] = 0.299 * ra + 0.587 * ga + 0.114 * ba;
                lumaB[i] = 0.299 * rb + 0.587 * gb + 0.114 * bb;
            }
        }

        double mse = sumSq / ((double) width * height * 3);
        double psnr = mse == 0 ? 99.0 : 10.0 * Math.log10(255.0 * 255.0 / mse);
        double ssim = meanSsim(lumaA, lumaB, width, height);
        return new Quality(round(psnr, 2), round(ssim, 4), round(mse, 4));
    }

    private static double meanSsim(double[] la, double[] lb, int width, int height) {
        final int win = 8;
        final double c1 = Math.pow(0.01 * 255, 2);
        final double c2 = Math.pow(0.03 * 255, 2);

        double total = 0;
        int windows = 0;
        for (int wy = 0; wy + win <= height; wy += win) {
            for (int wx = 0; wx + win <= width; wx += win) {
                double meanA = 0, meanB = 0;
                for (int y = 0; y < win; y++) {
                    int base = (wy + y) * width + wx;
                    for (int x = 0; x < win; x++) {
                        meanA += la[base + x];
                        meanB += lb[base + x];
                    }
                }
                int n = win * win;
                meanA /= n;
                meanB /= n;

                double varA = 0, varB = 0, cov = 0;
                for (int y = 0; y < win; y++) {
                    int base = (wy + y) * width + wx;
                    for (int x = 0; x < win; x++) {
                        double da = la[base + x] - meanA;
                        double db = lb[base + x] - meanB;
                        varA += da * da;
                        varB += db * db;
                        cov += da * db;
                    }
                }
                varA /= n - 1;
                varB /= n - 1;
                cov /= n - 1;

                double ssim = ((2 * meanA * meanB + c1) * (2 * cov + c2))
                        / ((meanA * meanA + meanB * meanB + c1) * (varA + varB + c2));
                total += ssim;
                windows++;
            }
        }
        return windows == 0 ? 1.0 : total / windows;
    }

    private static double round(double v, int places) {
        double f = Math.pow(10, places);
        return Math.round(v * f) / f;
    }
}
