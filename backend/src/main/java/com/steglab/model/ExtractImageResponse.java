package com.steglab.model;

import java.util.List;

/** Response of POST /api/extract/image. */
public record ExtractImageResponse(
        String message,
        String placementMode,          // "sequential" | "scattered"
        String revealMode,             // "real" | "decoy" — which message this is
        boolean decoyPresent,          // header advertises a second message
        int bitDepth,
        String channels,
        PayloadClassification payloadClassification, // blind view of the raw envelope
        String contentVerdict,         // authenticated verdict of the plaintext
        List<String> matchedKeywords,
        double entropy                 // entropy of the decrypted plaintext
) {
}
