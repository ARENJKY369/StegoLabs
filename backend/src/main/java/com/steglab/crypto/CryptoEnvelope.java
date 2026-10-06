package com.steglab.crypto;

import com.steglab.exception.ApiException;

import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;

/**
 * The on-disk / in-carrier format for every encrypted payload in StegLab.
 *
 * Layout (all lengths in bytes):
 *   magic(4) "SGLB" | version(1) | flags(1) | salt(16) | iv(12)
 *   | length(4, big-endian, ciphertext incl. tag) | ciphertext+tag
 *
 * Cipher: AES-256-GCM, 128-bit tag, key from PBKDF2-HMAC-SHA256.
 * Encryption is mandatory — there is no plaintext mode anywhere.
 */
public final class CryptoEnvelope {

    public static final byte[] MAGIC = {'S', 'G', 'L', 'B'};
    public static final byte VERSION = 1;
    public static final int IV_BYTES = 12;
    public static final int TAG_BITS = 128;
    public static final int HEADER_BYTES = 4 + 1 + 1 + PasswordKdf.SALT_BYTES + IV_BYTES + 4;
    /** Fixed size cost of sealing a message: header + GCM tag. */
    public static final int OVERHEAD_BYTES = HEADER_BYTES + TAG_BITS / 8;

    private static final SecureRandom RANDOM = new SecureRandom();

    private CryptoEnvelope() {
    }

    /** Encrypt {@code plaintext} under {@code password}. Wipes neither input. */
    public static byte[] seal(byte[] plaintext, char[] password, byte flags) {
        byte[] salt = new byte[PasswordKdf.SALT_BYTES];
        byte[] iv = new byte[IV_BYTES];
        RANDOM.nextBytes(salt);
        RANDOM.nextBytes(iv);

        byte[] key = PasswordKdf.deriveKey(password, salt, PasswordKdf.ITERATIONS);
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE,
                    new SecretKeySpec(key, "AES"),
                    new GCMParameterSpec(TAG_BITS, iv));
            byte[] ciphertext = cipher.doFinal(plaintext);

            ByteBuffer out = ByteBuffer.allocate(HEADER_BYTES + ciphertext.length);
            out.put(MAGIC).put(VERSION).put(flags).put(salt).put(iv)
               .putInt(ciphertext.length).put(ciphertext);
            return out.array();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("AES-GCM unavailable in this runtime");
        } finally {
            Wipe.bytes(key);
        }
    }

    /**
     * Decrypt an envelope. Wrong password and tampered data are
     * indistinguishable by design (GCM) and both surface as HTTP 401.
     */
    public static byte[] open(byte[] envelope, char[] password) {
        if (!looksLikeEnvelope(envelope)) {
            throw ApiException.badRequest("NO_HIDDEN_DATA",
                    "No hidden message found in this file.");
        }
        ByteBuffer in = ByteBuffer.wrap(envelope);
        in.position(4); // past magic
        byte version = in.get();
        if (version != VERSION) {
            throw ApiException.badRequest("UNSUPPORTED_VERSION",
                    "This file was made with a newer version of StegLab.");
        }
        in.get(); // flags — reserved
        byte[] salt = new byte[PasswordKdf.SALT_BYTES];
        byte[] iv = new byte[IV_BYTES];
        in.get(salt);
        in.get(iv);
        int length = in.getInt();
        if (length < TAG_BITS / 8 || length > in.remaining()) {
            throw ApiException.badRequest("NO_HIDDEN_DATA",
                    "No hidden message found in this file.");
        }
        byte[] ciphertext = new byte[length];
        in.get(ciphertext);

        byte[] key = PasswordKdf.deriveKey(password, salt, PasswordKdf.ITERATIONS);
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,
                    new SecretKeySpec(key, "AES"),
                    new GCMParameterSpec(TAG_BITS, iv));
            return cipher.doFinal(ciphertext);
        } catch (AEADBadTagException e) {
            throw ApiException.wrongPassword();
        } catch (GeneralSecurityException e) {
            throw ApiException.wrongPassword();
        } finally {
            Wipe.bytes(key);
        }
    }

    /** Size in bytes of the envelope that starts at {@code offset}, or -1. */
    public static int envelopeSizeAt(byte[] data, int offset) {
        if (data.length - offset < HEADER_BYTES) return -1;
        for (int i = 0; i < MAGIC.length; i++) {
            if (data[offset + i] != MAGIC[i]) return -1;
        }
        int length = ByteBuffer.wrap(data, offset + HEADER_BYTES - 4, 4).getInt();
        if (length < 0 || offset + HEADER_BYTES + length > data.length) return -1;
        return HEADER_BYTES + length;
    }

    public static boolean looksLikeEnvelope(byte[] data) {
        if (data == null || data.length < HEADER_BYTES) return false;
        for (int i = 0; i < MAGIC.length; i++) {
            if (data[i] != MAGIC[i]) return false;
        }
        return true;
    }
}
