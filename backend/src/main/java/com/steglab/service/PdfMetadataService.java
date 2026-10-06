package com.steglab.service;

import com.steglab.analysis.PayloadClassifier;
import com.steglab.core.FileSignature;
import com.steglab.core.Uploads;
import com.steglab.crypto.CryptoEnvelope;
import com.steglab.crypto.Wipe;
import com.steglab.exception.ApiException;
import com.steglab.model.PayloadClassification;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

/**
 * Document metadata steganography: the encrypted envelope is Base64-encoded
 * into a custom PDF Info-dictionary string. This travels with the document
 * but is not part of its visible content at all — which is exactly why the
 * UI calls it a metadata technique, not an invisible technique: any PDF
 * properties inspector can see the custom property, and any decent cleaner
 * (including ours) strips it.
 *
 * Layout inside the value: "SGLM1:" + base64(flags(1) | realLen(4) |
 * realEnvelope | decoyEnvelope?).
 */
@Service
public class PdfMetadataService {

    private static final String KEY = "StegLab";
    private static final String PREFIX = "SGLM1:";
    private static final int MAX_VALUE = 8 * 1024;      // conservative Info-string budget
    private static final int MAX_MESSAGE = 2000;         // bytes, per envelope

    public byte[] hide(MultipartFile file,
                       String message,
                       String password,
                       String decoyMessage,
                       String decoyPassword) {
        byte[] pdfBytes = Uploads.requireTyped(file,
                Set.of(FileSignature.PDF),
                "Only PDF documents can carry metadata messages.");
        Uploads.requirePassword(password);
        if (message == null || message.isEmpty()) {
            throw ApiException.badRequest("EMPTY_MESSAGE", "Type a message to hide first.");
        }

        boolean wantDecoy = decoyMessage != null && !decoyMessage.isEmpty();
        if (wantDecoy) {
            if (decoyPassword == null || decoyPassword.isEmpty()) {
                throw ApiException.badRequest("DECOY_PASSWORD_REQUIRED",
                        "Decoy mode needs its own password, different from the real one.");
            }
            if (decoyPassword.equals(password)) {
                throw ApiException.badRequest("DECOY_PASSWORD_SAME",
                        "The decoy password must be different from the real password.");
            }
        }

        byte[] messageBytes = message.getBytes(StandardCharsets.UTF_8);
        byte[] decoyBytes = wantDecoy ? decoyMessage.getBytes(StandardCharsets.UTF_8) : null;
        if (messageBytes.length > MAX_MESSAGE) {
            throw ApiException.badRequest("MESSAGE_TOO_LONG",
                    "Metadata hiding is for short labels — keep it under 2,000 characters.");
        }
        if (wantDecoy && decoyBytes.length > MAX_MESSAGE) {
            throw ApiException.badRequest("MESSAGE_TOO_LONG", "The decoy message is too long.");
        }

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
            Wipe.chars(decoyPw);
        }

        ByteBuffer payload = ByteBuffer.allocate(1 + 4 + realEnvelope.length + decoyEnvelope.length);
        payload.put((byte) (wantDecoy ? 1 : 0));
        payload.putInt(realEnvelope.length);
        payload.put(realEnvelope);
        payload.put(decoyEnvelope);
        String value = PREFIX + Base64.getEncoder().encodeToString(payload.array());
        if (value.length() > MAX_VALUE) {
            throw ApiException.badRequest("MESSAGE_TOO_LONG",
                    "The encrypted message is too large for a document metadata field.");
        }

