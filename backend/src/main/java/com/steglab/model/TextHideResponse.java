package com.steglab.model;

/** Response of POST /api/hide/text — the stego text plus its stats. */
public record TextHideResponse(
        String text,
        String technique,        // "zeroWidth" | "whitespace"
        String placementMode,    // append | buried | scattered (zeroWidth only)
        int invisibleChars,      // characters of hidden alphabet in the output
        int coverChars,
        int messageBytes,
        int bytesEmbedded,       // header + envelope(s)
        boolean decoy
) {
}
