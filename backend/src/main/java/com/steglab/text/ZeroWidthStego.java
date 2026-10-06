package com.steglab.text;

import com.steglab.image.StegoHeader;

/**
 * Encodes arbitrary bytes as strings of invisible Unicode characters.
 *
 * Four code points carry 2 bits each:
 *   U+200B ZERO WIDTH SPACE       = 00
 *   U+200C ZERO WIDTH NON-JOINER  = 01
 *   U+2060 WORD JOINER            = 10
 *   U+200D ZERO WIDTH JOINER      = 11
 *
 * Decoding never needs to know where the characters were placed in the
 * cover text: it simply filters the alphabet in reading order. That makes
 * the placement strategy (append / buried / scattered) a pure presentation
 * concern chosen at hide time.
 */
public final class ZeroWidthStego {

    /** Alphabet, index = symbol value. Fixed forever. */
    public static final char[] SYMBOLS = {0x200B, 0x200C, 0x2060, 0x200D};
    public static final int BITS_PER_SYMBOL = 2;

    private ZeroWidthStego() {
    }

    public static boolean isAlphabet(char c) {
        return c == SYMBOLS[0] || c == SYMBOLS[1] || c == SYMBOLS[2] || c == SYMBOLS[3];
    }

    public static int valueOf(char c) {
        if (c == SYMBOLS[0]) return 0;
        if (c == SYMBOLS[1]) return 1;
        if (c == SYMBOLS[2]) return 2;
        if (c == SYMBOLS[3]) return 3;
        return -1;
    }

    /** Bytes → invisible string (2 bits per character, MSB first). */
    public static String encode(byte[] data) {
        StringBuilder out = new StringBuilder(data.length * 4);
        for (byte b : data) {
            for (int shift = 6; shift >= 0; shift -= 2) {
                out.append(SYMBOLS[(b >> shift) & 0b11]);
            }
        }
        return out.toString();
    }

    /** Invisible string (or whole cover text) → decoded bytes. */
    public static byte[] decode(String text) {
        StringBuilder symbols = new StringBuilder(text.length());
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (isAlphabet(c)) symbols.append(c);
        }
        byte[] out = new byte[symbols.length() * BITS_PER_SYMBOL / 8];
        for (int i = 0; i < out.length; i++) {
            int b = 0;
            for (int s = 0; s < 4; s++) {
                b = (b << 2) | valueOf(symbols.charAt(i * 4 + s));
            }
            out[i] = (byte) b;
        }
        return out;
    }

    /**
     * Blend an invisible stream into a cover text.
     *
     * append    — everything at the very end (simplest, safest against
     *             copy-paste boundaries that cut mid-message).
     * buried    — inserted at the middle word boundary, so a casual
     *             scroll-past shows beginning and end as normal prose.
     * scattered — drip-fed between words across the whole text.
     */
    public static String place(String cover, String stream, String mode) {
        if (stream.isEmpty()) return cover;
        return switch (mode == null ? "append" : mode) {
            case "append" -> cover + stream;
            case "buried" -> {
                int cut = middleWordBoundary(cover);
                yield cover.substring(0, cut) + stream + cover.substring(cut);
            }
            case "scattered" -> scatter(cover, stream);
            default -> throw com.steglab.exception.ApiException.badRequest("BAD_MODE",
                    "Placement must be 'append', 'buried' or 'scattered'.");
        };
    }

    private static int middleWordBoundary(String cover) {
        int mid = cover.length() / 2;
        // Prefer the first space after the midpoint.
        for (int i = mid; i < cover.length(); i++) {
            if (cover.charAt(i) == ' ') return i + 1;
        }
        for (int i = mid - 1; i >= 0; i--) {
            if (cover.charAt(i) == ' ') return i + 1;
        }
        return cover.length(); // no whitespace at all — append
    }

    private static String scatter(String cover, String stream) {
        java.util.List<Integer> gaps = new java.util.ArrayList<>();
        for (int i = 0; i < cover.length(); i++) {
            if (cover.charAt(i) == ' ') gaps.add(i + 1);
        }
        if (gaps.size() < 4) return cover + stream; // nothing to scatter into

        StringBuilder out = new StringBuilder(cover.length() + stream.length());
        int perGap = stream.length() / gaps.size();
        int extra = stream.length() % gaps.size();
        int cursor = 0;
        int streamPos = 0;
        for (int g = 0; g < gaps.size(); g++) {
            int cut = gaps.get(g);
            out.append(cover, cursor, cut);
            int take = perGap + (g < extra ? 1 : 0);
            out.append(stream, streamPos, streamPos + take);
            streamPos += take;
            cursor = cut;
        }
        out.append(cover, cursor, cover.length());
        return out.toString();
    }

    /** Read just the StegLab header out of any cover text, or null. */
    public static StegoHeader probeHeader(String text) {
        byte[] prefix = decodePrefix(text, StegoHeader.BYTES);
        return StegoHeader.parse(prefix);
    }

    private static byte[] decodePrefix(String text, int bytes) {
        byte[] out = new byte[bytes];
        int symbolsNeeded = bytes * 4;
        int found = 0;
        for (int i = 0; i < text.length() && found < symbolsNeeded; i++) {
            char c = text.charAt(i);
            if (!isAlphabet(c)) continue;
            int byteIdx = found / 4;
            out[byteIdx] = (byte) ((out[byteIdx] << 2) | valueOf(c));
            found++;
        }
        return found < symbolsNeeded ? new byte[0] : out;
    }
}
