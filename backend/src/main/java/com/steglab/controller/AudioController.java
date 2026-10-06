package com.steglab.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.steglab.image.StegoHeader;
import com.steglab.model.ExtractImageResponse;
import com.steglab.service.AudioExtractService;
import com.steglab.service.AudioHideService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class AudioController {

    private final AudioHideService hideService;
    private final AudioExtractService extractService;
    private final ObjectMapper mapper;

    public AudioController(AudioHideService hideService,
                           AudioExtractService extractService,
                           ObjectMapper mapper) {
        this.hideService = hideService;
        this.extractService = extractService;
        this.mapper = mapper;
    }

    /** WAV with the message embedded; quality metrics ride in X-Steglab-Meta. */
    @PostMapping("/hide/audio")
    public ResponseEntity<byte[]> hideAudio(
            @RequestParam("file") MultipartFile file,
            @RequestParam("message") String message,
            @RequestParam("password") String password,
            @RequestParam(value = "bitDepth", defaultValue = "1") int bitDepth,
            @RequestParam(value = "channels", defaultValue = "LR") String channels,
            @RequestParam(value = "mode", defaultValue = "sequential") String mode,
            @RequestParam(value = "decoyMessage", required = false) String decoyMessage,
            @RequestParam(value = "decoyPassword", required = false) String decoyPassword) {

        AudioHideService.HideResult result = hideService.hide(
                file, message, password, bitDepth, channels, mode, decoyMessage, decoyPassword);

        String meta;
        try {
            meta = mapper.writeValueAsString(result.meta());
        } catch (JsonProcessingException e) {
            meta = "{}";
        }

        String name = (file.getOriginalFilename() == null ? "carrier" : file.getOriginalFilename())
                .replaceAll("\\.[^.]+$", "")
                .replaceAll("[^A-Za-z0-9_-]", "_");

        return ResponseEntity.ok()
                .contentType(org.springframework.http.MediaType.valueOf("audio/wav"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + name + "-stego.wav\"")
                .header("X-Steglab-Meta", meta)
                .body(result.wav());
    }

    @PostMapping("/extract/audio")
    public ExtractImageResponse extractAudio(
            @RequestParam("file") MultipartFile file,
            @RequestParam("password") String password,
            @RequestParam(value = "revealMode", defaultValue = "real") String revealMode) {
        return extractService.extract(file, password, revealMode);
    }

    /** Password-free header probe — same shape as the image probe. */
    @PostMapping("/extract/audio/probe")
    public Map<String, Object> probeAudio(@RequestParam("file") MultipartFile file) {
        StegoHeader header = extractService.probe(file);
        if (header == null) {
            return Map.of("stegoDetected", false);
        }
        return Map.of(
                "stegoDetected", true,
                "placementMode",
                header.placement() == StegoHeader.PLACEMENT_SCATTERED ? "scattered" : "sequential",
                "decoyDetected", header.hasDecoy(),
                "bitDepth", header.bitDepth());
    }
}
