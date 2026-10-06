package com.steglab.model;

import java.util.List;

/**
 * Result of payload classification. {@code mode} is "blind" (structure
 * only, no password) or "authenticated" (after successful decryption).
 * {@code contentVerdict} is only present in authenticated mode and is
 * one of: PLAIN_TEXT_MESSAGE, STRUCTURED_FILE,
 * SCRIPT_WITH_SUSPICIOUS_INDICATORS, EXECUTABLE_BINARY, UNKNOWN_BINARY.
 */
public record PayloadClassification(
        String mode,
        String structuralType,
        double entropy,
        double confidence,
        long offset,
        String contentVerdict,
        List<String> matchedKeywords,
        String encodingDetected
) {
}
