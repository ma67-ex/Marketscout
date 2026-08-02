// Landing page. Explains the pitch before anyone has to type anything: who
// this is for, the problem it replaces, the two ways to use it, and exactly
// how the analysis is produced. The tool itself (form + globe) lives at
// /app; this page's only job is to make that first click informed. Same
// dark, black/white, thin-border language as the tool -- no separate
// "marketing" skin.

import Link from "next/link";
import RotatingEarth from "@/components/ui/wireframe-globe";
import Reveal from "@/components/ui/reveal";

const CTA_LABEL = "Analyze your area";

const PIPELINE = [
  {
    step: "Geocoding",
    detail:
      "Your location is resolved to coordinates with Nominatim, OpenStreetMap's geocoder. No key required.",
  },
  {
    step: "Area scan",
    detail:
      "Nearby businesses and services are pulled from the Overpass API, with automatic fallback across public mirrors.",
  },
  {
    step: "Demand mining",
    detail:
      "Reviews and local discussion are scanned for recurring themes, hours, pricing, parking, and more, each with sentiment attached.",
  },
  {
    step: "Gap scoring",
    detail:
      "Every category gets a demand score and a competition score. Opportunity is demand times the room competition leaves open.",
  },
  {
    step: "Synthesis",
    detail:
      "The findings become concrete recommendations, or an improvement report, biased toward the field of study you gave it.",
  },
];

const SOURCES = [
  "OpenStreetMap places",
  "Nominatim geocoding",
  "Local Reddit discussion",
  "Wikipedia context",
];

export default function Landing() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold tracking-tight">
          Market Scout
        </span>
        <Link
          href="/app"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          {CTA_LABEL}
        </Link>
      </header>

      {/* Hero: the pitch beside the globe, same split the tool itself uses. */}
      <section className="mt-10 grid items-center gap-10 lg:grid-cols-[minmax(0,480px)_1fr] lg:gap-16">
        <div>
          <h1 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl">
            Local market research, without hiring an analyst.
          </h1>
          <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
            Enter a place and a field of study. Market Scout scans nearby
            businesses and local discussion for what&apos;s missing.
          </p>
          <Link
            href="/app"
            className="mt-7 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {CTA_LABEL}
          </Link>
        </div>

        <RotatingEarth size={480} className="mx-auto hidden lg:block" />
      </section>

      {/* The problem this replaces. */}
      <Reveal>
        <section className="mt-14 border-t border-border pt-14">
          <p className="max-w-2xl text-balance text-2xl font-medium leading-snug tracking-tight">
            Guessing is not a strategy. Neither is paying an analyst to tell
            you what your neighborhood already knows.
          </p>
          <p className="mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
            Market Scout pulls that read from data that&apos;s already
            public: real nearby businesses, real local discussion, and a
            scored read on where demand outpaces competition. No retainer,
            no waiting on a report.
          </p>
        </section>
      </Reveal>

      {/* Two modes: who this is for, split by situation rather than feature. */}
      <Reveal>
        <section className="mt-14 border-t border-border pt-14">
          <h2 className="text-xl font-semibold tracking-tight">
            Two ways to use it
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-medium">Find an opportunity</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Give it your field of study and where you&apos;re looking. It
                ranks concrete business concepts by target customer,
                competition, and confidence, each with what would make it
                stand out.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-medium">Improve what you have</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Give it the business you already run. It surfaces what
                people want, the complaints that keep showing up with real
                quotes attached, and which fixes matter most.
              </p>
            </div>
          </div>
        </section>
      </Reveal>

      {/* How it works: a real pipeline, so the numbering earns its place. */}
      <Reveal>
        <section className="mt-14 border-t border-border pt-14">
          <h2 className="text-xl font-semibold tracking-tight">
            How the analysis is built
          </h2>
          <ol className="mt-8 space-y-8">
            {PIPELINE.map((item, i) => (
              <li key={item.step} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border font-mono text-xs text-muted-foreground">
                    {i + 1}
                  </span>
                  {i < PIPELINE.length - 1 && (
                    <span className="mt-1 w-px flex-1 bg-border" aria-hidden />
                  )}
                </div>
                <div className="pb-1">
                  <h3 className="font-medium">{item.step}</h3>
                  <p className="mt-1 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
                    {item.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </Reveal>

      {/* Trust: name the actual sources, in the same chip style the report uses. */}
      <Reveal>
        <section className="mt-14 border-t border-border pt-14">
          <h2 className="text-xl font-semibold tracking-tight">
            Real data, not a black box
          </h2>
          <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
            Every finding traces back to a named source. Reddit discussion
            and AI-written synthesis fall back to realistic sample data only
            until you add your own free keys.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {SOURCES.map((source) => (
              <span
                key={source}
                className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground"
              >
                {source}
              </span>
            ))}
          </div>
        </section>
      </Reveal>

      {/* Closing: one more chance to click through, same label, same link. */}
      <Reveal>
        <section className="mt-14 border-t border-border py-14 text-center">
          <h2 className="text-balance text-2xl font-semibold tracking-tight">
            Start with a place and a field of study.
          </h2>
          <Link
            href="/app"
            className="mt-6 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {CTA_LABEL}
          </Link>
        </section>
      </Reveal>
    </main>
  );
}
