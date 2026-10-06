package com.steglab.clean;

import com.steglab.image.ImageCodec;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

import com.steglab.model.CleanReport.CleanItem;

/**
 * Image sanitation: decode the pixels and re-encode from scratch, which
 * strips every metadata block (EXIF, XMP, iCCP, comments, text chunks) plus
 * any trailing bytes, because none of them survive a full decode.
 *
 * "Deep" profile additionally randomises the lowest bits of every colour
 * channel — visually imperceptible, but deterministic death for LSB-hidden
 * payloads (including StegLab's own format: the header is shredded).
 */
public final class ImageCleaner {

    private static final SecureRandom RANDOM = new SecureRandom();

    private ImageCleaner() {
    }

    public record Result(byte[] bytes, List<CleanItem> items, List<String> notes) {
    }

    /**
     * @param formatName output format: "png", "bmp" or "jpeg"
     * @param deep       randomise the lowest bit of every channel value
     */
    public static Result clean(byte[] data, String formatName, boolean deep) {
        BufferedImage decoded = ImageCodec.decodeToRgb(data);
        List<CleanItem> items = new ArrayList<>();
        List<String> notes = new ArrayList<>();

        items.add(new CleanItem("Metadata", "All metadata blocks dropped (EXIF, XMP, comments, profiles)", 1));

        long before = data.length;

        long pixelsScrubbed = 0;
        if (deep) {
            int w = decoded.getWidth();
            int h = decoded.getHeight();
            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    int rgb = decoded.getRGB(x, y);
                    // Randomise LSB of R, G and B.
                    int r = (rgb >> 16) & 0xFE | (RANDOM.nextInt(2));
                    int g = (rgb >> 8) & 0xFE | (RANDOM.nextInt(2));
                    int b = (rgb & 0xFE) | (RANDOM.nextInt(2));
                    decoded.setRGB(x, y, (rgb & 0xFF000000) | (r << 16) | (g << 8) | b);
                }
            }
            pixelsScrubbed = (long) w * h;
            items.add(new CleanItem("LSB plane",
                    "Lowest colour bit of every pixel randomised", pixelsScrubbed));
        }

        byte[] out = writeImage(decoded, formatName, items, notes);
        long diff = before - out.length;
        if (diff > 0) {
            items.add(new CleanItem("Container",
                    "Non-pixel data removed by full re-encode (trailing bytes, ancillary chunks)", diff));
        }
        if (deep && out.length > before) {
            notes.add("The cleaned file is larger than the original: the randomised LSB plane "
                    + "defeats lossless compression. That is expected — and it is also why "
                    + "a suspiciously hard-to-compress LSB plane is itself a stego signal.");
        }

        return new Result(out, items, notes);
    }

    private static byte[] writeImage(BufferedImage image, String formatName,
                                     List<CleanItem> items, List<String> notes) {
        try {
            if ("jpeg".equals(formatName)) {
                ImageWriter writer = jpegWriter();
                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                ImageWriteParam param = writer.getDefaultWriteParam();
                param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                param.setCompressionQuality(0.95f);
                // Not attaching any ImageMetadata → no EXIF/XMP in output.
                writer.setOutput(new MemoryCacheImageOutputStream(bos));
                writer.write(null, new IIOImage(image, null, null), param);
                writer.dispose();
                return bos.toByteArray();
            }
            // PNG/BMP/GIF paths go through the plain writer — ImageIO never
            // re-attaches source metadata when writing a bare BufferedImage.
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            ImageIO.write(image, formatName, bos);
            return bos.toByteArray();
        } catch (java.io.IOException e) {
            throw com.steglab.exception.ApiException.unreadableFile();
        }
    }

    private static ImageWriter jpegWriter() {
        Iterator<ImageWriter> it = ImageIO.getImageWritersByFormatName("jpeg");
        if (!it.hasNext()) throw new IllegalStateException("JPEG writer unavailable");
        return it.next();
    }
}
