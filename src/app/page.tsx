"use client";

// Market Scout main screen.
//
// Layout: the wireframe globe is the centerpiece with the input form beside
// it. When an analysis comes back, the globe zooms to the geocoded location
// with a marker, the headline findings sit next to it, and the detail
// sections flow below. Kept deliberately minimal: black/white, thin borders,
// no decoration that does not carry information.

import { useRef, useState } from "react";
import RotatingEarth, { type GlobeFocus } from "@/components/ui/wireframe-dotted-globe";
import LocationAutocomplete from "@/components/ui/location-autocomplete";
import type { AnalysisMode, AnalysisReport } from "@/lib/types";

type FormState = {
  location: string;
  fieldOfStudy: string;
  mode: AnalysisMode;
  existingBusinessType: string;
};

const initialForm: FormState = {
  location: "",
  fieldOfStudy: "",
  mode: "opportunity",
  existingBusinessType: "",
};

export default function Home() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const focus: GlobeFocus | null = report
    ? { lat: report.location.lat, lng: report.location.lng }
    : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: form.location,
          fieldOfStudy: form.fieldOfStudy,
          mode: form.mode,
          existingBusinessType:
            form.mode === "improve" ? form.existingBusinessType : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Something went wrong.");
      }
      setReport(data as AnalysisReport);
      // Let the globe start its zoom, then bring the findings into view.
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 350);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <header className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Market Scout</h1>
        <p className="text-xs text-muted-foreground">
          Local market analysis from open data
        </p>
      </header>

      {/* Hero: form beside the globe. */}
      <section className="mt-6 grid items-center gap-8 lg:grid-cols-[minmax(0,380px)_1fr]">
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <h2 className="text-2xl font-semibold leading-snug tracking-tight">
              What should you build where you live?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter a place and your field of study. Market Scout reads nearby
              businesses and local discussion, then tells you what is in demand
              or what your existing business should improve.
            </p>
          </div>

          <Field label="Location" htmlFor="location">
            <LocationAutocomplete
              id="location"
              className={inputClass}
              placeholder="Start typing a city, e.g. Williamsville, NY"
              value={form.location}
              onChange={(location) => setForm({ ...form, location })}
              required
            />
          </Field>

          <Field label="Field of study" htmlFor="field">
            <input
              id="field"
              className={inputClass}
              placeholder="e.g. Computer Science"
              value={form.fieldOfStudy}
              onChange={(e) => setForm({ ...form, fieldOfStudy: e.target.value })}
              required
            />
          </Field>

          <Field label="Goal" htmlFor="mode">
            <select
              id="mode"
              className={inputClass}
              value={form.mode}
              onChange={(e) =>
                setForm({ ...form, mode: e.target.value as AnalysisMode })
              }
            >
              <option value="opportunity">Find a business opportunity</option>
              <option value="improve">Improve my existing business</option>
            </select>
          </Field>

          {form.mode === "improve" && (
            <Field label="Your business type" htmlFor="existing">
              <input
                id="existing"
                className={inputClass}
                placeholder="e.g. coffee shop"
                value={form.existingBusinessType}
                onChange={(e) =>
                  setForm({ ...form, existingBusinessType: e.target.value })
                }
                required
              />
            </Field>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Scanning the area..." : "Analyze this area"}
          </button>

          {error && (
            <p className="rounded-lg border border-destructive px-3 py-2 text-sm text-destructive-foreground">
              {error}
            </p>
          )}
        </form>

        <RotatingEarth width={640} height={560} focus={focus} className="mx-auto" />
      </section>

      {report && (
        <div ref={resultsRef} className="scroll-mt-6">
          <Report report={report} />
        </div>
      )}
    </main>
  );
}

