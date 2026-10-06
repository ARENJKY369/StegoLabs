import TopBar from "@/components/shell/TopBar";
import ScannerWorkbench from "@/components/scanner/ScannerWorkbench";

export const metadata = { title: "Scanner" };

export default function ScannerPage() {
  return (
    <>
      <TopBar
        title="Scanner"
        subtitle="Nine detection signals, one explainable risk score"
      />
      <main className="flex-1 p-4 lg:p-6">
        <ScannerWorkbench />
      </main>
    </>
  );
}
