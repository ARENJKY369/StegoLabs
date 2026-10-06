import TopBar from "@/components/shell/TopBar";
import AudioWorkbench from "@/components/audio/AudioWorkbench";

export const metadata = { title: "Audio Stego" };

export default function AudioPage() {
  return (
    <>
      <TopBar
        title="Audio Stego"
        subtitle="Hide and extract messages inside WAV audio"
      />
      <main className="flex-1 p-4 lg:p-6">
        <AudioWorkbench />
      </main>
    </>
  );
}
