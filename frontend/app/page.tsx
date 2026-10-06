import TopBar from "@/components/shell/TopBar";
import Link from "next/link";
import {
  EyeOff,
  Radar,
  FileSearch,
  FileOutput,
  ArrowRight,
} from "lucide-react";

export default function DashboardPage() {
  return (
    <>
      <TopBar
        title="Dashboard"
        subtitle="Session overview — no files retained after close"
      />
      <main className="flex-1 p-5 lg:p-8">
        {/* Quick actions — the full dashboard with live session stats
            arrives with the later modules; these entry points work now. */}
        <section>
          <h2 className="text-section text-ink">Start here</h2>
          <p className="mt-1 text-body text-ink-faint">
            Three steps for most jobs: drop a file, type what you need, download
            the result.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                href: "/image",
                icon: EyeOff,
                accent: "border-t-teal",
                iconColor: "text-teal",
                iconBg: "bg-teal-dim",
                title: "Hide a message",
                blurb:
                  "Tuck a private note inside an ordinary photo. Only someone with your password can read it.",
              },
              {
                href: "/scanner",
                icon: Radar,
                accent: "border-t-danger",
                iconColor: "text-danger",
                iconBg: "bg-danger-dim",
                title: "Analyse a file",
                blurb:
                  "Check whether a file is carrying hidden data and see exactly why it looks suspicious.",
              },
              {
                href: "/image",
                icon: FileSearch,
                accent: "border-t-grape",
                iconColor: "text-grape",
                iconBg: "bg-grape-dim",
                title: "Extract data",
                blurb:
                  "Got a file with something inside? Enter the password and pull the message back out.",
              },
              {
                href: "/scanner",
                icon: FileOutput,
                accent: "border-t-azure",
                iconColor: "text-azure",
                iconBg: "bg-azure-dim",
                title: "Generate report",
                blurb:
                  "Turn scan results into a PDF you can hand to a colleague, a client or an auditor.",
              },
            ].map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className={`group rounded-card border border-line ${card.accent} border-t-2 bg-card p-4 transition-colors duration-150 hover:border-line-bright`}
              >
                <div
                  className={`grid h-9 w-9 place-items-center rounded-full ${card.iconBg}`}
                >
                  <card.icon size={16} className={card.iconColor} />
                </div>
                <h3 className="mt-3 text-card text-ink">{card.title}</h3>
                <p className="mt-1.5 text-body text-ink-dim">{card.blurb}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-cap font-medium text-ink-faint transition-colors duration-150 group-hover:text-ink-dim">
                  Open <ArrowRight size={11} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Encryption posture — static truth about how the engine works */}
        <section className="mt-8 max-w-xl">
          <h2 className="text-section text-ink">Encryption status</h2>
          <div className="mt-3 rounded-card border border-line bg-card p-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-body sm:grid-cols-3">
              {[
                ["Cipher", "AES-256-GCM"],
                ["KDF", "PBKDF2-HMAC-SHA256"],
                ["Iterations", "210,000"],
                ["Salt", "16 bytes random"],
                ["IV", "12 bytes random"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-cap text-ink-faint">{k}</dt>
                  <dd className="mt-0.5 font-mono text-[12px] text-ink-dim">
                    {v}
                  </dd>
                </div>
              ))}
              <div>
                <dt className="text-cap text-ink-faint">Key handling</dt>
                <dd className="mt-0.5 font-mono text-[12px] text-mint">
                  Keys zeroed after use
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </main>
    </>
  );
}
