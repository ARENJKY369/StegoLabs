package com.steglab.analysis;

import com.steglab.core.Entropy;
import com.steglab.core.FileSignature;
import com.steglab.model.PayloadClassification;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Classifies payload bytes in two modes.
 *
 * Blind mode works on data that could not be decrypted: it only reads
 * structure (magic bytes, entropy, printable ratio) and deliberately
 * never claims "malicious" or "safe".
 *
 * Authenticated mode runs after successful decryption and additionally
 * scans plaintext for script indicators. The verdict vocabulary is a
 * fixed, honest list — descriptions of what the bytes ARE, never a
 * judgement of intent.
 */
public final class PayloadClassifier {

    /** Case-insensitive indicators that a script does remote-exec style work. */
    static final String[] SCRIPT_INDICATORS = {
            "invoke-expression", "-encodedcommand", "eval(", "exec(",
            "base64 -d", "/bin/sh -c", "cmd.exe /c", "wget ", "curl ",
            "new-object net.webclient", "add-mppreference -exclusionpath",
            "reg add", "powershell -w hidden", "iex(", "downloadstring("
    };

    private PayloadClassifier() {
    }

    // ------------------------------------------------------------- blind

    /** Structural-only classification; {@code offset} is where the data sat in the carrier. */
    public static PayloadClassification blind(byte[] data, long offset) {
        if (data == null || data.length == 0) {
            return new PayloadClassification("blind", "Empty", 0.0, 0.0, offset,
                    null, List.of(), null);
        }
        double entropy = round(Entropy.ofBytes(data));

        // Our own envelope format is unambiguous: magic + fixed header.
        if (com.steglab.crypto.CryptoEnvelope.looksLikeEnvelope(data)) {
            double ctEntropy = round(Entropy.ofBytes(data,
                    com.steglab.crypto.CryptoEnvelope.HEADER_BYTES,
                    data.length - com.steglab.crypto.CryptoEnvelope.HEADER_BYTES));
            return new PayloadClassification("blind",
                    "StegLab envelope (AES-256-GCM)", ctEntropy, 1.0, offset,
                    null, List.of(), null);
        }

        FileSignature sig = FileSignature.detect(data);

        String type;
        double confidence;
        switch (sig) {
            case ZIP -> { type = "ZIP archive"; confidence = 0.95; }
            case EXE -> { type = "Windows PE executable"; confidence = 0.9; }
            case ELF -> { type = "ELF binary (Linux/Android)"; confidence = 0.95; }
            case PDF -> { type = "PDF document"; confidence = 0.95; }
            case PNG -> { type = "PNG image"; confidence = 0.95; }
            case JPEG -> { type = "JPEG image"; confidence = 0.9; }
            default -> {
                double printable = Entropy.printableRatio(data);
                if (printable > 0.85) {
                    type = "Plain text";
                    confidence = Math.min(0.9, printable);
                } else if (entropy > 7.5) {
                    type = "Encrypted blob (AES-GCM or similar)";
                    confidence = 0.8;
                } else {
                    type = "Unknown binary";
                    confidence = 0.4;
                }
            }
        }
        return new PayloadClassification("blind", type, entropy, confidence, offset,
                null, List.of(), null);
    }

    // ----------------------------------------------------- authenticated

    /** Classification of decrypted plaintext bytes. */
    public static PayloadClassification authenticated(byte[] plaintext) {
        if (plaintext == null || plaintext.length == 0) {
            return new PayloadClassification("authenticated", "Empty", 0.0, 1.0, 0,
                    "PLAIN_TEXT_MESSAGE", List.of(), "empty");
        }
        double entropy = round(Entropy.ofBytes(plaintext));
        FileSignature sig = FileSignature.detect(plaintext);
        double printable = Entropy.printableRatio(plaintext);

        String verdict;
        String type;
        List<String> matched = List.of();
        String encoding;

        if (sig == FileSignature.EXE || sig == FileSignature.ELF) {
            verdict = "EXECUTABLE_BINARY";
            type = sig == FileSignature.EXE
                    ? "Windows PE executable" : "ELF binary (Linux/Android)";
            encoding = "binary";
        } else if (sig != FileSignature.UNKNOWN) {
            verdict = "STRUCTURED_FILE";
            type = sig.description();
            encoding = "binary";
        } else if (printable > 0.85) {
            String text = new String(plaintext, StandardCharsets.UTF_8)
                    .toLowerCase(Locale.ROOT);
            matched = matchIndicators(text);
            if (!matched.isEmpty()) {
                verdict = "SCRIPT_WITH_SUSPICIOUS_INDICATORS";
                type = "Script or command text";
            } else {
                verdict = "PLAIN_TEXT_MESSAGE";
                type = "Plain text";
            }
            encoding = looksUtf8(plaintext) ? "utf-8" : "ascii";
        } else {
            verdict = "UNKNOWN_BINARY";
            type = entropy > 7.5 ? "High-entropy binary" : "Unknown binary";
            encoding = "binary";
        }

        return new PayloadClassification("authenticated", type, entropy, 1.0, 0,
                verdict, matched, encoding);
    }

    private static List<String> matchIndicators(String lowercaseText) {
        List<String> hits = new ArrayList<>();
        for (String indicator : SCRIPT_INDICATORS) {
            if (lowercaseText.contains(indicator)) {
                hits.add(indicator.trim());
            }
        }
        return hits;
    }

    private static boolean looksUtf8(byte[] data) {
        for (byte b : data) {
            if ((b & 0x80) != 0) return true;
        }
        return false;
    }

    private static double round(double v) {
        return Math.round(v * 1000.0) / 1000.0;
    }
}
