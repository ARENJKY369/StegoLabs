package com.steglab.clean;

import com.steglab.model.CleanReport.CleanItem;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Text sanitation: strip every invisible format character (Unicode
 * category Cf — which covers the zero-width alphabet, BiDi controls and
 * word joiners), remove any byte-order mark, trim trailing spaces and
 * tabs line by line, and normalise CRLF to LF.
 */
public final class TextCleaner {

    private TextCleaner() {
    }

    public record Result(byte[] bytes, List<CleanItem> items, List<String> notes) {
    }

    public static Result clean(byte[] data, boolean deep) {
        String text = new String(data, StandardCharsets.UTF_8);
        List<CleanItem> items = new ArrayList<>();
        List<String> notes = new ArrayList<>();

        long invisible = 0;
        long bom = 0;
        StringBuilder sb = new StringBuilder(text.length());
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c == '\uFEFF') {          // U+FEFF byte-order mark
                bom++;
                continue;
            }
            int type = Character.getType(c);
            if (type == Character.FORMAT && !Character.isWhitespace(c)) {
                invisible++;
                continue;
            }
            sb.append(c);
        }

        // Trailing spaces/tabs per line + normalise CRLF.
        long trailing = 0;
        String[] lines = sb.toString().split("\n", -1);
        StringBuilder out = new StringBuilder(sb.length());
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i];
            int end = line.length();
            while (end > 0) {
                char c = line.charAt(end - 1);
                if (c == ' ' || c == '\t' || c == '\r') end--;
                else break;
            }
            trailing += line.length() - end;
            out.append(line, 0, end);
            if (i < lines.length - 1) out.append('\n');
        }

        // Collapse 3+ consecutive blank lines to 2 (deep only — cosmetic).
        String cleaned = out.toString();
        if (deep) {
            cleaned = cleaned.replaceAll("\n{4,}", "\n\n\n");
        }

        if (invisible > 0) {
            items.add(new CleanItem("Invisible Unicode",
                    "Format characters removed (zero-width, BiDi controls, joiners)", invisible));
        }
        if (bom > 0) {
            items.add(new CleanItem("File framing", "Byte-order mark removed", bom));
        }
        if (trailing > 0) {
            items.add(new CleanItem("Whitespace", "Trailing spaces and tabs trimmed from line ends", trailing));
        }
        if (items.isEmpty()) {
            notes.add("The text was already clean — nothing needed removing.");
        }
        return new Result(cleaned.getBytes(StandardCharsets.UTF_8), items, notes);
    }
}
