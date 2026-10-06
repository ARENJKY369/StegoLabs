import { jsPDF } from "jspdf";
import { formatBytes } from "@/lib/format";
import type { ScanReport } from "@/lib/scanner";

/**
 * Single-file scan report as an A4 PDF — generated entirely client-side.
 * Layout is print-first: light page, high contrast, no dependency on the
 * app's dark theme.
 */
export function downloadScanPdf(report: ScanReport) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;                    // margin
  const contentW = W - M * 2;
  let y = 0;

  const verdictColor: [number, number, number] =
    report.score >= 60 ? [196, 43, 43] : report.score >= 25 ? [217, 132, 11] : [22, 146, 89];

  // ---------- header band ----------
  doc.setFillColor(20, 26, 40);
  doc.rect(0, 0, W, 74, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("StegLab — Steganalysis Report", M, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(160, 170, 190);
  doc.text(
    `Offline analysis · no file left this machine · ${new Date().toLocaleString()}`,
    M,
    50,
  );
  doc.text(
    `scanned ${report.testsRun.length}/9 tests in ${report.scanDurationMs} ms`,
    M,
    62,
  );
  y = 100;

  // ---------- file block ----------
  doc.setTextColor(90, 96, 108);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("SUBJECT FILE", M, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 34, 44);
  doc.setFontSize(11.5);
  doc.text(truncate(report.filename, 70), M, y + 15);
  doc.setFontSize(9);
  doc.setTextColor(90, 96, 108);
  doc.text(
    `${report.detectedType}  ·  ${formatBytes(report.sizeBytes)}` +
      (report.imageWidth > 0 ? `  ·  ${report.imageWidth}×${report.imageHeight}` : ""),
    M,
    y + 29,
  );

  // ---------- score block ----------
  const boxX = W - M - 170;
  doc.setDrawColor(...verdictColor);
  doc.setLineWidth(1.2);
  doc.roundedRect(boxX, y - 14, 170, 58, 6, 6, "S");
  doc.setTextColor(...verdictColor);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(`${report.score}`, boxX + 14, y + 20);
  doc.setFontSize(7.5);
  doc.text("/100", boxX + 14 + doc.getTextWidth(`${report.score} `), y + 20);
  doc.setFontSize(9.5);
  doc.text(wrap(report.label, 26)[0] ?? "", boxX + 52, y + 12);
  const labelLines = wrap(report.label, 26);
  if (labelLines[1]) doc.text(labelLines[1], boxX + 52, y + 23);
  y += 62;

  doc.setDrawColor(222, 226, 234);
  doc.setLineWidth(0.6);
  doc.line(M, y, W - M, y);
  y += 18;

  // ---------- findings ----------
  doc.setTextColor(90, 96, 108);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("FINDINGS", M, y);
  y += 14;

  if (report.findings.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 34, 44);
    y = para(
      doc,
      `No positive signals — all ${report.testsRun.length} selected tests passed. ` +
        `This means no detectable trace among those tests; it is not a proof that no data is hidden.`,
      M,
      y,
      contentW,
      13,
    );
  }

  report.findings.forEach((f, idx) => {
    if (y > 720) {
      doc.addPage();
      y = 56;
    }
    const kind = f.deterministic ? "FACT" : "STATISTICAL";
    const color: [number, number, number] = f.deterministic ? [196, 43, 43] : [217, 132, 11];

    doc.setFillColor(...color);
    doc.roundedRect(M, y - 8, 62, 13, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(kind, M + 4, y + 1);

    doc.setTextColor(30, 34, 44);
    doc.setFontSize(10.5);
    doc.text(`${idx + 1}. ${f.name}`, M + 70, y + 1);

    doc.setTextColor(...color);
    doc.setFontSize(10.5);
    doc.text(`+${f.points}`, W - M - doc.getTextWidth(`+${f.points}`), y + 1);
    y += 14;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(70, 76, 90);
    doc.setFontSize(9);
    y = para(doc, f.detail, M + 70, y, contentW - 70, 12.5);

    if (f.technical) {
      doc.setFont("courier", "normal");
      doc.setTextColor(110, 116, 130);
      doc.setFontSize(7.5);
      y = para(doc, f.technical, M + 70, y + 2, contentW - 70, 10);
    }
    y += 8;
  });

  // ---------- payload classification ----------
  const blind = report.payloadClassification;
  const auth = report.authenticatedClassification;
  if ((blind || auth) && y < 640) {
    if (y > 700) {
      doc.addPage();
      y = 56;
    }
    y += 6;
    doc.setDrawColor(222, 226, 234);
    doc.line(M, y, W - M, y);
    y += 16;
    doc.setTextColor(90, 96, 108);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("PAYLOAD CLASSIFICATION", M, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 34, 44);
    doc.setFontSize(9);
    if (blind) {
      y = para(
        doc,
        `Blind view (structural): near certainty (${Math.round(
          blind.confidence * 100,
        )}%) an encrypted block of ${formatBytes(report.sizeBytes - blind.offset)} ` +
          `begins at offset ${blind.offset}`,
        M,
        y,
        contentW,
        12.5,
      );
    }
    if (auth?.contentVerdict) {
      y = para(
        doc,
        `Authenticated view (after decryption):  ${auth.contentVerdict.replaceAll("_", " ")}` +
          (auth.matchedKeywords.length > 0
            ? ` — matched indicators: ${auth.matchedKeywords.join(", ")}`
            : ""),
        M,
        y + 2,
        contentW,
        12.5,
      );
    }
    if (report.extractedPreview) {
      doc.setFont("courier", "normal");
      doc.setTextColor(70, 76, 90);
      doc.setFontSize(8);
      y = para(
        doc,
        `Decrypted preview: "${report.extractedPreview.replaceAll("\n", " ↵ ").slice(0, 300)}"`,
        M,
        y + 2,
        contentW,
        11,
      );
      doc.setFont("helvetica", "normal");
    }
  }

  // ---------- honesty footer on every page ----------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const H = doc.internal.pageSize.getHeight();
    doc.setDrawColor(222, 226, 234);
    doc.line(M, H - 66, W - M, H - 66);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(140, 146, 158);
    const foot =
      "Interpretation: deterministic findings are structural facts. Statistical findings are probabilistic — " +
      "noisy natural photos can false-positive (measured 21.9% in StegLab's test battery), and low-rate " +
      "scattered payloads can false-negative. A clean score means no signal among the tests run, not a " +
      "proof of absence.";
    const lines = doc.splitTextToSize(foot, contentW);
    doc.text(lines, M, H - 54);
    doc.text(`StegLab report · page ${p} of ${pages}`, M, H - 34);
    doc.text(`verdict: ${report.label}`, W - M - doc.getTextWidth(`verdict: ${report.label}`), H - 34);
  }

  const safe = report.filename.replace(/[^\w.-]/g, "_");
  doc.save(`steglab-report-${safe}.pdf`);
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function wrap(s: string, n: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > n && line) {
      lines.push(line);
      line = w;
    } else {
      line = (line + " " + w).trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Draw wrapped text, returning the y after the last line. */
function para(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
): number {
  const lines = doc.splitTextToSize(text, maxW) as string[];
  for (const line of lines) {
    doc.text(line, x, y);
    y += lineH;
  }
  return y;
}
