package com.steglab.service;

import com.steglab.analysis.PayloadClassifier;
import com.steglab.crypto.CryptoEnvelope;
import com.steglab.crypto.Wipe;
import com.steglab.exception.ApiException;
import com.steglab.image.StegoHeader;
import com.steglab.model.PayloadClassification;
import com.steglab.model.TextExtractResponse;
import com.steglab.text.WhitespaceStego;
import com.steglab.text.ZeroWidthStego;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

/** Text extraction: decode invisible stream → header → envelope → decrypt → classify. */
@Service
public class TextExtractService {

    public TextExtractResponse extract(String text, String password, String revealMode) {
        if (text == null || text.isEmpty()) {
            throw ApiException.badRequest("EMPTY_COVER",
                    "Paste the text that should contain the hidden message.");
        }
        if (password == null || password.isEmpty()) {
            throw ApiException.emptyPassword();
        }
        boolean wantDecoy = switch (revealMode == null ? "real" : revealMode) {
            case "real" -> false;
            case "decoy" -> true;
            default -> throw ApiException.badRequest("BAD_REVEAL_MODE",
                    "Reveal mode must be 'real' or 'decoy'.");
        };

        // Try zero-width first; fall back to whitespace.
        StegoHeader header = ZeroWidthStego.probeHeader(text);
        boolean whitespace = false;
        byte[] stream = null;
        if (header != null) {
            stream = ZeroWidthStego.decode(text);
        } else {
            header = WhitespaceStego.probeHeader(text);
            if (header != null) {
                whitespace = true;
                stream = WhitespaceStego.decode(text);
            }
        }
        if (header == null) {
            throw ApiException.badRequest("NO_HIDDEN_DATA",
                    "No hidden message found in this text. Either nothing was "
                            + "embedded, or some of the invisible characters were lost "
                            + "when the text was copied.");
        }
        if (wantDecoy && !header.hasDecoy()) {
            throw ApiException.badRequest("NO_DECOY",
                    "This text does not contain a decoy message.");
        }

        int realOffset = StegoHeader.BYTES;
        int decoyOffset = realOffset + header.realLength();
        int start = wantDecoy ? decoyOffset : realOffset;
        int length = wantDecoy ? header.decoyLength() : header.realLength();
        if (stream.length < start + length) {
            throw ApiException.badRequest("NO_HIDDEN_DATA",
                    "The hidden data in this text is truncated — some characters were lost.");
        }

        char[] pw = password.toCharArray();
        byte[] envelope = Arrays.copyOfRange(stream, start, start + length);
        byte[] plaintext = null;
        try {
            if (!CryptoEnvelope.looksLikeEnvelope(envelope)) {
                throw ApiException.wrongPassword();
            }
            PayloadClassification blind = PayloadClassifier.blind(envelope, StegoHeader.SLOTS / 8);
            plaintext = CryptoEnvelope.open(envelope, pw);
            PayloadClassification auth = PayloadClassifier.authenticated(plaintext);

            return new TextExtractResponse(
                    new String(plaintext, StandardCharsets.UTF_8),
                    whitespace ? "whitespace" : "zeroWidth",
                    header.placement() == StegoHeader.PLACEMENT_SCATTERED ? "scattered" : "append",
                    wantDecoy ? "decoy" : "real",
                    header.hasDecoy(),
                    blind,
                    auth.contentVerdict(),
                    auth.matchedKeywords(),
                    auth.entropy());
        } finally {
            Wipe.chars(pw);
            Wipe.bytes(envelope, plaintext, stream);
        }
    }

    /** Password-free probe: scan both techniques for a StegLab header. */
    public Map<String, Object> probe(String text) {
        if (text == null || text.isEmpty()) {
            return Map.of("stegoDetected", false);
        }
        int zwCount = 0;
        for (int i = 0; i < text.length(); i++) {
            if (ZeroWidthStego.isAlphabet(text.charAt(i))) zwCount++;
        }
        StegoHeader header = zwCount > 0 ? ZeroWidthStego.probeHeader(text) : null;
        if (header != null) {
            Map<String, Object> out = new HashMap<>();
            out.put("stegoDetected", true);
            out.put("technique", "zeroWidth");
            out.put("placementMode",
                    header.placement() == StegoHeader.PLACEMENT_SCATTERED ? "scattered" : "append");
            out.put("decoyDetected", header.hasDecoy());
            out.put("invisibleChars", zwCount);
            return out;
        }
        StegoHeader wsHeader = WhitespaceStego.probeHeader(text);
        if (wsHeader != null) {
            Map<String, Object> out = new HashMap<>();
            out.put("stegoDetected", true);
            out.put("technique", "whitespace");
            out.put("placementMode", "append");
            out.put("decoyDetected", wsHeader.hasDecoy());
            out.put("invisibleChars", WhitespaceStego.trailingStream(text).length());
            return out;
        }
        Map<String, Object> out = new HashMap<>();
        out.put("stegoDetected", false);
        out.put("invisibleChars", zwCount);
        return out;
    }
}
