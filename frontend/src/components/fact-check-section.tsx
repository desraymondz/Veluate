import { formatTimestamp } from "@/lib/format";
import type { FactCheckClaim, FactCheckReport, FactCheckVerdict } from "@/lib/types";

const VERDICT_LABELS: Record<FactCheckVerdict, string> = {
  supported: "Supported",
  oversimplified: "Oversimplified",
  incorrect: "Incorrect",
  unverified: "Unverified",
};

function verdictSummary(report: FactCheckReport): string {
  if (report.note) return report.note;
  if (!report.claims.length) {
    return report.summary || "No checkable claims found";
  }

  const counts: Partial<Record<FactCheckVerdict, number>> = {};
  for (const claim of report.claims) {
    counts[claim.verdict] = (counts[claim.verdict] ?? 0) + 1;
  }

  const parts: string[] = [];
  if (counts.supported) parts.push(`${counts.supported} supported`);
  if (counts.oversimplified) parts.push(`${counts.oversimplified} oversimplified`);
  if (counts.incorrect) parts.push(`${counts.incorrect} incorrect`);
  if (counts.unverified) parts.push(`${counts.unverified} unverified`);

  return parts.length
    ? `${report.claims.length} claim${report.claims.length === 1 ? "" : "s"} · ${parts.join(", ")}`
    : report.summary;
}

function VerdictBadge({ verdict }: { verdict: FactCheckVerdict }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-foreground">
      {VERDICT_LABELS[verdict]}
    </span>
  );
}

function ClaimCard({ claim }: { claim: FactCheckClaim }) {
  return (
    <div className="px-4 py-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {claim.topic}
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            {formatTimestamp(claim.start_sec)}
            {claim.end_sec !== claim.start_sec &&
              ` – ${formatTimestamp(claim.end_sec)}`}
          </p>
        </div>
        <VerdictBadge verdict={claim.verdict} />
      </div>

      <blockquote className="mt-3 border-l-2 border-border pl-3 text-[15px] leading-relaxed text-foreground">
        {claim.quote}
      </blockquote>

      <p className="mt-3 leading-relaxed text-muted-foreground">
        {claim.explanation}
      </p>

      {claim.sources.length > 0 && (
        <ul className="mt-3 space-y-2">
          {claim.sources.map((source, i) => (
            <li key={i}>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
              >
                {source.title}
              </a>
              {source.snippet && (
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {source.snippet}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Props = {
  report: FactCheckReport;
};

export function factCheckSummary(report: FactCheckReport): string {
  return verdictSummary(report);
}

export function FactCheckSection({ report }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        {report.note
          ? report.note
          : "Claims from the lecture checked against external web sources via Bright Data. Oversimplified means directionally correct but imprecise for the stated audience."}
      </p>
      {report.summary && !report.note && (
        <p className="text-sm leading-relaxed text-foreground">{report.summary}</p>
      )}
      <div className="divide-y divide-border border border-border">
        {report.claims.map((claim, i) => (
          <ClaimCard key={i} claim={claim} />
        ))}
        {!report.claims.length && (
          <p className="px-4 py-4 text-sm text-muted-foreground">
            {report.summary || "No claims were checked."}
          </p>
        )}
      </div>
    </div>
  );
}
