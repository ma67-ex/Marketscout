import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Market Scout",
  description: "What Market Scout collects, what it sends to outside services, and what it never stores.",
};

const EFFECTIVE_DATE = "July 9, 2026";
const CONTACT_URL = "https://github.com/ma67-ex/Marketscout/issues";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-12">
      <Link
        href="/"
        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        ← Back to Market Scout
      </Link>

      <header className="mt-6 border-b border-border pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective {EFFECTIVE_DATE}
        </p>
      </header>

      <div className="mt-8 space-y-10 text-sm leading-relaxed text-card-foreground">
        <Section>
          <p>
            Market Scout is a small tool built by one person, not a company
            with a legal or data team. This page explains, plainly, what
            happens to the location and field of study you type into the
            form, which outside services see it, and what is never stored.
            If any of this changes, this page will change with it.
          </p>
        </Section>

        <Section title="What we collect">
          <p>
            When you run an analysis, the form sends three things: the
            location you typed, the field of study you picked or wrote in,
            and, if you chose &ldquo;improve my existing business,&rdquo;
            the type of business you run. That is the full list. There is no
            account system, so we never ask for your name, email, or a
            password.
          </p>
          <p>
            Your browser also sends an IP address with every request, the
            same way it does to any website you visit. How that is used is
            covered below, under Rate limiting.
          </p>
        </Section>

        <Section title="What we do with it">
          <p>
            Your location is turned into map coordinates by Nominatim, a free
            OpenStreetMap geocoding service. Those coordinates are used to
            pull nearby businesses from the Overpass API (also
            OpenStreetMap) and public review text from Mangrove Reviews. If
            the person running this app has configured Reddit API access,
            public posts about the area are pulled in too. Each of these
            calls happens live, while your request is being handled, and
            nothing from them is saved afterward.
          </p>
          <p>
            If an AI provider is configured, either Google Gemini, Anthropic&rsquo;s
            Claude, or a self-hosted proxy called FreeLLMAPI, your location,
            field of study, and business type are sent to that provider so
            it can write your recommendations in plain language instead of a
            fixed template. If no provider is configured, none of this
            leaves the app: a built-in template writes the report from the
            same data instead.
          </p>
        </Section>

        <Section title="Who else sees it">
          <p>
            Depending on how the app is configured, your submitted location
            and field of study may be sent to one or more of these services,
            each of which has its own privacy policy that governs what
            happens on their end:
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground marker:text-muted-foreground">
            <li>Nominatim / OpenStreetMap Foundation (location lookup)</li>
            <li>Overpass API / OpenStreetMap Foundation (nearby businesses)</li>
            <li>Mangrove Reviews (public review text)</li>
            <li>Reddit, only if the operator has configured API keys (local discussion)</li>
            <li>Google Gemini, Anthropic, or FreeLLMAPI, whichever one is configured, if any (report writing)</li>
          </ul>
          <p className="mt-3">
            No service here receives more than it needs to answer the one
            question it is asked. Nominatim, for instance, only ever sees
            the location text, never your field of study or business type.
          </p>
        </Section>

        <Section title="What we don't do">
          <p>
            There are no ad trackers, analytics scripts, or third-party
            tracking pixels on this site. There is no database behind
            Market Scout, so no permanent record of your searches exists on
            our servers to begin with. We do not sell data, because there is
            no stored data to sell.
          </p>
        </Section>

        <Section title="Cookies and local storage">
          <p>
            Market Scout does not set cookies. The only thing your browser
            keeps is a small flag in local storage, confirming you have seen
            the notice on the homepage about how your input is used. That
            flag stays on your device and is never sent to our servers.
          </p>
        </Section>

        <Section title="Rate limiting and IP addresses">
          <p>
            To keep the free services this app relies on from being
            overwhelmed by automated traffic, each request is checked
            against a short-term limit tied to your IP address. That check
            lives in the server&rsquo;s memory only, resets every minute, and is
            cleared whenever the server restarts. It is never written to
            disk, logged alongside your search, or kept beyond that window.
          </p>
        </Section>

        <Section title="How long we keep things">
          <p>
            We don&rsquo;t keep your submissions at all. Once your report is
            built and sent back to your browser, the server has nothing
            left describing what you asked. If a request fails, the error
            log records what kind of failure it was, not the location or
            field of study you entered.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            Because nothing about your request is stored after it is
            answered, there is generally nothing on our end to request a
            copy of, correct, or ask to be deleted. If you are in the EU,
            UK, California, or anywhere else with its own privacy law and
            still have questions about how this applies to you, use the
            contact below.
          </p>
        </Section>

        <Section title="Children's privacy">
          <p>
            Market Scout is not directed at children and is not built to
            collect information from them. If you believe a child has
            submitted information through this tool, contact us below. As
            explained above, requests are not retained after they are
            answered, so there is typically nothing left to remove.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If what this tool collects or sends changes, this page will be
            updated to match, and the date at the top will reflect the last
            change.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy or how Market Scout handles your
            input can go to the project&rsquo;s{" "}
            <a
              href={CONTACT_URL}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              GitHub issues
            </a>
            .
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      {title && (
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
      )}
      <div className="space-y-3">{children}</div>
    </section>
  );
}
