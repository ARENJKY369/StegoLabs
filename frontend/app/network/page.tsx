import PagePlaceholder from "@/components/shell/PagePlaceholder";
import { Waypoints } from "lucide-react";

export const metadata = { title: "Network Sim" };

export default function Page() {
  return (
    <PagePlaceholder
      title="Network Sim"
      subtitle="Covert channel simulation and timing analysis"
      icon={Waypoints}
      note="A safe, local simulation of network covert channels is planned for this page."
    />
  );
}
