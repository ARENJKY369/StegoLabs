package com.steglab.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.steglab.clean.CleanService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/clean")
public class CleanController {

    private final CleanService service;
    private final ObjectMapper mapper;

    public CleanController(CleanService service, ObjectMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    /** Returns the sanitised file; the removal report rides in X-Steglab-Meta. */
    @PostMapping("/file")
    public ResponseEntity<byte[]> cleanFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "profile", defaultValue = "standard") String profile) {

        CleanService.CleanResult result = service.clean(file, profile);

        String meta;
        try {
            // Response headers are ISO-8859-1 — strip anything fancier so
            // Tomcat never silently drops the meta header.
            meta = mapper.writeValueAsString(result.report()).replaceAll("[^ -~]", "");
        } catch (JsonProcessingException e) {
            meta = "{}";
        }

        String base = (file.getOriginalFilename() == null ? "file" : file.getOriginalFilename())
                .replaceAll("\\.[^.]+$", "")
                .replaceAll("[^A-Za-z0-9_-]", "_");

        MediaType type = switch (result.extension()) {
            case "png" -> MediaType.IMAGE_PNG;
            case "wav" -> MediaType.valueOf("audio/wav");
            case "pdf" -> MediaType.APPLICATION_PDF;
            case "zip" -> MediaType.valueOf("application/zip");
            case "bmp" -> MediaType.valueOf("image/bmp");
            case "jpeg", "jpg" -> MediaType.IMAGE_JPEG;
            default -> MediaType.TEXT_PLAIN;
        };

        return ResponseEntity.ok()
                .contentType(type)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + base + "-clean." + result.extension() + "\"")
                .header("X-Steglab-Meta", meta)
                .body(result.cleaned());
    }
}
