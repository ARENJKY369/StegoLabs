import TopBar from "@/components/shell/TopBar";
import TextWorkbench from "@/components/text/TextWorkbench";

export const metadata = { title: "Text & Docs" };

export default function TextPage() {
  return (
    <>
      <TopBar
        title="Text & Docs"
        subtitle="Zero-width and whitespace techniques for any text channel"
      />
      <main className="flex-1 p-4 lg:p-6">
        <TextWorkbench />
      </main>
    </>
  );
}
