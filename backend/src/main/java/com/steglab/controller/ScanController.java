package com.steglab.controller;

import com.steglab.model.BatchScanResult;
import com.steglab.model.ScanReport;
import com.steglab.service.ScanService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/scan")
public class ScanController {

    private final ScanService service;

    public ScanController(ScanService service) {
        this.service = service;
    }

    @PostMapping("/file")
    public ScanReport scanFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "password", required = false) String password,
            @RequestParam(value = "tests", required = false) String[] tests) {
        return service.scanSingle(file, password, tests);
    }

    @PostMapping("/batch")
    public List<BatchScanResult> scanBatch(@RequestParam("files") MultipartFile[] files) {
        return service.scanBatch(files);
    }
}
