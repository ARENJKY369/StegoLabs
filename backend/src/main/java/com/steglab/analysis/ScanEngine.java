package com.steglab.analysis;

import com.steglab.core.Entropy;
import com.steglab.core.FileSignature;
import com.steglab.crypto.CryptoEnvelope;
import com.steglab.crypto.Wipe;
import com.steglab.exception.ApiException;
import com.steglab.image.ImageCodec;
import com.steglab.image.LsbImageStego;
import com.steglab.image.StegoHeader;
import com.steglab.model.PayloadClassification;
import com.steglab.model.ScanFinding;
import com.steglab.model.ScanReport;

import java.awt.image.BufferedImage;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * The nine-signal detection engine. Every signal contributes points and
 * a plain-English finding; the capped sum becomes the 0-100 risk score.
 *
 * Structural signals (1-4, 7, 8) are deterministic facts. Statistical
 * signals (5, 6, 9) are probabilistic and are labelled as such — the
 * UI shows the difference, and the documentation quotes the measured
 * false-positive rate on noisy images instead of hiding it.
 */
public final class ScanEngine {

    public static final Set<String> ALL_TESTS = Set.of(
            "signature", "trailing", "trailingEntropy", "embeddedSignatures",
            "chiSquare", "lsbBalance", "metadata", "invisibleUnicode", "lsbEntropy");

    private static final int BLOCK = 20;        // heatmap block size in pixels
    private static final int PLANE_MAX = 160;   // downsampled plane width cap

    private ScanEngine() {
    }

