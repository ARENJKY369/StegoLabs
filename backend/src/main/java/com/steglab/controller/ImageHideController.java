package com.steglab.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.steglab.service.ImageHideService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/hide")
public class ImageHideController {

    private final ImageHideService service;
    private final ObjectMapper mapper;

    public ImageHideController(ImageHideService service, ObjectMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    /**
     * Returns the stego PNG as binary. Quality metadata travels in the
     * X-Steglab-Meta response header as compact JSON, so a single request
     * yields both the file and its metrics.
     */
    @PostMapping("/image")
    public ResponseEntity<byte[]> hideImage(
            @RequestParam("file") MultipartFile file,
            @RequestParam("message") String message,
            @RequestParam("password") String password,
            @RequestParam(value = "bitDepth", defaultValue = "1") int bitDepth,
            @RequestParam(value = "channels", defaultValue = "RGB") String channels,
            @RequestParam(value = "mode", defaultValue = "sequential") String mode,
            @RequestParam(value = "decoyMessage", required = false) String decoyMessage,
            @RequestParam(value = "decoyPassword", required = false) String decoyPassword) {

        ImageHideService.HideResult result = service.hide(
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
                .contentType(MediaType.IMAGE_PNG)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + name + "-stego.png\"")
                .header("X-Steglab-Meta", meta)
                .body(result.png());
    }
}
