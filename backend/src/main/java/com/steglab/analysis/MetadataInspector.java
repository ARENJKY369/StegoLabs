package com.steglab.analysis;

import com.steglab.core.Entropy;
import com.steglab.core.FileSignature;
import com.steglab.model.ScanFinding;

import java.nio.charset.StandardCharsets;

/**
 * Signal 7: metadata anomaly. Walks the container's own structure
 * (PNG chunks, JPEG segments, WAV LIST chunks) and flags metadata
 * fields that are unusually large (>1 KB) or look like binary data
 * smuggled into a text field.
 */
public final class MetadataInspector {

    private static final int LARGE = 1024;

    private MetadataInspector() {
    }

    public static ScanFinding inspect(byte[] data, FileSignature type) {
        return switch (type) {
            case PNG -> inspectPng(data);
            case JPEG -> inspectJpeg(data);
            case WAV -> inspectWav(data);
            default -> null;
        };
    }

    // ---- PNG: length(4) type(4) data crc(4) chunks -----------------------

    private static ScanFinding inspectPng(byte[] data) {
        int pos = 8;
        while (pos + 12 <= data.length) {
            long length = readBeUInt32(data, pos);
            if (length < 0 || pos + 12 + length > data.length) break;
            String chunkType = new String(data, pos + 4, 4, StandardCharsets.US_ASCII);
            boolean ancillary = Character.isLowerCase(chunkType.charAt(0));

            if (ancillary && !chunkType.equals("tRNS") && !chunkType.equals("gAMA")
                    && !chunkType.equals("pHYs") && !chunkType.equals("sRGB")
                    && !chunkType.equals("cHRM") && !chunkType.equals("iCCP")) {
                if (length > LARGE) {
                    return finding("PNG chunk '" + chunkType + "' carries "
                                    + length + " bytes — far beyond any normal caption or comment.",
                            chunkType + " length=" + length + " B at offset " + pos);
                }
                if ((chunkType.equals("tEXt") || chunkType.equals("zTXt") || chunkType.equals("iTXt"))
                        && length > 32) {
                    byte[] slice = new byte[(int) length];
                    System.arraycopy(data, pos + 8, slice, 0, (int) length);
                    if (Entropy.printableRatio(slice) < 0.7) {
                        return finding("PNG text chunk '" + chunkType + "' contains mostly "
                                        + "non-printable bytes — binary data is hiding in a text field.",
                                chunkType + " printable=" + Math.round(Entropy.printableRatio(slice) * 100)
                                        + "% length=" + length + " B");
                    }
                }
            }
            if (chunkType.equals("IEND")) break;
            pos += 12 + length;
        }
        return null;
    }

    // ---- JPEG: FF marker segments ----------------------------------------

    private static ScanFinding inspectJpeg(byte[] data) {
        int pos = 2;
        while (pos + 4 <= data.length) {
            if ((data[pos] & 0xFF) != 0xFF) break;
            int marker = data[pos + 1] & 0xFF;
            if (marker == 0xD8 || marker == 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
                pos += 2;
                continue;
            }
            if (marker == 0xDA || marker == 0xD9) break; // scan data / end
            int length = ((data[pos + 2] & 0xFF) << 8) | (data[pos + 3] & 0xFF);
            if (length < 2 || pos + 2 + length > data.length) break;

            boolean isComment = marker == 0xFE;
            boolean isApp = marker >= 0xE0 && marker <= 0xEF;
            // EXIF (APP1) and ICC (APP2) are routinely large in real photos;
            // flag only clearly unusual segments to avoid crying wolf.
            boolean routinelyLarge = marker == 0xE1 || marker == 0xE2;
            if ((isComment && length > LARGE)
                    || (isApp && !routinelyLarge && length > 4 * LARGE)) {
                return finding("JPEG " + (isComment ? "comment" : "APP" + (marker - 0xE0))
                                + " segment holds " + length + " bytes — normal captions are a "
                                + "sentence, not kilobytes.",
                        String.format("marker=0xFF%02X length=%d B offset=%d", marker, length, pos));
            }
            pos += 2 + length;
        }
        return null;
    }

    // ---- WAV: LIST/INFO and unknown chunks --------------------------------

    private static ScanFinding inspectWav(byte[] data) {
        int pos = 12; // RIFF(4) size(4) WAVE(4)
        while (pos + 8 <= data.length) {
            String id = new String(data, pos, 4, StandardCharsets.US_ASCII);
            long length = CarrierStructure.readLeUInt32(data, pos + 4);
            if (length < 0 || pos + 8 + length > data.length) break;
            boolean standard = id.equals("fmt ") || id.equals("data") || id.equals("fact");
            if (!standard && length > LARGE) {
                return finding("WAV chunk '" + id.trim() + "' carries " + length
                                + " bytes of non-audio data.",
                        "chunk=" + id + " length=" + length + " B offset=" + pos);
            }
            pos += 8 + length + (length % 2); // chunks are word-aligned
        }
        return null;
    }

    private static ScanFinding finding(String detail, String technical) {
        return new ScanFinding("metadata_anomaly", "Metadata anomaly", 15,
                detail, technical, true);
    }

    private static long readBeUInt32(byte[] data, int offset) {
        return (data[offset] & 0xFFL) << 24
                | (data[offset + 1] & 0xFFL) << 16
                | (data[offset + 2] & 0xFFL) << 8
                | (data[offset + 3] & 0xFFL);
    }
}
