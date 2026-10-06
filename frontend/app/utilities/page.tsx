import PagePlaceholder from "@/components/shell/PagePlaceholder";
import { Wrench } from "lucide-react";

export const metadata = { title: "Utilities" };

export default function Page() {
  return (
    <PagePlaceholder
      title="Utilities"
      subtitle="Hex viewer, entropy maps, converters and format tools"
      icon={Wrench}
      note="The analyst toolbox is under construction."
    />
  );
}
