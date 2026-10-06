package com.steglab.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final String version;
    private final String gitCommit;

    public HealthController(@Value("${steglab.version:2.0.0}") String version,
                            @Value("${steglab.git-commit:dev}") String gitCommit) {
        this.version = version;
        this.gitCommit = gitCommit;
    }

    @GetMapping
    public Map<String, Object> health() {
        return Map.of(
                "status", "ok",
                "version", version,
                "gitCommit", gitCommit,
                "javaVersion", System.getProperty("java.version"),
                "timestamp", Instant.now().toString()
        );
    }
}
