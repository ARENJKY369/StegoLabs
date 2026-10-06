package com.steglab.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayDeque;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Sliding-window rate limiter for compute-heavy endpoints.
 *
 * Implementation is intentionally simple and allocation-light:
 * one ArrayDeque of request timestamps per client IP, pruned on
 * every request. No external library, no scheduler thread.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    /** Endpoints that burn real CPU (full scans, embedding, cleaning, reports). */
    private static final List<String> LIMITED_PREFIXES = List.of(
            "/api/scan/", "/api/clean/", "/api/eval/", "/api/report/",
            "/api/hide/", "/api/extract/"
    );

    private static final long WINDOW_MS = 60_000L;

    private final int requestsPerMinute;
    private final ConcurrentHashMap<String, ArrayDeque<Long>> windows = new ConcurrentHashMap<>();

    public RateLimitFilter(@Value("${steglab.ratelimit.requests-per-minute:10}") int requestsPerMinute) {
        this.requestsPerMinute = requestsPerMinute;
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        String path = request.getRequestURI();
        return LIMITED_PREFIXES.stream().noneMatch(path::startsWith);
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain)
            throws ServletException, IOException {

        String clientIp = resolveClientIp(request);
        long now = System.currentTimeMillis();

        ArrayDeque<Long> window = windows.computeIfAbsent(clientIp, k -> new ArrayDeque<>());
        boolean allowed;
        synchronized (window) {
            while (!window.isEmpty() && now - window.peekFirst() > WINDOW_MS) {
                window.pollFirst();
            }
            allowed = window.size() < requestsPerMinute;
            if (allowed) {
                window.addLast(now);
            }
        }

        if (!allowed) {
            response.setStatus(429);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write(
                    "{\"error\":\"Too many requests, please wait\",\"code\":\"RATE_LIMITED\"}");
            return;
        }

        // Opportunistic cleanup so idle IPs do not accumulate forever.
        if (windows.size() > 10_000) {
            windows.entrySet().removeIf(e -> {
                synchronized (e.getValue()) {
                    return !e.getValue().isEmpty() && now - e.getValue().peekLast() > WINDOW_MS;
                }
            });
        }

        chain.doFilter(request, response);
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            int comma = forwarded.indexOf(',');
            return comma > 0 ? forwarded.substring(0, comma).trim() : forwarded.trim();
        }
        return request.getRemoteAddr();
    }
}