    public static ScanReport scan(byte[] data, String filename, Set<String> tests, String password) {
        long started = System.currentTimeMillis();
        if (tests == null || tests.isEmpty()) tests = ALL_TESTS;

        List<ScanFinding> findings = new ArrayList<>();
        FileSignature type = FileSignature.detect(data);

        // ---- Signal 1: extension vs magic bytes --------------------------
        if (tests.contains("signature")) {
            String ext = extensionOf(filename);
            if (!ext.isEmpty() && type != FileSignature.UNKNOWN && !extensionMatches(ext, type)) {
                findings.add(new ScanFinding("signature_mismatch",
                        "File signature mismatch", 25,
                        "The file is named ." + ext + " but its content is actually a "
                                + type.description() + ". Renaming a file is the oldest trick for sneaking "
                                + "data past filters.",
                        "magic=" + type.magicHex() + " vs extension=." + ext, true));
            }
        }

        // ---- Signals 2-4: trailing data ----------------------------------
        CarrierStructure.Trailing trailing = CarrierStructure.findTrailing(data, type);
        byte[] trailingBytes = null;
        PayloadClassification blind = null;

        if (trailing != null && trailing.trailingBytes() > 0) {
            trailingBytes = new byte[trailing.trailingBytes()];
            System.arraycopy(data, (int) trailing.endOfCarrier(), trailingBytes, 0, trailingBytes.length);

            if (tests.contains("trailing")) {
                findings.add(new ScanFinding("trailing_bytes",
                        "Trailing bytes after end marker", 30,
                        trailing.trailingBytes() + " bytes sit after the official end of this "
                                + type.description() + ". A clean file ends exactly at its end marker — "
                                + "extra data there was appended on purpose.",
                        "offset=" + trailing.endOfCarrier() + " trailing=" + trailing.trailingBytes() + " B", true));
            }

            if (tests.contains("trailingEntropy")) {
                double e = Entropy.ofBytes(trailingBytes);
                if (e > 7.5) {
                    findings.add(new ScanFinding("trailing_entropy",
                            "Trailing data is high-entropy", 10,
                            "The appended bytes measure " + fmt(e) + " bits/byte of entropy — "
                                    + "that density only comes from encryption or compression.",
                            "entropy=" + fmt(e) + " bits/byte over " + trailingBytes.length + " B", true));
                }
            }

            if (tests.contains("embeddedSignatures")) {
                ScanFinding emb = findEmbeddedSignature(trailingBytes, trailing.endOfCarrier());
                if (emb != null) findings.add(emb);
            }

            blind = PayloadClassifier.blind(trailingBytes, trailing.endOfCarrier());
        }

        // ---- Signal 7: metadata anomaly ----------------------------------
        if (tests.contains("metadata")) {
            ScanFinding meta = MetadataInspector.inspect(data, type);
            if (meta != null) findings.add(meta);
        }

        // ---- Signal 8: invisible Unicode (text-like files) ---------------
        // Gate on the DECODED text, not raw bytes: zero-width characters are
        // three bytes each in UTF-8 and would wreck a raw printable ratio.
        if (tests.contains("invisibleUnicode") && type == FileSignature.UNKNOWN
                && data.length < 10 * 1024 * 1024) {
            ScanFinding invisible = invisibleUnicodeFinding(data);
            if (invisible != null) findings.add(invisible);
        }

        // ---- Signals 5, 6, 9 + visual data: pixel statistics -------------
        double[][] heatmap = null;
        int[][] planeR = null, planeG = null, planeB = null;
        double entR = 0, entG = 0, entB = 0;
        int imgW = 0, imgH = 0;
        BufferedImage image = tryDecode(data, type);

        if (image != null) {
            imgW = image.getWidth();
            imgH = image.getHeight();
            int[][] channels = channelArrays(image);

            if (tests.contains("chiSquare")) {
                ScanFinding chi = chiSquareFinding(channels);
                if (chi != null) findings.add(chi);
            }

            LsbBlocks blocks = lsbBlocks(image);
            heatmap = blocks.fractions;
            if (tests.contains("lsbBalance")) {
                ScanFinding balance = lsbBalanceFinding(blocks);
                if (balance != null) findings.add(balance);
            }

            entR = planeEntropy(channels[0]);
            entG = planeEntropy(channels[1]);
            entB = planeEntropy(channels[2]);
            if (tests.contains("lsbEntropy")) {
                double worst = Math.max(entR, Math.max(entG, entB));
                if (worst > 0.95) {
                    String ch = worst == entR ? "R" : worst == entG ? "G" : "B";
                    findings.add(new ScanFinding("lsb_entropy",
                            "LSB plane entropy near maximum", 12,
                            "The lowest bits of the " + ch + " channel are almost perfectly random ("
                                    + fmt(worst) + " bits/bit). Natural photos sit around 0.6–0.85; "
                                    + "encrypted payloads push this towards 1.0.",
                            "H(R)=" + fmt(entR) + " H(G)=" + fmt(entG) + " H(B)=" + fmt(entB), false));
                }
            }

            planeR = downsamplePlane(image, 0);
            planeG = downsamplePlane(image, 1);
            planeB = downsamplePlane(image, 2);
        }

        // ---- Optional authenticated attempt -------------------------------
        PayloadClassification authenticated = null;
        String preview = null;
        if (password != null && !password.isEmpty()) {
            Object[] attempt = tryAuthenticated(image, trailingBytes, password);
            authenticated = (PayloadClassification) attempt[0];
            preview = (String) attempt[1];
        }

        // If nothing was appended but a StegLab LSB header exists, surface it
        // in the blind classification (it is honest structural information).
        if (blind == null && image != null) {
            StegoHeader header = LsbImageStego.readHeader(image);
            if (header != null) {
                blind = new PayloadClassification("blind",
                        "StegLab LSB payload (header present)", 0.0, 1.0,
                        0, null, List.of(), null);
            }
        }

        int score = Math.min(100, findings.stream().mapToInt(ScanFinding::points).sum());

        return new ScanReport(
                filename == null ? "unnamed" : filename,
                type == FileSignature.UNKNOWN ? guessUnknownType(data) : type.description(),
                data.length,
                score,
                ScanReport.labelFor(score),
                findings,
                tests.stream().sorted().toList(),
                blind,
                authenticated,
                preview,
                heatmap,
                BLOCK,
                planeR, planeG, planeB,
                round3(entR), round3(entG), round3(entB),
                imgW, imgH,
                System.currentTimeMillis() - started
        );
    }

    // ================================================================ helpers

    private static ScanFinding findEmbeddedSignature(byte[] trailing, long baseOffset) {
        FileSignature[] interesting = {
                FileSignature.ZIP, FileSignature.EXE, FileSignature.PDF, FileSignature.ELF};
        for (int i = 0; i < trailing.length; i++) {
            for (FileSignature sig : interesting) {
                if (sig.matchesAt(trailing, i)) {
                    return new ScanFinding("embedded_signature",
                            "Embedded file signature in appended data", 25,
                            "A complete " + sig.description() + " header starts inside the appended "
                                    + "region. Someone glued a second file onto this one.",
                            sig.name() + " header at byte " + (baseOffset + i), true);
                }
            }
        }
        return null;
    }

