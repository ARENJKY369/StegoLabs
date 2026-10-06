package com.steglab.model;

/** One row of a batch scan. score == -1 and label == "ERROR" for unreadable files. */
public record BatchScanResult(
        String filename,
        String type,
        long sizeBytes,
        int score,
        String label,
        String payloadHint,
        int findingCount,
        long scanDurationMs
) {
}
