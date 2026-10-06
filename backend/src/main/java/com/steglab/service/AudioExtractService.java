package com.steglab.service;

import com.steglab.analysis.PayloadClassifier;
import com.steglab.audio.LsbAudioStego;
import com.steglab.audio.WavCodec;
import com.steglab.core.FileSignature;
import com.steglab.core.Uploads;
import com.steglab.crypto.CryptoEnvelope;
import com.steglab.crypto.Wipe;
import com.steglab.exception.ApiException;
import com.steglab.image.StegoHeader;
import com.steglab.model.ExtractImageResponse;
import com.steglab.model.PayloadClassification;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.Set;

/** Extraction pipeline for WAV carriers — mirrors the image service. */
@Service
public class AudioExtractService {

    public ExtractImageResponse extract(MultipartFile file, String password, String revealMode) {
        byte[] bytes = Uploads.requireTyped(file,
                Set.of(FileSignature.WAV),
                "Extraction works on PCM WAV stego files. If the audio was "
                        + "re-encoded (MP3, AAC), the hidden data is gone.");
        Uploads.requirePassword(password);

        boolean wantDecoy = switch (revealMode == null ? "real" : revealMode) {
            case "real" -> false;
            case "decoy" -> true;
            default -> throw ApiException.badRequest("BAD_REVEAL_MODE",
                    "Reveal mode must be 'real' or 'decoy'.");
        };

        WavCodec.Wav wav = WavCodec.parse(bytes);
        StegoHeader header = LsbAudioStego.readHeader(wav);
        if (header == null) {
            throw ApiException.badRequest("NO_HIDDEN_DATA",
                    "No hidden message found in this file. Either nothing was "
                            + "embedded, or the audio was modified after hiding.");
        }

        char[] pw = password.toCharArray();
        byte[] envelope = null;
        byte[] plaintext = null;
        try {
            envelope = LsbAudioStego.extractEnvelope(wav, header, wantDecoy, pw);
            if (!CryptoEnvelope.looksLikeEnvelope(envelope)) {
                throw ApiException.wrongPassword();
            }
            PayloadClassification blind = PayloadClassifier.blind(envelope, StegoHeader.SLOTS / 8);

            plaintext = CryptoEnvelope.open(envelope, pw);
            PayloadClassification auth = PayloadClassifier.authenticated(plaintext);

            String message = new String(plaintext, StandardCharsets.UTF_8);
            return new ExtractImageResponse(
                    message,
                    header.placement() == StegoHeader.PLACEMENT_SCATTERED ? "scattered" : "sequential",
                    wantDecoy ? "decoy" : "real",
                    header.hasDecoy(),
                    header.bitDepth(),
                    maskToString(header.channelMask()),
                    blind,
                    auth.contentVerdict(),
                    auth.matchedKeywords(),
                    auth.entropy());
        } finally {
            Wipe.chars(pw);
            Wipe.bytes(envelope, plaintext);
        }
    }

    /** Password-free header probe. */
    public StegoHeader probe(MultipartFile file) {
        byte[] bytes = Uploads.requireTyped(file,
                Set.of(FileSignature.WAV),
                "Only PCM WAV files can be probed for a stego header.");
        return LsbAudioStego.readHeader(WavCodec.parse(bytes));
    }

    private static String maskToString(int mask) {
        StringBuilder sb = new StringBuilder(2);
        if ((mask & LsbAudioStego.CHANNEL_L) != 0) sb.append('L');
        if ((mask & LsbAudioStego.CHANNEL_R) != 0) sb.append('R');
        return sb.toString();
    }
}