    private static ScanFinding chiSquareFinding(int[][] channels) {
        String[] names = {"R", "G", "B"};
        ChiSquareSweep.Result worst = null;
        String worstChannel = "";
        for (int c = 0; c < 3; c++) {
            ChiSquareSweep.Result r = ChiSquareSweep.sweep(channels[c]);
            if (worst == null
                    || r.equalizedFraction() > worst.equalizedFraction()
                    || (r.equalizedFraction() == worst.equalizedFraction() && r.minZ() < worst.minZ())) {
                worst = r;
                worstChannel = names[c];
            }
        }
        if (worst == null) return null;

        boolean prefixTrigger = worst.equalizedFraction() >= 0.05 && worst.equalizedPrefix() >= 512;
        boolean legacyTrigger = worst.minZ() <= -3.0;
        if (prefixTrigger) {
            return new ScanFinding("chi_square",
                    "Chi-square sweep: equalised prefix", 25,
                    "The first " + pct(worst.equalizedFraction()) + " of the " + worstChannel
                            + " channel has statistically equalised value pairs — the classic footprint "
                            + "of sequential LSB embedding (Westfeld–Pfitzmann).",
                    "z=" + worst.finalZ() + " minZ=" + worst.minZ() + " prefix="
                            + worst.equalizedPrefix() + " samples (" + pct(worst.equalizedFraction())
                            + ") channel=" + worstChannel, false);
        }
        if (legacyTrigger) {
            return new ScanFinding("chi_square",
                    "Chi-square statistic strongly equalised", 18,
                    "The pair statistics of the " + worstChannel + " channel dipped to z="
                            + worst.minZ() + " — value pairs are more equal than natural images "
                            + "ever are by chance.",
                    "minZ=" + worst.minZ() + " channel=" + worstChannel, false);
        }
        return null;
    }

    private record LsbBlocks(double[][] fractions, double nearEvenShare, int totalBlocks) {
    }

    private static LsbBlocks lsbBlocks(BufferedImage img) {
        int cols = Math.max(1, (img.getWidth() + BLOCK - 1) / BLOCK);
        int rows = Math.max(1, (img.getHeight() + BLOCK - 1) / BLOCK);
        double[][] fractions = new double[rows][cols];
        int nearEven = 0;
        int[] row = new int[img.getWidth()];

        long[][] ones = new long[rows][cols];
        long[][] totals = new long[rows][cols];
        for (int y = 0; y < img.getHeight(); y++) {
            img.getRGB(0, y, img.getWidth(), 1, row, 0, img.getWidth());
            int by = y / BLOCK;
            for (int x = 0; x < img.getWidth(); x++) {
                int bx = x / BLOCK;
                int rgb = row[x];
                ones[by][bx] += ((rgb >> 16) & 1) + ((rgb >> 8) & 1) + (rgb & 1);
                totals[by][bx] += 3;
            }
        }
        for (int r = 0; r < rows; r++) {
            for (int c = 0; c < cols; c++) {
                double f = totals[r][c] == 0 ? 0 : (double) ones[r][c] / totals[r][c];
                fractions[r][c] = Math.round(f * 1000.0) / 1000.0;
                if (f >= 0.47 && f <= 0.53) nearEven++;
            }
        }
        return new LsbBlocks(fractions, (double) nearEven / (rows * cols), rows * cols);
    }

    private static ScanFinding lsbBalanceFinding(LsbBlocks blocks) {
        if (blocks.totalBlocks() < 9) return null; // too small to judge
        if (blocks.nearEvenShare() > 0.75) {
            return new ScanFinding("lsb_balance",
                    "LSB balance uniform across blocks", 18,
                    pct(blocks.nearEvenShare()) + " of the image's 20×20 blocks have an almost "
                            + "perfect 50/50 split of low bits. Natural images vary block to block; "
                            + "uniform balance suggests injected random bits.",
                    "nearEvenBlocks=" + pct(blocks.nearEvenShare()) + " threshold=75%", false);
        }
        return null;
    }