const inputClass =
  "w-full rounded-lg border border-input bg-transparent px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-border bg-card p-5 ${className}`}
    >
      {title && (
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

function Report({ report }: { report: AnalysisReport }) {
  const { sources } = report;

  return (
    <div className="mt-14 border-t border-border pt-8">
      {/* Headline row: where, and what the data is. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="text-xl font-semibold tracking-tight">
          {report.location.formattedAddress}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-border px-2.5 py-0.5">
            {sources.placesCount} places
          </span>
          <span className="rounded-full border border-border px-2.5 py-0.5">
            {sources.reviewsCount} reviews
          </span>
          <span className="rounded-full border border-border px-2.5 py-0.5">
            {sources.redditPostsCount} local posts
          </span>
          {sources.usedMockData && (
            <span className="rounded-full border border-border px-2.5 py-0.5 text-foreground">
              Demo data
            </span>
          )}
        </div>
      </div>

      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        {report.summary}
      </p>

      {/* Primary result: recommendations or the improvement report. */}
      {report.recommendations && report.recommendations.length > 0 && (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {report.recommendations.map((rec, i) => (
            <Card key={i}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-medium">{rec.name}</h4>
                  <p className="text-xs text-muted-foreground">{rec.category}</p>
                </div>
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {rec.confidence}/100
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed">{rec.whyInDemand}</p>
              <dl className="mt-4 space-y-2 text-sm">
                <DetailRow term="Target customer" detail={rec.targetCustomer} />
                <DetailRow term="Field fit" detail={rec.fieldFit} />
                <DetailRow term="Competition" detail={rec.competitionLevel} />
                {rec.differentiators.length > 0 && (
                  <DetailRow
                    term="Stand out by"
                    detail={rec.differentiators.join("; ")}
                  />
                )}
                {rec.risks.length > 0 && (
                  <DetailRow term="Risks" detail={rec.risks.join("; ")} />
                )}
              </dl>
            </Card>
          ))}
        </div>
      )}

      {report.improvementReport && (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Card title="What people want">
            <BulletList items={report.improvementReport.whatPeopleWant} />
          </Card>
          <Card title="Common complaints">
            <BulletList items={report.improvementReport.commonComplaints} />
          </Card>
          <Card title="What you can improve">
            <ul className="space-y-3 text-sm">
              {report.improvementReport.improvements.map((imp, i) => (
                <li key={i}>
                  <span className="font-medium">{imp.area}</span>{" "}
                  <span className="text-xs text-muted-foreground">
                    ({imp.impact} impact)
                  </span>
                  <p className="mt-0.5 text-muted-foreground">{imp.suggestion}</p>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Strengths to keep">
            <BulletList items={report.improvementReport.strengthsToKeep} />
          </Card>
        </div>
      )}

      {/* Supporting evidence: gaps beside the talk of the town. */}
      <div className="mt-8 grid gap-4 lg:grid-cols-[3fr_2fr]">
        {report.marketGaps.length > 0 && (
          <Card title="Market gaps">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Category</th>
                    <th className="pb-2 pr-3 font-medium">Demand</th>
                    <th className="pb-2 pr-3 font-medium">Competition</th>
                    <th className="pb-2 font-medium">Opportunity</th>
                  </tr>
                </thead>
                <tbody>
                  {report.marketGaps.slice(0, 8).map((gap, i) => (
                    <tr key={i} className="border-t border-border align-top">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{gap.category}</div>
                        <div className="mt-0.5 max-w-xs text-xs text-muted-foreground">
                          {gap.rationale}
                        </div>
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{gap.demandScore}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        {gap.competitionScore}
                      </td>
                      <td className="py-2 font-medium tabular-nums">
                        {gap.opportunityScore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {report.demandSignals.length > 0 && (
          <Card title="What people talk about">
            <ul className="space-y-3 text-sm">
              {report.demandSignals.slice(0, 8).map((sig, i) => (
                <li key={i}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{sig.theme}</span>
                    <span className="text-xs text-muted-foreground">
                      {sig.sentiment}
                    </span>
                  </div>
                  {sig.evidence[0] && (
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      &ldquo;{sig.evidence[0]}&rdquo;
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {/* Full inventory tucked away so the page stays scannable. */}
      {report.categoryStats.length > 0 && (
        <details className="group mt-4 rounded-xl border border-border bg-card p-5">
          <summary className="cursor-pointer list-none text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <span className="group-open:hidden">
              Show everything already in the area ({report.categoryStats.length}{" "}
              categories)
            </span>
            <span className="hidden group-open:inline">
              Everything already in the area
            </span>
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Category</th>
                  <th className="pb-2 pr-3 font-medium">Count</th>
                  <th className="pb-2 pr-3 font-medium">Avg rating</th>
                  <th className="pb-2 font-medium">Saturation</th>
                </tr>
              </thead>
              <tbody>
                {report.categoryStats.map((cat, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-1.5 pr-3">{cat.category}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{cat.count}</td>
                    <td className="py-1.5 pr-3 tabular-nums">
                      {cat.avgRating === null ? "-" : cat.avgRating.toFixed(1)}
                    </td>
                    <td className="py-1.5">{cat.saturation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

function DetailRow({ term, detail }: { term: string; detail: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="mt-0.5 leading-relaxed">{detail}</dd>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-4 text-sm text-card-foreground marker:text-muted-foreground">
      {items.map((item, i) => (
        <li key={i} className="leading-relaxed">
          {item}
        </li>
      ))}
    </ul>
  );
}
