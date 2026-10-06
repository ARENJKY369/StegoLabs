import TopBar from "@/components/shell/TopBar";
import ImageWorkbench from "@/components/image/ImageWorkbench";

export const metadata = { title: "Image Stego" };

export default function ImagePage() {
  return (
    <>
      <TopBar
        title="Image Stego"
        subtitle="Hide a message inside a photo, or pull one back out"
      />
      <main className="flex-1 p-4 lg:p-6">
        <ImageWorkbench />
      </main>
    </>
  );
}
