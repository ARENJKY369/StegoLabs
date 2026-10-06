package com.steglab.audio;

import com.steglab.crypto.PasswordKdf;
import com.steglab.exception.ApiException;
import com.steglab.image.SlotOrder;
import com.steglab.image.StegoHeader;

/**
 * LSB substitution over interleaved PCM samples — the audio analogue of
 * {@link com.steglab.image.LsbImageStego}.
 *
 * A carrier exposes {@code frames × channels} "sample slots" (interleaved,
 * e.g. L,R,L,R in stereo). The first {@link StegoHeader#SLOTS} slots always
 * hold the plaintext header at 1 bit per slot. Payload bits live in the
 * frames after the header reserve, on slots that match the chosen channel
 * mask, {@code bitDepth} bits per slot, in sequential or scattered order.
 *
 * For 16-bit samples only the low byte is ever touched; for 8-bit samples
 * the single byte is touched. Everything else in the file is preserved
 * byte-for-byte.
 */
public final class LsbAudioStego {

    public static final int CHANNEL_L = 0b01;
    public static final int CHANNEL_R = 0b10;

    private LsbAudioStego() {
    }

    /** Usable payload capacity in bytes for the given settings. */
    public static long capacityBytes(WavCodec.Wav wav, int bitDepth, int channelMask) {
        return (long) eligibleUniverse(wav, channelMask) * bitDepth / 8;
    }

    /** Frames reserved by the header (the header occupies whole frames). */
    public static int headerFrames(WavCodec.Wav wav) {
        return (StegoHeader.SLOTS + wav.channels() - 1) / wav.channels();
    }

    /**
     * Embed header + one or two sealed envelopes. Works on a copy of the
     * container byte array, returned for the caller to serialise.
     */
    public static byte[] embed(WavCodec.Wav carrier,
                               StegoHeader header,
                               byte[] realEnvelope,
                               byte[] decoyEnvelope,
                               char[] realPassword,
                               char[] decoyPassword) {
        byte[] stego = carrier.container().clone();
        WavCodec.Wav out = new WavCodec.Wav(stego, carrier.dataOffset(), carrier.dataLength(),
                carrier.channels(), carrier.sampleRate(), carrier.bitsPerSample());

        // 1. Header: first 120 slots, interleaved channel order, 1 bit per slot.
        byte[] headerBytes = header.toBytes();
        for (int bit = 0; bit < StegoHeader.SLOTS; bit++) {
            int value = (headerBytes[bit >> 3] >> (7 - (bit & 7))) & 1;
            writeSlotBits(out, bit, 1, value);
        }

        // 2. Payload region(s) — decoy splits the universe exactly like images.
        int universe = eligibleUniverse(out, header.channelMask());
        boolean decoy = header.hasDecoy();
        int regionA = decoy ? universe / 2 : universe;

        codePayload(out, header, realEnvelope, 0, regionA, realPassword);
        if (decoy) {
            codePayload(out, header, decoyEnvelope, regionA, universe - regionA, decoyPassword);
        }
        return stego;
    }

    /** Extract one envelope. {@code wantDecoy} selects the region. */
    public static byte[] extractEnvelope(WavCodec.Wav wav,
                                         StegoHeader header,
                                         boolean wantDecoy,
                                         char[] password) {
        if (wantDecoy && !header.hasDecoy()) {
            throw ApiException.badRequest("NO_DECOY",
                    "This file does not contain a decoy message.");
        }
        int universe = eligibleUniverse(wav, header.channelMask());
        int regionA = header.hasDecoy() ? universe / 2 : universe;

        int length = wantDecoy ? header.decoyLength() : header.realLength();
        int offset = wantDecoy ? regionA : 0;
        int size = wantDecoy ? universe - regionA : regionA;

        byte[] out = new byte[length];
        codeRegion(wav, header, out, offset, size, password, false);
        return out;
    }

    /** Read the plaintext header, or null if this file carries nothing. */
    public static StegoHeader readHeader(WavCodec.Wav wav) {
        if (wav.totalSamples() < StegoHeader.SLOTS) return null;
        byte[] headerBytes = new byte[StegoHeader.BYTES];
        for (int bit = 0; bit < StegoHeader.SLOTS; bit++) {
            int value = readSlotBits(wav, bit, 1);
            headerBytes[bit >> 3] |= (byte) (value << (7 - (bit & 7)));
        }
        return StegoHeader.parse(headerBytes);
    }

    // ------------------------------------------------------------------
    // Region walk — identical shape to the image engine.
    // ------------------------------------------------------------------

