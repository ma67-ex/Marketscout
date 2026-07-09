# Market Scout

Enter a location and your field of study. Market Scout scans the area's real
businesses and local discussion, then tells you what kind of business is in
demand there — or, if you already run one, what people want and what you can
improve.

Built with Next.js, TypeScript, and Tailwind CSS, with an interactive
wireframe globe that zooms to the analyzed location.

## How it works

1. **Geocoding** — your location text is resolved to coordinates with
   Nominatim (OpenStreetMap). Free, no key needed.
2. **Area scan** — nearby businesses and services are pulled from the
   Overpass API (OpenStreetMap), with automatic fallback across public
   mirrors. Free, no key needed.
3. **Demand mining** — reviews and local discussion are scanned for recurring
   themes (hours, pricing, parking, healthy options, and so on) with
   sentiment analysis.
4. **Gap scoring** — every business category gets a demand score, a
   competition score, and an opportunity score:
   `opportunity = demand x (1 - competition / 100)`.
5. **Synthesis** — the findings are written up as concrete recommendations
   biased toward your field of study, or as an improvement report for your
   existing business.

## Two modes

- **Find a business opportunity** — ranked business concepts with target
  customer, competition level, differentiators, risks, and confidence.
- **Improve my existing business** — what people want, common complaints
  with real quotes, prioritized improvements, and strengths to keep.

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Geocoding and the area scan run live out of the
box. Reddit discussion and AI-written synthesis use realistic sample data
until you add keys:

```bash
cp .env.example .env.local
# then fill in what you have:
# REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET  (free at reddit.com/prefs/apps)
# GEMINI_API_KEY                           (free, Google AI Studio)
# FREELLMAPI_API_KEY                       (self-hosted, github.com/tashfeenahmed/freellmapi)
# ANTHROPIC_API_KEY                        (paid, Claude-written synthesis)
```

`.env.local` is gitignored, so real keys never get committed -- only the
key-free `.env.example` template is tracked.

Each provider switches from sample to live automatically when its key is
present. Set `MARKET_SCOUT_FORCE_MOCK=1` to demo fully offline.

## Architecture

```
src/lib/types.ts               Shared domain model
src/lib/providers/contracts.ts Provider interfaces (mock and live are interchangeable)
src/lib/providers/             Nominatim, Overpass, Reddit, Anthropic + mocks
src/lib/analysis/              Pure functions: sentiment, categories, demand, gaps
src/lib/orchestrator.ts        The pipeline: geocode -> scan -> analyze -> synthesize
src/app/api/analyze/route.ts   POST endpoint
src/components/ui/             Wireframe dotted globe (canvas + d3-geo)
```

## Notes

- OpenStreetMap has no ratings or review text, so live demand signals lean on
  local discussion; sample reviews stand in until Reddit keys are added.
- Scores are heuristics over open data. Treat the output as a research
  starting point, not a business plan.
