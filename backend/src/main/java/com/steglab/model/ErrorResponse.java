package com.steglab.model;

/** Uniform error body: {"error": "plain English message", "code": "ERROR_CODE"} */
public record ErrorResponse(String error, String code) {
}
