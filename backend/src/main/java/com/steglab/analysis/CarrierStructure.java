package com.steglab.analysis;

import com.steglab.core.FileSignature;

/**
 * Container-format structure: where does the carrier officially end?
 * Everything after that offset is "trailing data" — the single most
 * common (and most reliably detected) hiding technique.
 */
public final class CarrierStructure {

    public record Trailing(long endOfCarrier, int trailingBytes) {
    }

    private CarrierStructure() {
    }

    /** Returns null when the format has no defined end marker. */
    public static Trailing findTrailing(byte[] data, FileSignature type) {
        switch (type) {
            case PNG -> {
                // IEND chunk: 4-byte length (0) + "IEND" + 4-byte CRC.
                int idx = lastIndexOf(data, new byte[]{'I', 'E', 'N', 'D'});
                if (idx < 0) return null;
                long end = idx + 4 + 4; // IEND + CRC
                return trailingFrom(data, end);
            }
            case JPEG -> {
                // Final FF D9 end-of-image marker.
                int idx = lastIndexOf(data, new byte[]{(byte) 0xFF, (byte) 0xD9});
                if (idx < 0) return null;
                return trailingFrom(data, idx + 2L);
            }
            case BMP -> {
                if (data.length < 6) return null;
                long declared = readLeUInt32(data, 2);
                if (declared <= 0 || declared > data.length) return null;
                return trailingFrom(data, declared);
            }
            case WAV -> {
                if (data.length < 8) return null;
                long declared = readLeUInt32(data, 4) + 8;
                if (declared <= 0 || declared > data.length) return null;
                return trailingFrom(data, declared);
            }
            case GIF -> {
                // GIF trailer byte 0x3B.
                int idx = lastIndexOf(data, new byte[]{0x3B});
                if (idx < 0) return null;
                return trailingFrom(data, idx + 1L);
            }
            default -> {
                return null;
            }
        }
    }

    private static Trailing trailingFrom(byte[] data, long end) {
        if (end >= data.length) return new Trailing(end, 0);
        return new Trailing(end, (int) (data.length - end));
    }

    static int lastIndexOf(byte[] haystack, byte[] needle) {
        outer:
        for (int i = haystack.length - needle.length; i >= 0; i--) {
            for (int j = 0; j < needle.length; j++) {
                if (haystack[i + j] != needle[j]) continue outer;
            }
            return i;
        }
        return -1;
    }

    static long readLeUInt32(byte[] data, int offset) {
        return (data[offset] & 0xFFL)
                | (data[offset + 1] & 0xFFL) << 8
                | (data[offset + 2] & 0xFFL) << 16
                | (data[offset + 3] & 0xFFL) << 24;
    }
}
