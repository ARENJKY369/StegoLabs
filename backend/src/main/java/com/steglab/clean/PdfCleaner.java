package com.steglab.clean;

import com.steglab.model.CleanReport.CleanItem;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentInformation;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * PDF sanitation with PDFBox: drop the whole Info dictionary and XMP
 * metadata stream (every author/title/tool fingerprint lives there, plus
 * any metadata-embedded stego), remove embedded file attachments, and
 * strip document-level JavaScript / auto-open actions. Content streams
 * (the actual pages) are left intact.
 */
public final class PdfCleaner {

    private PdfCleaner() {
    }

    public record Result(byte[] bytes, List<CleanItem> items, List<String> notes) {
    }

    public static Result clean(byte[] data, boolean deep) {
        List<CleanItem> items = new ArrayList<>();
        List<String> notes = new ArrayList<>();
        try (PDDocument doc = PDDocument.load(data)) {

            // 1. Info dictionary.
            PDDocumentInformation info = doc.getDocumentInformation();
            if (info != null) {
                int keys = info.getMetadataKeys().size();
                if (keys > 0) {
                    items.add(new CleanItem("Metadata",
                            "Info dictionary cleared (" + keys + " entries: author, producer, tool fingerprints…)",
                            keys));
                }
                doc.setDocumentInformation(new PDDocumentInformation());
            }

            // 2. XMP metadata stream.
            if (doc.getDocumentCatalog().getMetadata() != null) {
                doc.getDocumentCatalog().setMetadata(null);
                items.add(new CleanItem("Metadata", "XMP metadata stream removed", 1));
            }

            var catalog = doc.getDocumentCatalog();
            var names = catalog.getNames();
            if (names != null) {
                // 3. Embedded files.
                var embedded = names.getEmbeddedFiles();
                if (embedded != null && embedded.getNames() != null && !embedded.getNames().isEmpty()) {
                    int count = embedded.getNames().size();
                    names.setEmbeddedFiles(null);
                    items.add(new CleanItem("Embedded files",
                            "File attachments removed from the document", count));
                }
                // 4. Document-level JavaScript.
                var js = names.getJavaScript();
                if (js != null && js.getNames() != null && !js.getNames().isEmpty()) {
                    int count = js.getNames().size();
                    names.setJavaScript(null);
                    items.add(new CleanItem("Active content",
                            "Document-level JavaScript actions removed", count));
                }
                if (names.getCOSObject().size() == 0) {
                    catalog.setNames(null);
                }
            }

            // 5. Auto-open actions (launch / save-as triggers).
            if (catalog.getOpenAction() != null) {
                catalog.setOpenAction(null);
                items.add(new CleanItem("Active content", "Auto-open action removed", 1));
            }

            // 6. Viewer preferences don't leak data but reset them anyway on deep clean.
            if (deep && catalog.getViewerPreferences() != null) {
                catalog.setViewerPreferences(null);
                notes.add("Viewer preferences reset (deep profile).");
            }

            // Remove orphan piece-info / private extensions some producers hide data in.
            if (catalog.getCOSObject().containsKey(COSName.getPDFName("PieceInfo"))) {
                catalog.getCOSObject().removeItem(COSName.getPDFName("PieceInfo"));
                items.add(new CleanItem("Container", "Private PieceInfo extension block removed", 1));
            }

            if (items.isEmpty()) {
                notes.add("No metadata, attachments or active content found — the document was already clean.");
            }

            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            doc.save(bos);
            return new Result(bos.toByteArray(), items, notes);
        } catch (java.io.IOException e) {
            throw com.steglab.exception.ApiException.badRequest("UNREADABLE_FILE",
                    "This PDF could not be parsed — it may be corrupted or password-protected. "
                            + "StegLab won't touch it.");
        }
    }
}
