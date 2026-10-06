import TopBar from "./TopBar";
import type { LucideIcon } from "lucide-react";

interface PagePlaceholderProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  note: string;
}

/**
 * Temporary stand-in used while a module is being wired up.
 * Follows the empty-state rule: icon, one-line explanation, call to action.
 */
export default function PagePlaceholder({
  title,
  subtitle,
  icon: Icon,
  note,
}: PagePlaceholderProps) {
  return (
    <>
      <TopBar title={title} subtitle={subtitle} />
      <main className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-card border border-line bg-card">
            <Icon size={20} className="text-ink-faint" strokeWidth={1.6} />
          </div>
          <h2 className="mt-4 text-section text-ink">{title} is on its way</h2>
          <p className="mt-2 text-body text-ink-dim">{note}</p>
        </div>
      </main>
    </>
  );
}
