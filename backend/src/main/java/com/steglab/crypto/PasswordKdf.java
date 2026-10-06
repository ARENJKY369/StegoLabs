package com.steglab.crypto;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;

/**
 * PBKDF2-HMAC-SHA256 key derivation. 210,000 iterations (OWASP 2023
 * guidance; the spec minimum is 65,536). Derived keys are returned as
 * raw bytes so callers can wipe them deterministically.
 */
public final class PasswordKdf {

    public static final int ITERATIONS = 210_000;
    public static final int KEY_BITS = 256;
    public static final int SALT_BYTES = 16;

    private PasswordKdf() {
    }

    /** Derive a 256-bit AES key. Caller owns and must wipe the result. */
    public static byte[] deriveKey(char[] password, byte[] salt, int iterations) {
        PBEKeySpec spec = new PBEKeySpec(password, salt, iterations, KEY_BITS);
        try {
            SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            return factory.generateSecret(spec).getEncoded();
        } catch (GeneralSecurityException e) {
            // Only reachable if the JVM lacks PBKDF2 — a broken runtime.
            throw new IllegalStateException("Key derivation unavailable in this runtime");
        } finally {
            spec.clearPassword();
        }
    }

    /**
     * Deterministic 64-bit seed for password-scattered pixel ordering.
     * Not a key: it only decides a permutation, the payload itself is
     * always AES-256-GCM encrypted on top of this.
     */
    public static long scatterSeed(char[] password) {
        byte[] pw = toBytes(password);
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            sha.update(pw);
            sha.update("steglab/scatter/v1".getBytes(StandardCharsets.UTF_8));
            byte[] digest = sha.digest();
            long seed = 0;
            for (int i = 0; i < 8; i++) {
                seed = (seed << 8) | (digest[i] & 0xFFL);
            }
            Wipe.bytes(digest);
            return seed == 0 ? 0x9E3779B97F4A7C15L : seed;
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("SHA-256 unavailable in this runtime");
        } finally {
            Wipe.bytes(pw);
        }
    }

    private static byte[] toBytes(char[] chars) {
        byte[] out = new String(chars).getBytes(StandardCharsets.UTF_8);
        return out;
    }
}
