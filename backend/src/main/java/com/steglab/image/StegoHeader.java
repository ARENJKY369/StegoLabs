package com.steglab.image;

import java.nio.ByteBuffer;

/**
 * The 15-byte plaintext header embedded sequentially (1 bit per channel,
 * RGB raster order) in the first {@link #SLOTS} channel slots of a carrier.
 *
 * It holds only what an extractor must know before decryption:
 * placement mode, bit depth, channel mask and payload lengths. The
 * payload itself is always an AES-256-GCM envelope.
 *
 * Layout: magic 'S','L' (2) | version(1) | placement(1) | flags(1)
 *         | bitDepth(1) | channelMask(1) | realLen(4) | decoyLen(4)
 */
public record StegoHeader(
        int placement,      // 0 = sequential, 1 = scattered
        boolean hasDecoy,
        int bitDepth,       // 1, 2 or 4
        int channelMask,    // bit0=R, bit1=G, bit2=B
        int realLength,     // bytes of the real envelope
        int decoyLength     // bytes of the decoy envelope, 0 if none
) {

    public static final int BYTES = 15;
    /** Header is always 1 bit per channel slot → 120 reserved slots. */
    public static final int SLOTS = BYTES * 8;

    public static final int PLACEMENT_SEQUENTIAL = 0;
    public static final int PLACEMENT_SCATTERED = 1;

    private static final byte MAGIC_0 = 'S';
    private static final byte MAGIC_1 = 'L';
    private static final byte VERSION = 1;
    private static final byte FLAG_DECOY = 0x01;

    public byte[] toBytes() {
        ByteBuffer buf = ByteBuffer.allocate(BYTES);
        buf.put(MAGIC_0).put(MAGIC_1).put(VERSION)
           .put((byte) placement)
           .put(hasDecoy ? FLAG_DECOY : 0)
           .put((byte) bitDepth)
           .put((byte) channelMask)
           .putInt(realLength)
           .putInt(decoyLength);
        return buf.array();
    }

    /** Parse, returning null when the bytes are not a StegLab header. */
    public static StegoHeader parse(byte[] bytes) {
        if (bytes == null || bytes.length < BYTES) return null;
        if (bytes[0] != MAGIC_0 || bytes[1] != MAGIC_1 || bytes[2] != VERSION) return null;
        ByteBuffer buf = ByteBuffer.wrap(bytes);
        buf.position(3);
        int placement = buf.get();
        boolean decoy = (buf.get() & FLAG_DECOY) != 0;
        int bitDepth = buf.get();
        int channelMask = buf.get();
        int realLen = buf.getInt();
        int decoyLen = buf.getInt();
        if (placement < 0 || placement > 1) return null;
        if (bitDepth != 1 && bitDepth != 2 && bitDepth != 4) return null;
        if (channelMask < 1 || channelMask > 7) return null;
        if (realLen <= 0 || realLen > 64 * 1024 * 1024) return null;
        if (decoyLen < 0 || decoyLen > 64 * 1024 * 1024) return null;
        if (decoy == (decoyLen == 0)) return null;
        return new StegoHeader(placement, decoy, bitDepth, channelMask, realLen, decoyLen);
    }
}
