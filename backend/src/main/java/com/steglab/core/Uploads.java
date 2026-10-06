package com.steglab.core;

import com.steglab.exception.ApiException;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Set;

/**
 * Shared upload validation. Every controller funnels files through here
 * before any processing happens.
 */
public final class Uploads {

    /** Hard ceiling, mirrored in application.properties (50 MB). */
    public static final long MAX_BYTES = 50L * 1024 * 1024;

    private Uploads() {
    }

    /**
     * Read an upload into memory after the basic sanity checks.
     * Content-type claims are ignored; callers verify magic bytes.
     */
    public static byte[] requireBytes(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.noFile();
        }
        if (file.getSize() > MAX_BYTES) {
            throw new ApiException(org.springframework.http.HttpStatus.PAYLOAD_TOO_LARGE,
                    "FILE_TOO_LARGE", "This file is too large. Maximum size is 50 MB.");
        }
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw ApiException.unreadableFile();
        }
    }

    /**
     * Read and verify the file really is one of the expected formats,
     * judged by magic bytes rather than extension.
     */
    public static byte[] requireTyped(MultipartFile file, Set<FileSignature> allowed, String humanHint) {
        byte[] bytes = requireBytes(file);
        FileSignature actual = FileSignature.detect(bytes);
        if (actual == FileSignature.JPEG && !allowed.contains(FileSignature.JPEG)) {
            throw ApiException.jpegRejected();
        }
        if (!allowed.contains(actual)) {
            throw ApiException.badRequest("UNSUPPORTED_TYPE", humanHint);
        }
        return bytes;
    }

    public static void requirePassword(String password) {
        if (password == null || password.isEmpty()) {
            throw ApiException.emptyPassword();
        }
    }
}