    private static void codePayload(WavCodec.Wav wav, StegoHeader header, byte[] payload,
                                    int regionOffset, int regionSize, char[] seedPassword) {
        if (payload.length == 0) return;
        long slotsNeeded = slotsFor(payload.length, header.bitDepth());
        if (slotsNeeded > regionSize) {
            throw ApiException.badRequest("CAPACITY_EXCEEDED",
                    "The message no longer fits this audio with the chosen settings.");
        }
        codeRegion(wav, header, payload, regionOffset, regionSize, seedPassword, true);
    }

    private static void codeRegion(WavCodec.Wav wav, StegoHeader header, byte[] payload,
                                   int regionOffset, int regionSize,
                                   char[] seedPassword, boolean write) {
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
            int slot = logicalToSlot(wav, header.channelMask(), logical);
            if (write) {
                int chunk = 0;
                for (int b = 0; b < header.bitDepth(); b++) {
                    int bitValue = 0;
                    if (bitCursor < totalBits) {
                        bitValue = (payload[(int) (bitCursor >> 3)] >> (7 - (int) (bitCursor & 7))) & 1;
                    }
                    chunk = (chunk << 1) | bitValue;
                    bitCursor++;
                }
                writeSlotBits(wav, slot, header.bitDepth(), chunk);
            } else {
                int chunk = readSlotBits(wav, slot, header.bitDepth());
                for (int b = header.bitDepth() - 1; b >= 0; b--) {
                    if (bitCursor < totalBits) {
                        int bitValue = (chunk >> b) & 1;
                        payload[(int) (bitCursor >> 3)] |= (byte) (bitValue << (7 - (int) (bitCursor & 7)));
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

    private static int eligibleUniverse(WavCodec.Wav wav, int channelMask) {
        long usableFrames = Math.max(0, wav.totalFrames() - headerFrames(wav));
        long eligible = usableFrames * Integer.bitCount(channelMask);
        return (int) Math.min(eligible, Integer.MAX_VALUE);
    }

    /** Map a logical payload index to a global interleaved slot index. */
    private static int logicalToSlot(WavCodec.Wav wav, int channelMask, int logical) {
        int ncc = Integer.bitCount(channelMask);
        long frame = headerFrames(wav) + logical / ncc;
        int nth = logical % ncc;
        int channel = nthMaskedChannel(channelMask, nth);
        return (int) (frame * wav.channels() + channel);
    }

    private static int nthMaskedChannel(int mask, int nth) {
        int seen = 0;
        for (int c = 0; c < 2; c++) {
            if ((mask & (1 << c)) != 0) {
                if (seen == nth) return c;
                seen++;
            }
        }
        throw new IllegalStateException("Bad channel mask " + mask);
    }

    private static void writeSlotBits(WavCodec.Wav wav, int slot, int bits, int value) {
        int off = wav.byteOffsetOf(slot);
        int mask = (1 << bits) - 1;
        int low = wav.container()[off] & 0xFF;
        low = (low & ~mask) | (value & mask);
        wav.container()[off] = (byte) low;
    }

    private static int readSlotBits(WavCodec.Wav wav, int slot, int bits) {
        return wav.container()[wav.byteOffsetOf(slot)] & ((1 << bits) - 1);
    }

    /** Parse a channel string like \"LR\", \"L\", \"R\" into a mask, per carrier channels. */
    public static int parseChannelMask(String channels, int carrierChannels) {
        if (channels == null || channels.isBlank()) {
            return carrierChannels == 1 ? CHANNEL_L : CHANNEL_L | CHANNEL_R;
        }
        int mask = 0;
        for (char c : channels.toUpperCase().toCharArray()) {
            switch (c) {
                case 'L' -> mask |= CHANNEL_L;
                case 'R' -> mask |= CHANNEL_R;
                default -> throw ApiException.badRequest("BAD_CHANNELS",
                        "Channels must be L, R or LR.");
            }
        }
        if (carrierChannels == 1 && mask != CHANNEL_L) {
            throw ApiException.badRequest("BAD_CHANNELS",
                    "This is a mono recording — only channel L exists.");
        }
        return mask;
    }

    /** Validate the bit depth — audio gets 1 or 2 bits per sample, never 4. */
    public static void validateBitDepth(int bitDepth) {
        if (bitDepth != 1 && bitDepth != 2) {
            throw ApiException.badRequest("BAD_BIT_DEPTH",
                    "Audio supports 1 or 2 bits per sample. "
                            + "More than that produces clearly audible hiss.");
        }
    }
}
