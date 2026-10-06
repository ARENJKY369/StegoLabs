package com.steglab.core;

/**
 * Magic-byte identification for every format StegLab understands.
 * Detection is always done on content, never on filename extension.
 */
public enum FileSignature {

    PNG("PNG image", "png", new int[]{0x89, 0x50, 0x4E, 0x47}),
    JPEG("JPEG image", "jpg", new int[]{0xFF, 0xD8, 0xFF}),
    BMP("Bitmap image", "bmp", new int[]{0x42, 0x4D}),
    WAV("WAV audio (RIFF)", "wav", new int[]{0x52, 0x49, 0x46, 0x46}),
    PDF("PDF document", "pdf", new int[]{0x25, 0x50, 0x44, 0x46}),
    ZIP("ZIP archive", "zip", new int[]{0x50, 0x4B, 0x03, 0x04}),
    EXE("Windows executable (PE)", "exe", new int[]{0x4D, 0x5A}),
    ELF("ELF binary (Linux/Android)", "elf", new int[]{0x7F, 0x45, 0x4C, 0x46}),
    GIF("GIF image", "gif", new int[]{0x47, 0x49, 0x46, 0x38}),
    UNKNOWN("Unknown", "", new int[]{});

    private final String description;
    private final String extension;
    private final int[] magic;

    FileSignature(String description, String extension, int[] magic) {
        this.description = description;
        this.extension = extension;
        this.magic = magic;
    }

    public String description() {
        return description;
    }

    public String extension() {
        return extension;
    }

    public int[] magic() {
        return magic;
    }

    /** Human-readable hex of the magic bytes, e.g. "89 50 4E 47". */
    public String magicHex() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < magic.length; i++) {
            if (i > 0) sb.append(' ');
            sb.append(String.format("%02X", magic[i]));
        }
        return sb.toString();
    }

    /** Identify a file from its leading bytes. */
    public static FileSignature detect(byte[] head) {
        if (head == null) return UNKNOWN;
        for (FileSignature sig : values()) {
            if (sig == UNKNOWN) continue;
            if (matchesAt(head, 0, sig.magic)) {
                return sig;
            }
        }
        return UNKNOWN;
    }

    /** True if {@code data} contains this signature starting at {@code offset}. */
    public boolean matchesAt(byte[] data, int offset) {
        return matchesAt(data, offset, magic);
    }

    private static boolean matchesAt(byte[] data, int offset, int[] magic) {
        if (magic.length == 0 || data.length < offset + magic.length) return false;
        for (int i = 0; i < magic.length; i++) {
            if ((data[offset + i] & 0xFF) != magic[i]) return false;
        }
        return true;
    }
}
