import PagePlaceholder from "@/components/shell/PagePlaceholder";
import { Settings } from "lucide-react";

export const metadata = { title: "Settings" };

export default function Page() {
  return (
    <PagePlaceholder
      title="Settings"
      subtitle="Session preferences"
      icon={Settings}
      note="StegLab stores nothing, so there is very little to configure — theme and defaults arrive later."
    />
  );
}
