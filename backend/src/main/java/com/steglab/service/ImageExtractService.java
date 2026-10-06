package com.steglab.service;

import com.steglab.analysis.PayloadClassifier;
import com.steglab.core.FileSignature;
import com.steglab.core.Uploads;
import com.steglab.crypto.CryptoEnvelope;
import com.steglab.crypto.Wipe;
import com.steglab.exception.ApiException;
import com.steglab.image.ImageCodec;
import com.steglab.image.LsbImageStego;
import com.steglab.image.StegoHeader;
import com.steglab.model.ExtractImageResponse;
import com.steglab.model.PayloadClassification;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.awt.image.BufferedImage;
import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * Extraction pipeline: header probe → envelope pull → decrypt → classify.
 * The decrypted plaintext exists only inside this call; it is returned to
 * the client and wiped from server memory.
 */
@Service
public class ImageExtractService {

    public ExtractImageResponse extract(MultipartFile file, String password, String revealMode) {
        byte[] bytes = Uploads.requireTyped(file,
                Set.of(FileSignature.PNG, FileSignature.BMP),
                "Extraction works on PNG and BMP stego images. If you re-saved "
                        + "the file as JPEG, the hidden data is unfortunately gone.");
        Uploads.requirePassword(password);

        boolean wantDecoy = switch (revealMode == null ? "real" : revealMode) {
            case "real" -> false;
            case "decoy" -> true;
            default -> throw ApiException.badRequest("BAD_REVEAL_MODE",
                    "Reveal mode must be 'real' or 'decoy'.");
        };

        BufferedImage image = ImageCodec.decodeToRgb(bytes);
        StegoHeader header = LsbImageStego.readHeader(image);
        if (header == null) {
            throw ApiException.badRequest("NO_HIDDEN_DATA",
                    "No hidden message found in this file. Either nothing was "
                            + "embedded, or the image was modified after hiding.");
        }

        char[] pw = password.toCharArray();
        byte[] envelope = null;
        byte[] plaintext = null;
        try {
            envelope = LsbImageStego.extractEnvelope(image, header, wantDecoy, pw);

            // A valid stego header proved data is present. If the pulled
            // bytes are not a readable envelope, the scatter order was
            // wrong — i.e. the password is wrong, not "no data".
            if (!CryptoEnvelope.looksLikeEnvelope(envelope)) {
                throw ApiException.wrongPassword();
            }

            // Blind view of what was pulled from the pixels (pre-decryption).
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
                    auth.entropy()
            );
        } finally {
            Wipe.chars(pw);
            Wipe.bytes(envelope, plaintext);
        }
    }

    /** Password-free header probe used by the frontend's auto-detect card. */
    public StegoHeader probe(MultipartFile file) {
        byte[] bytes = Uploads.requireTyped(file,
                Set.of(FileSignature.PNG, FileSignature.BMP),
                "Only PNG and BMP images can be probed for a stego header.");
        return LsbImageStego.readHeader(ImageCodec.decodeToRgb(bytes));
    }

    private static String maskToString(int mask) {
        StringBuilder sb = new StringBuilder(3);
        if ((mask & LsbImageStego.CHANNEL_R) != 0) sb.append('R');
        if ((mask & LsbImageStego.CHANNEL_G) != 0) sb.append('G');
        if ((mask & LsbImageStego.CHANNEL_B) != 0) sb.append('B');
        return sb.toString();
    }
}
