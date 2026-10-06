package com.steglab.model;

import java.util.List;

/** Response of POST /api/extract/text. */
public record TextExtractResponse(
        String message,
        String technique,
        String placementMode,      // from the header: sequential | scattered
        String revealMode,         // real | decoy
        boolean decoyPresent,
        PayloadClassification payloadClassification,
        String contentVerdict,
        List<String> matchedKeywords,
        double entropy
) {
}
