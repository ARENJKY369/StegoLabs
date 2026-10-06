package com.steglab.exception;

import com.steglab.model.ErrorResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * Every error leaving this API is a small JSON object with a plain-English
 * message and a stable code. No stack traces, no Java class names, ever.
 * The application keeps running after any handled error.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApi(ApiException ex) {
        return ResponseEntity.status(ex.getStatus())
                .body(new ErrorResponse(ex.getMessage(), ex.getCode()));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleTooLarge(MaxUploadSizeExceededException ex) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(new ErrorResponse("This file is too large. Maximum size is 50 MB.", "FILE_TOO_LARGE"));
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<ErrorResponse> handleMultipart(MultipartException ex) {
        return ResponseEntity.badRequest()
                .body(new ErrorResponse("The upload did not arrive intact. Please try again.", "UPLOAD_FAILED"));
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<ErrorResponse> handleMissingPart(MissingServletRequestPartException ex) {
        return ResponseEntity.badRequest()
                .body(new ErrorResponse("No file was uploaded. Please choose a file first.", "NO_FILE"));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingParam(MissingServletRequestParameterException ex) {
        return ResponseEntity.badRequest()
                .body(new ErrorResponse("A required field is missing: " + ex.getParameterName(), "MISSING_FIELD"));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return ResponseEntity.badRequest()
                .body(new ErrorResponse("One of the fields has the wrong format: " + ex.getName(), "BAD_FIELD"));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        FieldError first = ex.getBindingResult().getFieldError();
        String message = first != null
                ? first.getField() + ": " + first.getDefaultMessage()
                : "Some of the submitted values are not valid.";
        return ResponseEntity.badRequest().body(new ErrorResponse(message, "VALIDATION_FAILED"));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethod(HttpRequestMethodNotSupportedException ex) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(new ErrorResponse("That HTTP method is not supported here.", "METHOD_NOT_ALLOWED"));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(NoResourceFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse("This endpoint does not exist.", "NOT_FOUND"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnknown(Exception ex) {
        // Full detail goes to the server log only — never to the client.
        log.error("Unhandled error ({}): {}", ex.getClass().getSimpleName(), ex.getMessage());
        return ResponseEntity.internalServerError()
                .body(new ErrorResponse("Something went wrong on our side. Please try again.", "INTERNAL_ERROR"));
    }
}
