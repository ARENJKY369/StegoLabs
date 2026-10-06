package com.steglab.service;

import com.steglab.crypto.CryptoEnvelope;
import com.steglab.crypto.Wipe;
import com.steglab.exception.ApiException;
import com.steglab.image.StegoHeader;
import com.steglab.model.TextHideResponse;
import com.steglab.text.WhitespaceStego;
import com.steglab.text.ZeroWidthStego;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

/**
 * Text embedding pipeline: validate → encrypt → encode as invisible
 * characters → blend into the cover text.
 *
 * The payload format is one byte stream: StegLab header || real envelope
 * || decoy envelope, rendered into the technique's alphabet. Extraction
 * decodes the whole stream and never needs to know where characters were
 * placed inside the cover.
 */
@Service
public class TextHideService {

    private static final int MAX_COVER_CHARS = 2_000_000;
    private static final int MAX_MESSAGE_BYTES = 100_000;

    public TextHideResponse hide(String cover,
                                 String message,
                                 String password,
                                 String technique,
                                 String mode,
                                 String decoyMessage,
                                 String decoyPassword) {

        if (cover == null || cover.isEmpty()) {
            throw ApiException.badRequest("EMPTY_COVER",
                    "Paste the cover text your message should hide inside.");
        }
        if (cover.length() > MAX_COVER_CHARS) {
            throw ApiException.badRequest("COVER_TOO_LONG",
                    "The cover text is too long — keep it under 2,000,000 characters.");
        }
        if (message == null || message.isEmpty()) {
            throw ApiException.badRequest("EMPTY_MESSAGE", "Type a message to hide first.");
        }
        if (password == null || password.isEmpty()) {
            throw ApiException.emptyPassword();
        }

        boolean whitespace = "whitespace".equals(technique);
        if (!whitespace && !"zeroWidth".equals(technique)) {
            throw ApiException.badRequest("BAD_TECHNIQUE",
                    "Technique must be 'zeroWidth' or 'whitespace'.");
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

        if (whitespace && wantDecoy && "scattered".equals(mode)) {
            // whitespace ignores placement entirely — keep the API honest
            mode = "append";
        }

        // ---- encrypt ----
        byte[] messageBytes = message.getBytes(StandardCharsets.UTF_8);
        byte[] decoyBytes = wantDecoy ? decoyMessage.getBytes(StandardCharsets.UTF_8) : null;
        if (messageBytes.length > MAX_MESSAGE_BYTES) {
            throw ApiException.badRequest("MESSAGE_TOO_LONG",
                    "Text hiding is for messages — keep it under 100,000 bytes.");
        }
        if (wantDecoy && decoyBytes.length > MAX_MESSAGE_BYTES) {
            throw ApiException.badRequest("MESSAGE_TOO_LONG",
                    "The decoy message is too long.");
        }
        if (whitespace && cover.trim().isEmpty()) {
            throw ApiException.badRequest("EMPTY_COVER",
                    "Whitespace encoding needs at least some visible cover text.");
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

        // ---- build the byte stream: header || real || decoy ----
        boolean scattered = "scattered".equals(mode) && !whitespace;
        StegoHeader header = new StegoHeader(
                scattered ? StegoHeader.PLACEMENT_SCATTERED : StegoHeader.PLACEMENT_SEQUENTIAL,
                wantDecoy,
                whitespace ? 1 : ZeroWidthStego.BITS_PER_SYMBOL,
                0b111,
                realEnvelope.length,
                decoyEnvelope.length);

        byte[] stream = new byte[StegoHeader.BYTES + realEnvelope.length + decoyEnvelope.length];
        System.arraycopy(header.toBytes(), 0, stream, 0, StegoHeader.BYTES);
        System.arraycopy(realEnvelope, 0, stream, StegoHeader.BYTES, realEnvelope.length);
        System.arraycopy(decoyEnvelope, 0, stream,
                StegoHeader.BYTES + realEnvelope.length, decoyEnvelope.length);

        // ---- render into the technique's alphabet and place ----
        String stego;
        int invisibleChars;
        if (whitespace) {
            String symbols = WhitespaceStego.encode(stream);
            stego = WhitespaceStego.place(cover, symbols);
            invisibleChars = symbols.length();
        } else {
            String symbols = ZeroWidthStego.encode(stream);
            stego = ZeroWidthStego.place(cover, symbols, mode);
            invisibleChars = symbols.length();
        }

        return new TextHideResponse(
                stego,
                whitespace ? "whitespace" : "zeroWidth",
                whitespace ? "append" : (mode == null ? "append" : mode),
                invisibleChars,
                cover.length(),
                message.getBytes(StandardCharsets.UTF_8).length,
                stream.length,
                wantDecoy);
    }
}
