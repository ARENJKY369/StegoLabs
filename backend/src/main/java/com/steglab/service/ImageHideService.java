package com.steglab.service;

import com.steglab.core.FileSignature;
import com.steglab.core.Uploads;
import com.steglab.crypto.CryptoEnvelope;
import com.steglab.crypto.Wipe;
import com.steglab.exception.ApiException;
import com.steglab.image.ImageCodec;
import com.steglab.image.ImageMetrics;
import com.steglab.image.LsbImageStego;
import com.steglab.image.StegoHeader;
import com.steglab.model.HideImageMeta;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.awt.image.BufferedImage;
import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * Orchestrates image embedding: validate → encrypt → embed → measure.
 * Plaintext and passwords are wiped as soon as the envelopes are sealed;
 * nothing is written to disk at any point.
 */
@Service
public class ImageHideService {

    public record HideResult(byte[] png, HideImageMeta meta) {
    }

    public HideResult hide(MultipartFile file,
                           String message,
                           String password,
                           int bitDepth,
                           String channels,
                           String mode,
                           String decoyMessage,
                           String decoyPassword) {

        // ---- validation ----
        byte[] carrierBytes = Uploads.requireTyped(file,
                Set.of(FileSignature.PNG, FileSignature.BMP),
                "Only PNG and BMP images can carry hidden data. "
                        + "JPEG is rejected because compression would destroy the message.");
        Uploads.requirePassword(password);

        if (message == null || message.isEmpty()) {
            throw ApiException.badRequest("EMPTY_MESSAGE",
                    "Type a message to hide first.");
        }
        if (bitDepth != 1 && bitDepth != 2 && bitDepth != 4) {
            throw ApiException.badRequest("BAD_BIT_DEPTH",
                    "Bit depth must be 1, 2 or 4.");
        }
        boolean scattered = switch (mode == null ? "sequential" : mode) {
            case "sequential" -> false;
            case "scattered" -> true;
            default -> throw ApiException.badRequest("BAD_MODE",
                    "Pixel order must be 'sequential' or 'scattered'.");
        };
        int channelMask = LsbImageStego.parseChannelMask(channels);

        boolean wantDecoy = decoyMessage != null && !decoyMessage.isEmpty();
        if (wantDecoy) {
            if (decoyPassword == null || decoyPassword.isEmpty()) {
                throw ApiException.badRequest("DECOY_PASSWORD_REQUIRED",
                        "Decoy mode needs its own password, different from the real one.");
            }
            if (decoyPassword.equals(password)) {
                throw ApiException.badRequest("DECOY_PASSWORD_SAME",
                        "The decoy password must be different from the real password — "
                                + "otherwise there is no way to tell the two messages apart.");
            }
        }

        BufferedImage carrier = ImageCodec.readCarrier(carrierBytes);

        // ---- capacity (long arithmetic, exact error message) ----
        // With a decoy the slot universe is split in half, one message per
        // region, so each message is checked against its own region.
        long capacity = LsbImageStego.capacityBytes(carrier, bitDepth, channelMask);
        long regionCapacity = wantDecoy ? capacity / 2 : capacity;
        byte[] messageBytes = message.getBytes(StandardCharsets.UTF_8);
        byte[] decoyBytes = wantDecoy ? decoyMessage.getBytes(StandardCharsets.UTF_8) : null;

        long usable = Math.max(0, regionCapacity - CryptoEnvelope.OVERHEAD_BYTES);
        if (messageBytes.length + CryptoEnvelope.OVERHEAD_BYTES > regionCapacity) {
            throw ApiException.capacityExceeded(messageBytes.length, usable);
        }
        if (wantDecoy && decoyBytes.length + CryptoEnvelope.OVERHEAD_BYTES > regionCapacity) {
            throw ApiException.capacityExceeded(decoyBytes.length, usable);
        }

        // ---- encrypt ----
        char[] pw = password.toCharArray();
        char[] decoyPw = wantDecoy ? decoyPassword.toCharArray() : null;
        byte[] realEnvelope;
        byte[] decoyEnvelope = new byte[0];
        try {
            realEnvelope = CryptoEnvelope.seal(messageBytes, pw, (byte) 0);
            if (wantDecoy) {
                decoyEnvelope = CryptoEnvelope.seal(decoyBytes, decoyPw, (byte) 0);
            }
        } finally {
            Wipe.bytes(messageBytes, decoyBytes);
        }

        // ---- embed ----
        StegoHeader header = new StegoHeader(
                scattered ? StegoHeader.PLACEMENT_SCATTERED : StegoHeader.PLACEMENT_SEQUENTIAL,
                wantDecoy, bitDepth, channelMask,
                realEnvelope.length, decoyEnvelope.length);

        long bytesEmbedded = (long) realEnvelope.length + decoyEnvelope.length;

        BufferedImage stego;
        try {
            stego = LsbImageStego.embed(carrier, header, realEnvelope, decoyEnvelope, pw, decoyPw);
        } finally {
            Wipe.chars(pw, decoyPw);
        }

        byte[] png = ImageCodec.writePng(stego);
        ImageMetrics.Quality q = ImageMetrics.compare(carrier, stego);

        HideImageMeta meta = new HideImageMeta(
                q.psnr(), q.ssim(), q.mse(),
                capacity == 0 ? 0 : Math.round(10000.0 * bytesEmbedded / capacity) / 10000.0,
                bytesEmbedded,
                capacity,
                stego.getWidth(), stego.getHeight(),
                scattered ? "scattered" : "sequential",
                bitDepth,
                maskToString(channelMask),
                wantDecoy
        );
        return new HideResult(png, meta);
    }

    private static String maskToString(int mask) {
        StringBuilder sb = new StringBuilder(3);
        if ((mask & LsbImageStego.CHANNEL_R) != 0) sb.append('R');
        if ((mask & LsbImageStego.CHANNEL_G) != 0) sb.append('G');
        if ((mask & LsbImageStego.CHANNEL_B) != 0) sb.append('B');
        return sb.toString();
    }
}
