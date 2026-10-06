import PagePlaceholder from "@/components/shell/PagePlaceholder";
import { Lock } from "lucide-react";

export const metadata = { title: "Encryption" };

export default function Page() {
  return (
    <PagePlaceholder
      title="Encryption"
      subtitle="AES-256-GCM, key derivation and hashing tools"
      icon={Lock}
      note="Standalone encryption utilities will live here — the same primitives the stego engine uses."
    />
  );
}
