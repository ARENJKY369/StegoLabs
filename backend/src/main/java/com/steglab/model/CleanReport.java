package com.steglab.model;

import java.util.List;

/** Result of a cleaning operation, returned in X-Steglab-Meta alongside the sanitised file. */
public record CleanReport(
        String fileType,              // human type name, e.g. "PNG image"
        String profile,               // standard | deep
        long beforeBytes,
        long afterBytes,
        List<CleanItem> itemsRemoved,
        List<String> notes,
        String residualRisk           // LOW | REDUCED | NOT_CLEANABLE
) {

    public record CleanItem(String category, String detail, long count) {
    }
}
