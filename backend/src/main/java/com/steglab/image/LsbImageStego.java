package com.steglab.image;

import com.steglab.crypto.PasswordKdf;
import com.steglab.exception.ApiException;

import java.awt.image.BufferedImage;

/**
 * Core LSB substitution engine.
 *
 * A carrier exposes width*height*3 "channel slots" (R, G, B of each pixel
 * in raster order). The first {@link StegoHeader#SLOTS} slots always hold
 * the plaintext header at 1 bit per slot. Payload bits live in the
 * remaining slots that match the chosen channel mask, {@code bitDepth}
 * bits per slot, in sequential or password-scattered order.
 *
 * All capacity arithmetic uses long — a 50 MB BMP has ~52 million slots.
 */
public final class LsbImageStego {

    public static final int CHANNEL_R = 0b001;
    public static final int CHANNEL_G = 0b010;
    public static final int CHANNEL_B = 0b100;

    private LsbImageStego() {
    }

    /** Usable payload capacity in bytes for the given settings. */
    public static long capacityBytes(BufferedImage image, int bitDepth, int channelMask) {
        long eligible = eligibleSlots(image, channelMask);
        return eligible * bitDepth / 8;
    }

    /** Eligible payload slots: all masked channels, minus the header reserve. */
    public static long eligibleSlots(BufferedImage image, int channelMask) {
        long totalPerChannel = (long) image.getWidth() * image.getHeight();
        long channels = Integer.bitCount(channelMask);
        long total = totalPerChannel * channels;
        // Header occupies the first SLOTS slots of the full RGB sequence;
        // conservatively reserve that many from the eligible pool.
        return Math.max(0, total - StegoHeader.SLOTS);
    }

    /**
     * Embed header + one or two sealed envelopes into a copy of {@code carrier}.
     *
     * When a decoy is present the eligible slot universe is split into two
     * deterministic halves — real in the first, decoy in the second — and
     * each half is scattered under its *own* password. That way the decoy
     * holder can reconstruct their slot order without ever knowing the real
     * password (and vice versa).
     */
    public static BufferedImage embed(BufferedImage carrier,
                                      StegoHeader header,
                                      byte[] realEnvelope,
                                      byte[] decoyEnvelope,
                                      char[] realPassword,
                                      char[] decoyPassword) {
        BufferedImage stego = copy(carrier);
        int width = stego.getWidth();

        // 1. Header: first 120 slots, full RGB order, 1 bit per slot.
        byte[] headerBytes = header.toBytes();
        for (int bit = 0; bit < StegoHeader.SLOTS; bit++) {
            int value = (headerBytes[bit >> 3] >> (7 - (bit & 7))) & 1;
            writeSlotBits(stego, width, bit, 1, value);
        }

        // 2. Payload region(s).
        int universe = eligibleUniverse(stego, header.channelMask());
        boolean decoy = header.hasDecoy();
        int regionA = decoy ? universe / 2 : universe;

        codePayload(stego, header, realEnvelope, 0, regionA, realPassword, true);
        if (decoy) {
            codePayload(stego, header, decoyEnvelope,
                    regionA, universe - regionA, decoyPassword, true);
        }
        return stego;
    }

    /**
     * Extract one envelope. {@code wantDecoy} selects the region; the
     * password only needs to match the message being revealed.
     */
    public static byte[] extractEnvelope(BufferedImage image,
                                         StegoHeader header,
                                         boolean wantDecoy,
                                         char[] password) {
        if (wantDecoy && !header.hasDecoy()) {
            throw ApiException.badRequest("NO_DECOY",
                    "This file does not contain a decoy message.");
        }
        int universe = eligibleUniverse(image, header.channelMask());
        int regionA = header.hasDecoy() ? universe / 2 : universe;

        int length = wantDecoy ? header.decoyLength() : header.realLength();
        int offset = wantDecoy ? regionA : 0;
        int size = wantDecoy ? universe - regionA : regionA;

        byte[] out = new byte[length];
        codeRegion(image, header, out, offset, size, password, false);
        return out;
    }

    /** Embed ({@code write=true}) one payload into one slot region. */
    private static void codePayload(BufferedImage img, StegoHeader header, byte[] payload,
                                    int regionOffset, int regionSize,
                                    char[] seedPassword, boolean write) {
        if (payload.length == 0) return;
        long slotsNeeded = slotsFor(payload.length, header.bitDepth());
        if (slotsNeeded > regionSize) {
            throw ApiException.badRequest("CAPACITY_EXCEEDED",
                    "The message no longer fits this image with the chosen settings.");
        }
        codeRegion(img, header, payload, regionOffset, regionSize, seedPassword, write);
    }