        try (PDDocument doc = PDDocument.load(pdfBytes)) {
            PDDocumentInformation info = doc.getDocumentInformation();
            if (info == null) {
                info = new PDDocumentInformation();
            }
            info.setCustomMetadataValue(KEY, value);
            doc.setDocumentInformation(info);
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            doc.save(bos);
            return bos.toByteArray();
        } catch (java.io.IOException e) {
            throw ApiException.unreadableFile();
        }
    }

    public record PdfMessageResponse(String message,
                                     String revealMode,
                                     boolean decoyPresent,
                                     PayloadClassification payloadClassification,
                                     String contentVerdict,
                                     java.util.List<String> matchedKeywords,
                                     double entropy) {
    }

    public PdfMessageResponse extract(MultipartFile file, String password, String revealMode) {
        byte[] pdfBytes = Uploads.requireTyped(file,
                Set.of(FileSignature.PDF),
                "Only PDF documents can carry metadata messages.");
        Uploads.requirePassword(password);
        boolean wantDecoy = switch (revealMode == null ? "real" : revealMode) {
            case "real" -> false;
            case "decoy" -> true;
            default -> throw ApiException.badRequest("BAD_REVEAL_MODE",
                    "Reveal mode must be 'real' or 'decoy'.");
        };

        ByteBuffer payload = ByteBuffer.wrap(readValue(pdfBytes));
        byte flags = payload.get();
        boolean hasDecoy = flags == 1;
        if (wantDecoy && !hasDecoy) {
            throw ApiException.badRequest("NO_DECOY",
                    "This document does not contain a decoy message.");
        }
        int realLen = payload.getInt();
        if (realLen <= 0 || realLen > payload.remaining() ) {
            throw ApiException.badRequest("NO_HIDDEN_DATA", "No hidden message found in this document.");
        }
        byte[] realEnvelope = new byte[realLen];
        payload.get(realEnvelope);
        byte[] envelope = wantDecoy ? new byte[payload.remaining()] : realEnvelope;
        if (wantDecoy) payload.get(envelope);

        char[] pw = password.toCharArray();
        byte[] plaintext = null;
        try {
            if (!CryptoEnvelope.looksLikeEnvelope(envelope)) {
                throw ApiException.wrongPassword();
            }
            PayloadClassification blind = PayloadClassifier.blind(envelope, 0);
            plaintext = CryptoEnvelope.open(envelope, pw);
            PayloadClassification auth = PayloadClassifier.authenticated(plaintext);
            return new PdfMessageResponse(
                    new String(plaintext, StandardCharsets.UTF_8),
                    wantDecoy ? "decoy" : "real",
                    hasDecoy,
                    blind,
                    auth.contentVerdict(),
                    auth.matchedKeywords(),
                    auth.entropy());
        } finally {
            Wipe.chars(pw);
            Wipe.bytes(realEnvelope, envelope, plaintext);
        }
    }

    public Map<String, Object> probe(MultipartFile file) {
        byte[] pdfBytes = Uploads.requireTyped(file,
                Set.of(FileSignature.PDF),
                "Only PDF documents can be probed for metadata messages.");
        Map<String, Object> out = new HashMap<>();
        try {
            ByteBuffer payload = ByteBuffer.wrap(readValue(pdfBytes));
            byte flags = payload.get();
            out.put("stegoDetected", true);
            out.put("decoyDetected", flags == 1);
            return out;
        } catch (ApiException e) {
            if ("NO_HIDDEN_DATA".equals(e.getCode())) {
                return Map.of("stegoDetected", false);
            }
            throw e;
        }
    }

    /** Pull and decode the metadata value, throwing NO_HIDDEN_DATA when absent. */
    private byte[] readValue(byte[] pdfBytes) {
        try (PDDocument doc = PDDocument.load(pdfBytes)) {
            PDDocumentInformation info = doc.getDocumentInformation();
            String value = info == null ? null : info.getCustomMetadataValue(KEY);
            if (value == null || !value.startsWith(PREFIX)) {
                throw ApiException.badRequest("NO_HIDDEN_DATA",
                        "No hidden message found in this document.");
            }
            return Base64.getDecoder().decode(value.substring(PREFIX.length()));
        } catch (java.io.IOException | IllegalArgumentException e) {
            throw ApiException.badRequest("NO_HIDDEN_DATA",
                    "No hidden message found in this document — or the metadata field was damaged.");
        }
    }
}
