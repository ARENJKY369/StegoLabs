import type { Metadata, Viewport } from "next";
import "./globals.css";
import Sidebar from "@/components/shell/Sidebar";

export const metadata: Metadata = {
  title: {
    default: "StegLab — hide, find and clean hidden data",
    template: "%s · StegLab",
  },
  description:
    "The complete offline steganography workbench: hide, extract, detect, classify, clean and report on hidden content across images, audio, text and documents.",
};

export const viewport: Viewport = {
  themeColor: "#0a0f1a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        </div>
      </body>
    </html>
  );
}
