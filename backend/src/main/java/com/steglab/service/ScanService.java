package com.steglab.service;

import com.steglab.analysis.ScanEngine;
import com.steglab.core.Uploads;
import com.steglab.exception.ApiException;
import com.steglab.model.BatchScanResult;
import com.steglab.model.ScanReport;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class ScanService {

    private static final int BATCH_LIMIT = 50;

    public ScanReport scanSingle(MultipartFile file, String password, String[] tests) {
        byte[] data = Uploads.requireBytes(file);
        Set<String> selected = parseTests(tests);
        return ScanEngine.scan(data, file.getOriginalFilename(), selected, password);
    }

    public List<BatchScanResult> scanBatch(MultipartFile[] files) {
        if (files == null || files.length == 0) {
            throw ApiException.badRequest("NO_FILES", "No files were uploaded. Add some files first.");
        }
        if (files.length > BATCH_LIMIT) {
            throw ApiException.badRequest("TOO_MANY_FILES",
                    "Batch scans are limited to " + BATCH_LIMIT + " files at a time.");
        }
        List<BatchScanResult> results = new ArrayList<>(files.length);
        for (MultipartFile file : files) {
            long started = System.currentTimeMillis();
            try {
                byte[] data = Uploads.requireBytes(file);
                ScanReport report = ScanEngine.scan(data, file.getOriginalFilename(),
                        ScanEngine.ALL_TESTS, null);
                results.add(new BatchScanResult(
                        report.filename(),
                        report.detectedType(),
                        report.sizeBytes(),
                        report.score(),
                        report.label(),
                        report.payloadClassification() == null
                                ? "" : report.payloadClassification().structuralType(),
                        report.findings().size(),
                        System.currentTimeMillis() - started));
            } catch (ApiException e) {
                results.add(new BatchScanResult(
                        file.getOriginalFilename() == null ? "unnamed" : file.getOriginalFilename(),
                        "unreadable", file.getSize(), -1, "ERROR", e.getMessage(), 0,
                        System.currentTimeMillis() - started));
            }
        }
        return results;
    }

    private Set<String> parseTests(String[] tests) {
        if (tests == null || tests.length == 0) return ScanEngine.ALL_TESTS;
        Set<String> selected = new HashSet<>();
        for (String t : tests) {
            // Accept both comma-joined and repeated params.
            for (String part : t.split(",")) {
                String name = part.trim();
                if (name.isEmpty()) continue;
                if (!ScanEngine.ALL_TESTS.contains(name)) {
                    throw ApiException.badRequest("UNKNOWN_TEST",
                            "Unknown test '" + name + "'. Valid tests: "
                                    + String.join(", ", new java.util.TreeSet<>(ScanEngine.ALL_TESTS)));
                }
                selected.add(name);
            }
        }
        return selected.isEmpty() ? ScanEngine.ALL_TESTS : selected;
    }
}
