package com.steglab.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS is deliberately narrow: only the configured frontend origins may call
 * the API from a browser. In the docker-compose setup the Next.js server
 * proxies /api/* internally, so browsers normally never need CORS at all.
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    private final String[] allowedOrigins;

    public CorsConfig(@Value("${steglab.cors.allowed-origins:http://localhost:3000}") String origins) {
        this.allowedOrigins = origins.split("\\s*,\\s*");
    }

    @Override
    public void addCorsMappings(@NonNull CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "POST", "OPTIONS")
                .allowedHeaders("*")
                .exposedHeaders("Content-Disposition", "X-Steglab-Meta")
                .maxAge(3600);
    }
}
