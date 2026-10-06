package com.steglab.model;

/**
 * One triggered detection signal.
 * {@code detail} is plain English for humans; {@code technical} is the
 * raw measured value for analysts (shown in monospace in the UI).
 */
public record ScanFinding(
        String id,          // stable signal id, e.g. "trailing_bytes"
        String name,        // human name, e.g. "Trailing bytes after end marker"
        int points,         // contribution to the 0-100 risk score
        String detail,      // plain-English explanation of what was found
        String technical,   // raw value, e.g. "z=-4.21 @ 8.3% prefix (G channel)"
        boolean deterministic // structural checks are facts; statistics are hints
) {
}