    private static ScanFinding invisibleUnicodeFinding(byte[] data) {
        String text = new String(data, StandardCharsets.UTF_8);
        int[] counts = new int[5];
        char[] chars = {'\u200B', '\u200C', '\u200D', '\u2060', '\uFEFF'};
        String[] names = {"U+200B zero-width space", "U+200C zero-width non-joiner",
                "U+200D zero-width joiner", "U+2060 word joiner", "U+FEFF zero-width no-break"};
        int total = 0;
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            for (int k = 0; k < chars.length; k++) {
                if (ch == chars[k]) {
                    counts[k]++;
                    total++;
                }
            }
        }
        if (total <= 5) return null;
        StringBuilder tech = new StringBuilder();
        for (int k = 0; k < chars.length; k++) {
            if (counts[k] > 0) {
                if (tech.length() > 0) tech.append(", ");
                tech.append(names[k]).append("×").append(counts[k]);
            }
        }
        return new ScanFinding("invisible_unicode",
                "Invisible Unicode characters", 40,
                total + " zero-width characters hide between the visible letters of this text. "
                        + "They are unreadable to the eye and almost always carry encoded data.",
                tech.toString(), true);
    }

    private static Object[] tryAuthenticated(BufferedImage image, byte[] trailingBytes, String password) {
        char[] pw = password.toCharArray();
        byte[] plaintext = null;
        try {
            // 1. LSB envelope?
            if (image != null) {
                StegoHeader header = LsbImageStego.readHeader(image);
                if (header != null) {
                    try {
                        byte[] envelope = LsbImageStego.extractEnvelope(image, header, false, pw);
                        plaintext = CryptoEnvelope.open(envelope, pw);
                    } catch (ApiException ignored) {
                        // wrong password — classification stays blind
                    }
                }
            }
            // 2. Appended envelope?
            if (plaintext == null && trailingBytes != null
                    && CryptoEnvelope.looksLikeEnvelope(trailingBytes)) {
                try {
                    plaintext = CryptoEnvelope.open(trailingBytes, pw);
                } catch (ApiException ignored) {
                }
            }
            if (plaintext == null) return new Object[]{null, null};

            PayloadClassification auth = PayloadClassifier.authenticated(plaintext);
            String preview = null;
            if ("PLAIN_TEXT_MESSAGE".equals(auth.contentVerdict())
                    || "SCRIPT_WITH_SUSPICIOUS_INDICATORS".equals(auth.contentVerdict())) {
                String text = new String(plaintext, StandardCharsets.UTF_8);
                preview = text.length() > 160 ? text.substring(0, 160) + "…" : text;
            }
            return new Object[]{auth, preview};
        } finally {
            Wipe.chars(pw);
            Wipe.bytes(plaintext);
        }
    }

    private static BufferedImage tryDecode(byte[] data, FileSignature type) {
        if (type != FileSignature.PNG && type != FileSignature.BMP
                && type != FileSignature.JPEG && type != FileSignature.GIF) return null;
        try {
            return ImageCodec.decodeToRgb(data);
        } catch (ApiException e) {
            return null;
        }
    }

    private static int[][] channelArrays(BufferedImage img) {
        int w = img.getWidth(), h = img.getHeight();
        int[][] out = new int[3][w * h];
        int[] row = new int[w];
        for (int y = 0; y < h; y++) {
            img.getRGB(0, y, w, 1, row, 0, w);
            for (int x = 0; x < w; x++) {
                int i = y * w + x;
                out[0][i] = (row[x] >> 16) & 0xFF;
                out[1][i] = (row[x] >> 8) & 0xFF;
                out[2][i] = row[x] & 0xFF;
            }
        }
        return out;
    }

    private static double planeEntropy(int[] channel) {
        int ones = 0;
        for (int v : channel) ones += v & 1;
        return Entropy.ofBits(ones, channel.length);
    }

    private static int[][] downsamplePlane(BufferedImage img, int channel) {
        int w = img.getWidth(), h = img.getHeight();
        int stride = Math.max(1, (Math.max(w, h) + PLANE_MAX - 1) / PLANE_MAX);
        int outW = (w + stride - 1) / stride;
        int outH = (h + stride - 1) / stride;
        int[][] plane = new int[outH][outW];
        int shift = (2 - channel) * 8;
        for (int y = 0; y < outH; y++) {
            for (int x = 0; x < outW; x++) {
                int rgb = img.getRGB(Math.min(w - 1, x * stride), Math.min(h - 1, y * stride));
                plane[y][x] = (rgb >> shift) & 1;
            }
        }
        return plane;
    }

    private static String extensionOf(String filename) {
        if (filename == null) return "";
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) return "";
        return filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private static boolean extensionMatches(String ext, FileSignature type) {
        return switch (type) {
            case PNG -> ext.equals("png");
            case JPEG -> ext.equals("jpg") || ext.equals("jpeg") || ext.equals("jfif");
            case BMP -> ext.equals("bmp");
            case WAV -> ext.equals("wav");
            case PDF -> ext.equals("pdf");
            case ZIP -> ext.equals("zip") || ext.equals("docx") || ext.equals("xlsx")
                    || ext.equals("pptx") || ext.equals("jar") || ext.equals("apk") || ext.equals("odt");
            case EXE -> ext.equals("exe") || ext.equals("dll");
            case ELF -> ext.equals("so") || ext.equals("elf") || ext.equals("bin");
            case GIF -> ext.equals("gif");
            default -> true;
        };
    }

    private static String guessUnknownType(byte[] data) {
        return Entropy.printableRatio(data) > 0.85 ? "Text file" : "Unknown binary";
    }

    private static String fmt(double v) {
        return String.format(Locale.ROOT, "%.2f", v);
    }

    private static String pct(double fraction) {
        return String.format(Locale.ROOT, "%.1f%%", fraction * 100);
    }

    private static double round3(double v) {
        return Math.round(v * 1000.0) / 1000.0;
    }
}