    /** Shared read/write walk over a slot region in sequential or scattered order. */
    private static void codeRegion(BufferedImage img, StegoHeader header, byte[] payload,
                                   int regionOffset, int regionSize,
                                   char[] seedPassword, boolean write) {
        int width = img.getWidth();
        int height = img.getHeight();
        long totalBits = (long) payload.length * 8;
        long slotsNeeded = slotsFor(payload.length, header.bitDepth());
        if (slotsNeeded > regionSize) {
            throw ApiException.badRequest("NO_HIDDEN_DATA",
                    "No hidden message found in this file.");
        }

        boolean scattered = header.placement() == StegoHeader.PLACEMENT_SCATTERED;
        long seed = scattered ? PasswordKdf.scatterSeed(seedPassword) : 0;
        SlotOrder order = new SlotOrder(regionSize, scattered, seed);

        long bitCursor = 0;
        for (long s = 0; s < slotsNeeded; s++) {
            int logical = regionOffset + order.next();
            int slot = logicalToSlot(logical, width, height, header.channelMask());
            if (write) {
                int chunk = 0;
                for (int b = 0; b < header.bitDepth(); b++) {
                    int bitValue = 0;
                    if (bitCursor < totalBits) {
                        int idx = (int) (bitCursor >> 3);
                        bitValue = (payload[idx] >> (7 - (int) (bitCursor & 7))) & 1;
                    }
                    chunk = (chunk << 1) | bitValue;
                    bitCursor++;
                }
                writeSlotBits(img, width, slot, header.bitDepth(), chunk);
            } else {
                int chunk = readSlotBits(img, width, slot, header.bitDepth());
                for (int b = header.bitDepth() - 1; b >= 0; b--) {
                    if (bitCursor < totalBits) {
                        int bitValue = (chunk >> b) & 1;
                        int idx = (int) (bitCursor >> 3);
                        payload[idx] |= (byte) (bitValue << (7 - (int) (bitCursor & 7)));
                        bitCursor++;
                    }
                }
            }
        }
    }

    private static long slotsFor(int payloadBytes, int bitDepth) {
        long bits = (long) payloadBytes * 8;
        return (bits + bitDepth - 1) / bitDepth;
    }

    /** Read the plaintext header, or null if this image carries nothing. */
    public static StegoHeader readHeader(BufferedImage image) {
        int width = image.getWidth();
        long totalSlots = (long) width * image.getHeight() * 3;
        if (totalSlots < StegoHeader.SLOTS) return null;
        byte[] headerBytes = new byte[StegoHeader.BYTES];
        for (int bit = 0; bit < StegoHeader.SLOTS; bit++) {
            int value = readSlotBits(image, width, bit, 1);
            headerBytes[bit >> 3] |= (byte) (value << (7 - (bit & 7)));
        }
        return StegoHeader.parse(headerBytes);
    }

    // ------------------------------------------------------------------
    // Slot addressing
    //
    // Global slot index: pixel*3 + channel (0=R, 1=G, 2=B), raster order.
    // "Logical" payload indices count only slots that (a) come after the
    // header reserve and (b) belong to a masked channel.
    // ------------------------------------------------------------------

    /** Count of eligible payload slots for this image and channel mask. */
    private static int eligibleUniverse(BufferedImage img, int channelMask) {
        long totalPixels = (long) img.getWidth() * img.getHeight();
        int channels = Integer.bitCount(channelMask);
        long headerPixels = (StegoHeader.SLOTS + 2) / 3; // pixels fully reserved
        long eligible = (totalPixels - headerPixels) * channels;
        if (eligible < 0) eligible = 0;
        if (eligible > Integer.MAX_VALUE) eligible = Integer.MAX_VALUE;
        return (int) eligible;
    }

    /** Map a logical payload index to a global channel slot index. */
    private static int logicalToSlot(int logical, int width, int height, int channelMask) {
        int channels = Integer.bitCount(channelMask);
        int headerPixels = (StegoHeader.SLOTS + 2) / 3;
        int pixel = headerPixels + logical / channels;
        int nth = logical % channels;
        int channel = nthMaskedChannel(channelMask, nth);
        return pixel * 3 + channel;
    }

    private static int nthMaskedChannel(int mask, int nth) {
        int seen = 0;
        for (int c = 0; c < 3; c++) {
            if ((mask & (1 << c)) != 0) {
                if (seen == nth) return c;
                seen++;
            }
        }
        throw new IllegalStateException("Bad channel mask " + mask);
    }

    private static void writeSlotBits(BufferedImage img, int width, int slot, int bits, int value) {
        int pixel = slot / 3;
        int channel = slot % 3;
        int x = pixel % width;
        int y = pixel / width;
        int rgb = img.getRGB(x, y);
        int shift = (2 - channel) * 8; // R=16, G=8, B=0
        int channelValue = (rgb >> shift) & 0xFF;
        int mask = (1 << bits) - 1;
        channelValue = (channelValue & ~mask) | (value & mask);
        rgb = (rgb & ~(0xFF << shift)) | (channelValue << shift);
        img.setRGB(x, y, rgb);
    }

    private static int readSlotBits(BufferedImage img, int width, int slot, int bits) {
        int pixel = slot / 3;
        int channel = slot % 3;
        int x = pixel % width;
        int y = pixel / width;
        int rgb = img.getRGB(x, y);
        int shift = (2 - channel) * 8;
        return (rgb >> shift) & ((1 << bits) - 1);
    }

    private static BufferedImage copy(BufferedImage src) {
        BufferedImage out = new BufferedImage(
                src.getWidth(), src.getHeight(), BufferedImage.TYPE_INT_RGB);
        int[] row = new int[src.getWidth()];
        for (int y = 0; y < src.getHeight(); y++) {
            src.getRGB(0, y, src.getWidth(), 1, row, 0, src.getWidth());
            out.setRGB(0, y, src.getWidth(), 1, row, 0, src.getWidth());
        }
        return out;
    }

    /** Parse a channel string like "RGB", "RG", "B" into a mask. */
    public static int parseChannelMask(String channels) {
        if (channels == null || channels.isBlank()) return 0b111;
        int mask = 0;
        for (char c : channels.toUpperCase().toCharArray()) {
            switch (c) {
                case 'R' -> mask |= CHANNEL_R;
                case 'G' -> mask |= CHANNEL_G;
                case 'B' -> mask |= CHANNEL_B;
                default -> throw ApiException.badRequest("BAD_CHANNELS",
                        "Channels must be some combination of R, G and B.");
            }
        }
        return mask;
    }
}
