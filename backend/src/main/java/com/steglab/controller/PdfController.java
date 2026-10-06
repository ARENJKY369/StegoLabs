package com.steglab.controller;

import com.steglab.service.PdfMetadataService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class PdfController {

    private final PdfMetadataService service;

    public PdfController(PdfMetadataService service) {
        this.service = service;
    }

    @PostMapping("/hide/pdf")
    public ResponseEntity<byte[]> hidePdf(
            @RequestParam("file") MultipartFile file,
            @RequestParam("message") String message,
            @RequestParam("password") String password,
            @RequestParam(value = "decoyMessage", required = false) String decoyMessage,
            @RequestParam(value = "decoyPassword", required = false) String decoyPassword) {

        byte[] stego = service.hide(file, message, password, decoyMessage, decoyPassword);
        String name = (file.getOriginalFilename() == null ? "document" : file.getOriginalFilename())
                .replaceAll("\\.[^.]+$", "")
                .replaceAll("[^A-Za-z0-9_-]", "_");
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + name + "-stego.pdf\"")
                .body(stego);
    }

    @PostMapping("/extract/pdf")
    public PdfMetadataService.PdfMessageResponse extractPdf(
            @RequestParam("file") MultipartFile file,
            @RequestParam("password") String password,
            @RequestParam(value = "revealMode", defaultValue = "real") String revealMode) {
        return service.extract(file, password, revealMode);
    }

    @PostMapping("/extract/pdf/probe")
    public Map<String, Object> probePdf(@RequestParam("file") MultipartFile file) {
        return service.probe(file);
    }
}
