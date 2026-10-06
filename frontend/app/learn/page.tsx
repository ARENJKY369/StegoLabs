import PagePlaceholder from "@/components/shell/PagePlaceholder";
import { GraduationCap } from "lucide-react";

export const metadata = { title: "Learn" };

export default function Page() {
  return (
    <PagePlaceholder
      title="Learn"
      subtitle="How steganography actually works, bit by bit"
      icon={GraduationCap}
      note="An interactive pixel-level explainer and an honest limitations section are coming here."
    />
  );
}
