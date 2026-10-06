package com.steglab.clean;

import com.steglab.core.FileSignature;
import com.steglab.core.Uploads;
import com.steglab.exception.ApiException;
import com.steglab.model.CleanReport;
import com.steglab.model.CleanReport.CleanItem;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Clean & Verify dispatch: figure out what the file really is, run the
 * matching sanitizer, and report exactly what was removed. Cleaners are
 * conservative — a format we can't guarantee safe output for is refused
 * rather than half-cleaned.
 */
@Service
public class CleanService {

    public record CleanResult(byte[] cleaned, String extension, CleanReport report) {
    }

    public CleanResult clean(MultipartFile file, String profile) {
        boolean deep = switch (profile == null ? "standard" : profile) {
            case "standard" -> false;
            case "deep" -> true;
            default -> throw ApiException.badRequest("BAD_PROFILE",
                    "Profile must be 'standard' (metadata strip) or 'deep' (metadata + signal-plane scrub).");
        };

        byte[] data = Uploads.requireBytes(file);
        FileSignature type = FileSignature.detect(data);
        return switch (type) {
            case PNG -> image(data, "png", deep, "PNG image");
            case BMP -> image(data, "bmp", deep, "Bitmap image");
            case JPEG -> image(data, "jpeg", deep, "JPEG image");
            case GIF -> image(data, "png", deep, "GIF image"); // re-encoded as PNG (palette scrub)
            case WAV -> wav(data, deep);
            case PDF -> pdf(data, deep);
            case ZIP -> zip(data);
            case UNKNOWN -> textOrRefuse(data, file, deep);
            case EXE, ELF -> throw ApiException.badRequest("NOT_CLEANABLE",
                    "Executables can't be safely cleaned byte-by-byte without breaking them. "
                            + "Rebuild from source instead — that IS the clean.");
        };
    }

    private CleanResult image(byte[] data, String format, boolean deep, String humanType) {
        ImageCleaner.Result r = ImageCleaner.clean(data, format, deep);
        List<String> notes = new ArrayList<>(r.notes());
        String residual = deep ? "LOW" : "REDUCED";
        if (!deep) {
            notes.add("Standard profile keeps every pixel untouched — LSB-hidden "
                    + "data (if any) survives. Use the deep profile to also scramble the LSB plane.");
        } else {
            notes.add("Deep profile randomised the lowest colour bit of every pixel — "
                    + "any LSB payload was destroyed along with the original LSB noise.");
        }
        String ext = "png".equals(format) ? "png" : format;
        return new CleanResult(r.bytes(), ext,
                new CleanReport(humanType, deep ? "deep" : "standard",
                        data.length, r.bytes().length, r.items(), notes, residual));
    }

    private CleanResult wav(byte[] data, boolean deep) {
        WavCleaner.Result r = WavCleaner.clean(data, deep);
        List<String> notes = new ArrayList<>(r.notes());
        if (!deep) {
            notes.add("Standard profile keeps every sample untouched — LSB-hidden "
                    + "data (if any) survives. Use the deep profile to scramble the sample LSBs.");
        } else {
            notes.add("Deep profile randomised the lowest bit of every sample.");
        }
        return new CleanResult(r.bytes(), "wav",
                new CleanReport("WAV audio", deep ? "deep" : "standard",
                        data.length, r.bytes().length, r.items(), notes, deep ? "LOW" : "REDUCED"));
    }

    private CleanResult pdf(byte[] data, boolean deep) {
        PdfCleaner.Result r = PdfCleaner.clean(data, deep);
        List<String> notes = new ArrayList<>(r.notes());
        notes.add("Residual risk: the page content itself (text and images inside the "
                + "document) is not altered — data could in principle be hidden there. "
                + "That kind of embedding requires rewriting content, which no cleaner "
                + "can do without changing what the document says.");
        return new CleanResult(r.bytes(), "pdf",
                new CleanReport("PDF document", deep ? "deep" : "standard",
                        data.length, r.bytes().length, r.items(), notes, "REDUCED"));
    }

    private CleanResult zip(byte[] data) {
        ZipCleaner.Result r = ZipCleaner.clean(data);
        List<String> notes = new ArrayList<>(r.notes());
        notes.add("Only bytes appended after the archive's official end are removed — "
                + "the archive contents themselves are never touched.");
        return new CleanResult(r.bytes(), "zip",
                new CleanReport("ZIP archive", "standard",
                        data.length, r.bytes().length, r.items(), notes, "REDUCED"));
    }

    /**
     * Formats without magic bytes: treat as text when it decodes cleanly as
     * (mostly) printable UTF-8, otherwise refuse honestly.
     */
    private CleanResult textOrRefuse(byte[] data, MultipartFile file, boolean deep) {
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
        boolean looksTextual = looksLikeText(data);
        boolean textyName = name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".log")
                || name.endsWith(".csv") || name.endsWith(".json") || name.endsWith(".xml")
                || name.endsWith(".html") || name.endsWith(".htm");
        if (!looksTextual && !textyName) {
            throw ApiException.badRequest("NOT_CLEANABLE",
                    "StegLab can't identify this file type, so it can't promise a safe clean. "
                            + "Re-export the content in a supported format (PNG, WAV, PDF, ZIP, plain text).");
        }
        TextCleaner.Result r = TextCleaner.clean(data, deep);
        List<String> notes = new ArrayList<>(r.notes());
        if (deep) {
            notes.add("Deep profile additionally collapsed runs of blank lines.");
        }
        return new CleanResult(r.bytes(), "txt",
                new CleanReport("Plain text", deep ? "deep" : "standard",
                        data.length, r.bytes().length, r.items(), notes, "LOW"));
    }

    private static boolean looksLikeText(byte[] data) {
        int check = Math.min(data.length, 8192);
        int bad = 0;
        for (int i = 0; i < check; i++) {
            int b = data[i] & 0xFF;
            boolean ok = b == 9 || b == 10 || b == 13 || (b >= 32 && b < 127) || b >= 0xC2;
            if (!ok && ++bad > check / 100 + 4) return false;
        }
        String probe = new String(data, 0, check, StandardCharsets.UTF_8);
        return !probe.contains("�");
    }
}
