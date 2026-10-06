package com.steglab.controller;

import com.steglab.image.StegoHeader;
import com.steglab.model.ExtractImageResponse;
import com.steglab.service.ImageExtractService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/extract")
public class ExtractController {

    private final ImageExtractService imageExtractService;

    public ExtractController(ImageExtractService imageExtractService) {
        this.imageExtractService = imageExtractService;
    }

    @PostMapping("/image")
    public ExtractImageResponse extractImage(
            @RequestParam("file") MultipartFile file,
            @RequestParam("password") String password,
            @RequestParam(value = "revealMode", defaultValue = "real") String revealMode) {
        return imageExtractService.extract(file, password, revealMode);
    }

    /**
     * Password-free header probe: tells the UI whether a stego header is
     * present, its placement mode and whether a decoy exists — without
     * revealing anything about message content.
     */
    @PostMapping("/image/probe")
    public Map<String, Object> probeImage(@RequestParam("file") MultipartFile file) {
        StegoHeader header = imageExtractService.probe(file);
        if (header == null) {
            return Map.of("stegoDetected", false);
        }
        return Map.of(
                "stegoDetected", true,
                "placementMode",
                header.placement() == StegoHeader.PLACEMENT_SCATTERED ? "scattered" : "sequential",
                "decoyDetected", header.hasDecoy(),
                "bitDepth", header.bitDepth()
        );
    }
}
