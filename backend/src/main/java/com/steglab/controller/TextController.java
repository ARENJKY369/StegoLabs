package com.steglab.controller;

import com.steglab.model.TextExtractResponse;
import com.steglab.model.TextHideResponse;
import com.steglab.service.TextExtractService;
import com.steglab.service.TextHideService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Text endpoints exchange JSON (stego text travels in the body, not as a
 * file), because the natural workflow is paste-in / copy-out.
 */
@RestController
@RequestMapping("/api")
public class TextController {

    private final TextHideService hideService;
    private final TextExtractService extractService;

    public TextController(TextHideService hideService, TextExtractService extractService) {
        this.hideService = hideService;
        this.extractService = extractService;
    }

    @PostMapping("/hide/text")
    public TextHideResponse hideText(
            @RequestParam("cover") String cover,
            @RequestParam("message") String message,
            @RequestParam("password") String password,
            @RequestParam(value = "technique", defaultValue = "zeroWidth") String technique,
            @RequestParam(value = "mode", defaultValue = "append") String mode,
            @RequestParam(value = "decoyMessage", required = false) String decoyMessage,
            @RequestParam(value = "decoyPassword", required = false) String decoyPassword) {
        return hideService.hide(cover, message, password, technique, mode, decoyMessage, decoyPassword);
    }

    @PostMapping("/extract/text")
    public TextExtractResponse extractText(
            @RequestParam("text") String text,
            @RequestParam("password") String password,
            @RequestParam(value = "revealMode", defaultValue = "real") String revealMode) {
        return extractService.extract(text, password, revealMode);
    }

    /** Password-free probe: is a StegLab stream present, and in which technique? */
    @PostMapping("/extract/text/probe")
    public Map<String, Object> probeText(@RequestParam("text") String text) {
        return extractService.probe(text);
    }
}
