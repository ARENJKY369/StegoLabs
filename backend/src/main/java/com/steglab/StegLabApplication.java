package com.steglab;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * StegLab — offline steganography workbench.
 *
 * Design constraints enforced across the codebase:
 *  - pure JDK 17 for all signal processing (imageio, sound.sampled, crypto)
 *  - nothing persisted beyond the request lifecycle
 *  - no plaintext messages or passwords ever written to logs
 */
@SpringBootApplication
public class StegLabApplication {

    public static void main(String[] args) {
        // Headless: image processing must never try to attach a display.
        System.setProperty("java.awt.headless", "true");
        SpringApplication.run(StegLabApplication.class, args);
    }
}
