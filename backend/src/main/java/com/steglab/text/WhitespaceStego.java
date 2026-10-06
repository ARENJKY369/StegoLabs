package com.steglab.text;

import com.steglab.image.StegoHeader;

/**
 * Legacy whitespace encoding: 1 bit per character, space = 0, tab = 1,
 * in a stream appended after the cover text.
 *
 * This is the classic "SNOW"-family technique. It survives copy-paste in
 * most editors but is trivially destroyed by editors that trim trailing
 * whitespace (e.g. many chat apps) — which is exactly why the UI labels
 * it "legacy": it's here for education and interoperability testing.
 */
public final class WhitespaceStego {

    public static final char ZERO = ' ';
    public static final char ONE = '\t';

    private WhitespaceStego() {
    }

    /** Bytes → whitespace stream (8 characters per byte, MSB first). */
    public static String encode(byte[] data) {
        StringBuilder out = new StringBuilder(data.length * 8);
        for (byte b : data) {
            for (int shift = 7; shift >= 0; shift--) {
                out.append(((b >> shift) & 1) == 0 ? ZERO : ONE);
            }
        }
        return out.toString();
    }

    /** Decode the whitespace stream that trails a cover text. */
    public static byte[] decode(String text) {
        String stream = trailingStream(text);
        byte[] out = new byte[stream.length() / 8];
        for (int i = 0; i < out.length; i++) {
            int b = 0;
            for (int s = 0; s < 8; s++) {
                b = (b << 1) | (stream.charAt(i * 8 + s) == ONE ? 1 : 0);
            }
            out[i] = (byte) b;
        }
        return out;
    }

    /** The maximal trailing run of spaces/tabs at the very end (after ignoring newlines). */
    public static String trailingStream(String text) {
        int end = text.length();
        while (end > 0 && (text.charAt(end - 1) == '\n' || text.charAt(end - 1) == '\r')) {
            end--;
        }
        int start = end;
        while (start > 0) {
            char c = text.charAt(start - 1);
            if (c != ZERO && c != ONE) break;
            start--;
        }
        return text.substring(start, end);
    }

    /** Append a whitespace stream to a cover text on its own line. */
    public static String place(String cover, String stream) {
        String trimmed = cover.replaceAll("\\s+$", "");
        return trimmed + "\n" + stream;
    }

    /** Header probe: decode the first 15 bytes of the trailing stream. */
    public static StegoHeader probeHeader(String text) {
        String stream = trailingStream(text);
        int bits = Math.min(stream.length(), StegoHeader.BYTES * 8);
        if (bits < StegoHeader.BYTES * 8) return null;
        byte[] out = new byte[StegoHeader.BYTES];
        for (int i = 0; i < out.length; i++) {
            int b = 0;
            for (int s = 0; s < 8; s++) {
                b = (b << 1) | (stream.charAt(i * 8 + s) == ONE ? 1 : 0);
            }
            out[i] = (byte) b;
        }
        return StegoHeader.parse(out);
    }
}
