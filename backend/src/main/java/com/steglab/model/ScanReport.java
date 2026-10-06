package com.steglab.model;

import java.util.List;

/** Full result of a single-file scan. */
public record ScanReport(
        String filename,
        String detectedType,
        long sizeBytes,
        int score,                   // 0-100, capped
        String label,                // CLEAN | SUSPICIOUS | LIKELY CONTAINS HIDDEN DATA
        List<ScanFinding> findings,
        List<String> testsRun,
        PayloadClassification payloadClassification,       // blind, from appended/extracted data
        PayloadClassification authenticatedClassification, // only if a password unlocked a payload
        String extractedPreview,     // first 160 chars of decrypted text, if any
        double[][] heatmapData,      // per 20x20 block: fraction of LSBs == 1 (images only)
        int heatmapBlockSize,
        int[][] lsbPlaneR,           // downsampled LSB planes (max ~160px wide)
        int[][] lsbPlaneG,
        int[][] lsbPlaneB,
        double lsbEntropyR,          // full-resolution bit-plane entropy, bits/bit
        double lsbEntropyG,
        double lsbEntropyB,
        int imageWidth,
        int imageHeight,
        long scanDurationMs
) {
    public static String labelFor(int score) {
        if (score <= 24) return "CLEAN";
        if (score <= 59) return "SUSPICIOUS";
        return "LIKELY CONTAINS HIDDEN DATA";
    }
}
