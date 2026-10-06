import TopBar from "@/components/shell/TopBar";
import CleanWorkbench from "@/components/clean/CleanWorkbench";

export const metadata = { title: "Clean & Verify" };

export default function CleanPage() {
  return (
    <>
      <TopBar
        title="Clean & Verify"
        subtitle="Remove hidden data and metadata, then prove it is gone"
      />
      <main className="flex-1 p-4 lg:p-6">
        <CleanWorkbench />
      </main>
    </>
  );
}
