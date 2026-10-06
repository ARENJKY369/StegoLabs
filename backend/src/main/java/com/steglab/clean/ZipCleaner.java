package com.steglab.clean;

import com.steglab.exception.ApiException;
import com.steglab.model.CleanReport.CleanItem;

import java.util.ArrayList;
import java.util.List;

/**
 * ZIP sanitation: locate the End Of Central Directory record and cut the
 * file exactly where it ends. Archives are read through their central
 * directory, so anything appended after it (the classic way to smuggle a
 * payload — appended archives, "polyglot" files) is safely removable
 * without touching the archive itself.
 */
public final class ZipCleaner {

    private static final int EOCD_SIG = 0x06054B50;   // little-endian
    private static final int EOCD_MIN = 22;
    private static final int MAX_COMMENT = 65535;

    private ZipCleaner() {
    }

    public record Result(byte[] bytes, List<CleanItem> items, List<String> notes) {
    }

    public static Result clean(byte[] data) {
        List<CleanItem> items = new ArrayList<>();
        List<String> notes = new ArrayList<>();

        // The EOCD is within the last 22 + 65535 bytes, but scanning the
        // last 1 MB is cheap and handles pathological comments fine.
        int window = Math.min(data.length, EOCD_MIN + MAX_COMMENT + 512 * 1024);
        int eocdOffset = -1;
        for (int i = data.length - EOCD_MIN; i >= data.length - window; i--) {
            if (i < 0) break;
            if ((data[i] & 0xFF) == 0x50 && (data[i + 1] & 0xFF) == 0x4B
                    && (data[i + 2] & 0xFF) == 0x05 && (data[i + 3] & 0xFF) == 0x06) {
                eocdOffset = i;
                break;
            }
        }
        if (eocdOffset < 0) {
            throw ApiException.badRequest("BAD_ZIP",
                    "This looks like a ZIP archive but its central directory could not be located.");
        }
        int commentLen = (data[eocdOffset + 20] & 0xFF) | ((data[eocdOffset + 21] & 0xFF) << 8);
        int naturalEnd = eocdOffset + EOCD_MIN + commentLen;
        long trailing = data.length - naturalEnd;
        if (trailing > 0) {
            items.add(new CleanItem("Appended data",
                    "Bytes after the archive's official end removed", trailing));
            byte[] out = new byte[naturalEnd];
            System.arraycopy(data, 0, out, 0, naturalEnd);
            return new Result(out, items, notes);
        }
        notes.add("The archive ends exactly where its directory says — nothing appended.");
        return new Result(data, items, notes);
    }
}
