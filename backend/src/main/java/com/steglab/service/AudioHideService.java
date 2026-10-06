package com.steglab.service;

import com.steglab.audio.AudioMetrics;
import com.steglab.audio.LsbAudioStego;
import com.steglab.audio.WavCodec;
import com.steglab.core.FileSignature;
import com.steglab.core.Uploads;
import com.steglab.crypto.CryptoEnvelope;
import com.steglab.crypto.Wipe;
import com.steglab.exception.ApiException;
import com.steglab.image.StegoHeader;
import com.steglab.model.HideAudioMeta;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * Audio embedding pipeline: validate → encrypt → embed → measure.
 * Same guarantees as the image service: encryption always on, plaintext
 * wiped after sealing, nothing touches disk.
 */
@Service
public class AudioHideService {

    public record HideResult(byte[] wav, HideAudioMeta meta) {
    }

    public HideResult hide(MultipartFile file,
                           String message,
                           String password,
                           int bitDepth,
                           String channels,
                           String mode,
                           String decoyMessage,
                           String decoyPassword) {

        byte[] carrierBytes = Uploads.requireTyped(file,
                Set.of(FileSignature.WAV),
                "Only uncompressed PCM WAV files can carry hidden data. "
                        + "MP3/AAC re-encoding would destroy the message.");
        Uploads.requirePassword(password);

        if (message == null || message.isEmpty()) {
            throw ApiException.badRequest("EMPTY_MESSAGE",
                    "Type a message to hide first.");
        }
        LsbAudioStego.validateBitDepth(bitDepth);
        boolean scattered = switch (mode == null ? "sequential" : mode) {
            case "sequential" -> false;
            case "scattered" -> true;
            default -> throw ApiException.badRequest("BAD_MODE",
                    "Sample order must be 'sequential' or 'scattered'.");
        };

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

        WavCodec.Wav carrier = WavCodec.parse(carrierBytes);
        int channelMask = LsbAudioStego.parseChannelMask(channels, carrier.channels());

        // ---- capacity ----
        long capacity = LsbAudioStego.capacityBytes(carrier, bitDepth, channelMask);
        long regionCapacity = wantDecoy ? capacity / 2 : capacity;
        if (regionCapacity < CryptoEnvelope.OVERHEAD_BYTES + 8) {
            throw ApiException.badRequest("NO_ROOM",
                    "This recording is too short to hide anything safely. "
                            + "You need at least a couple of seconds of audio.");
        }
        byte[] messageBytes = message.getBytes(StandardCharsets.UTF_8);
        byte[] decoyBytes = wantDecoy ? decoyMessage.getBytes(StandardCharsets.UTF_8) : null;

        long usable = Math.max(0, regionCapacity - CryptoEnvelope.OVERHEAD_BYTES);
        if (messageBytes.length > usable) {
            throw ApiException.capacityExceeded(messageBytes.length, usable);
        }
        if (wantDecoy && decoyBytes.length > usable) {
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

        byte[] stegoBytes;
        try {
            stegoBytes = LsbAudioStego.embed(carrier, header, realEnvelope, decoyEnvelope, pw, decoyPw);
        } finally {
            Wipe.chars(pw, decoyPw);
        }

        WavCodec.Wav stego = WavCodec.parse(stegoBytes);
        AudioMetrics.Quality q = AudioMetrics.compare(carrier, stego);

        HideAudioMeta meta = new HideAudioMeta(
                q.snr(), q.psnr(),
                capacity == 0 ? 0 : Math.min(1, (double) bytesEmbedded / capacity),
                bytesEmbedded,
                capacity,
                stego.sampleRate(),
                stego.channels(),
                stego.bitsPerSample(),
                Math.round(stego.durationSeconds() * 1000.0) / 1000.0,
                q.changedSamples(),
                scattered ? "scattered" : "sequential",
                bitDepth,
                maskToString(channelMask),
                wantDecoy);
        return new HideResult(stegoBytes, meta);
    }

    private static String maskToString(int mask) {
        StringBuilder sb = new StringBuilder(2);
        if ((mask & LsbAudioStego.CHANNEL_L) != 0) sb.append('L');
        if ((mask & LsbAudioStego.CHANNEL_R) != 0) sb.append('R');
        return sb.toString();
    }
}
