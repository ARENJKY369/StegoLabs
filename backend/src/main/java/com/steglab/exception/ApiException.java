package com.steglab.exception;

import org.springframework.http.HttpStatus;

/**
 * The only exception type services are allowed to throw towards clients.
 * Carries a plain-English message (already safe to show a human) and a
 * stable machine-readable code the frontend can branch on.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public ApiException(HttpStatus status, String code, String humanMessage) {
        super(humanMessage);
        this.status = status;
        this.code = code;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    // ---- Factories for the errors every module needs ----

    public static ApiException badRequest(String code, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    public static ApiException wrongPassword() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "WRONG_PASSWORD",
                "Wrong password or file was modified");
    }

    public static ApiException unreadableFile() {
        return new ApiException(HttpStatus.BAD_REQUEST, "UNREADABLE_FILE",
                "We could not read this file. It may be corrupted.");
    }

    public static ApiException noFile() {
        return new ApiException(HttpStatus.BAD_REQUEST, "NO_FILE",
                "No file was uploaded. Please choose a file first.");
    }

    public static ApiException jpegRejected() {
        return new ApiException(HttpStatus.BAD_REQUEST, "JPEG_NOT_SUPPORTED",
                "JPEG uses lossy compression which destroys hidden data. Please convert to PNG first.");
    }

    public static ApiException capacityExceeded(long messageBytes, long capacityBytes) {
        return new ApiException(HttpStatus.BAD_REQUEST, "CAPACITY_EXCEEDED",
                "message is " + messageBytes + " bytes but carrier holds only " + capacityBytes + " bytes");
    }

    public static ApiException emptyPassword() {
        return new ApiException(HttpStatus.BAD_REQUEST, "PASSWORD_REQUIRED",
                "A password is required. Encryption is always on in StegLab.");
    }
}
