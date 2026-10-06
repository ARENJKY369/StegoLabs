import PagePlaceholder from "@/components/shell/PagePlaceholder";
import { BookOpen } from "lucide-react";

export const metadata = { title: "Documentation" };

export default function Page() {
  return (
    <PagePlaceholder
      title="Documentation"
      subtitle="How every module and signal works"
      icon={BookOpen}
      note="Full module documentation is written alongside each feature."
    />
  );
}
