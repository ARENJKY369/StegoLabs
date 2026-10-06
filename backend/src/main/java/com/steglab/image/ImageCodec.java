package com.steglab.image;

import com.steglab.core.FileSignature;
import com.steglab.exception.ApiException;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

/**
 * Reading and writing carriers. Hiding accepts PNG and BMP only —
 * both lossless — and output is always PNG so no compressor can
 * touch the LSB plane afterwards.
 */
public final class ImageCodec {

    private ImageCodec() {
    }

    /** Decode a PNG/BMP carrier into TYPE_INT_RGB, rejecting JPEG loudly. */
    public static BufferedImage readCarrier(byte[] bytes) {
        FileSignature sig = FileSignature.detect(bytes);
        if (sig == FileSignature.JPEG) {
            throw ApiException.jpegRejected();
        }
        if (sig != FileSignature.PNG && sig != FileSignature.BMP) {
            throw ApiException.badRequest("UNSUPPORTED_TYPE",
                    "Only PNG and BMP images can carry hidden data here. "
                            + "Use Utilities to convert your file first.");
        }
        return decodeToRgb(bytes);
    }

    /** Decode any supported image (scanner paths accept JPEG too). */
    public static BufferedImage decodeToRgb(byte[] bytes) {
        BufferedImage decoded;
        try {
            decoded = ImageIO.read(new ByteArrayInputStream(bytes));
        } catch (IOException e) {
            throw ApiException.unreadableFile();
        }
        if (decoded == null) {
            throw ApiException.unreadableFile();
        }
        if (decoded.getType() == BufferedImage.TYPE_INT_RGB) {
            return decoded;
        }
        BufferedImage rgb = new BufferedImage(
                decoded.getWidth(), decoded.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = rgb.createGraphics();
        try {
            g.drawImage(decoded, 0, 0, null);
        } finally {
            g.dispose();
        }
        return rgb;
    }

    /** Encode as PNG, verifying ImageIO actually produced output. */
    public static byte[] writePng(BufferedImage image) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            boolean written = ImageIO.write(image, "png", out);
            if (!written) {
                throw new IllegalStateException("PNG writer unavailable");
            }
        } catch (IOException e) {
            throw new IllegalStateException("PNG encoding failed", e);
        }
        return out.toByteArray();
    }

    /** Encode as BMP (for the PNG→BMP utility). */
    public static byte[] writeBmp(BufferedImage image) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            boolean written = ImageIO.write(image, "bmp", out);
            if (!written) {
                throw new IllegalStateException("BMP writer unavailable");
            }
        } catch (IOException e) {
            throw new IllegalStateException("BMP encoding failed", e);
        }
        return out.toByteArray();
    }
}
