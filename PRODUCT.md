# Product

## Register

brand

## Platform

web

## Users

Two groups, both self-directed and doing their own research rather than paying for it. First: people deciding where to open a business (students, first-time founders, side-hustlers) who would otherwise guess or hire a market-research analyst. Second: owners of an existing local business who want a read on what customers actually want and complain about, without commissioning a survey. Both land on the site cold, from a search or a link, and need to understand what the tool does before they will type in their location.

## Product Purpose

Market Scout answers "what should I build here, or what should I fix" using only free, open data (OpenStreetMap places, Nominatim geocoding, local Reddit discussion) instead of paid market-research services or guesswork. Success is a visitor understanding the pitch in one screen, then submitting their first location and field of study.

## Positioning

The market-research report a human analyst would charge for, generated free from open data in under a minute.

## Brand Personality

Confident and analytical, not salesy. The tone is closer to a research tool than a startup landing page: declarative sentences, real mechanics named plainly (geocoding, area scan, gap scoring), no hype verbs. The existing product already sets this voice (see README: "no analyst on retainer") and the landing page continues it rather than switching into marketing register.

## Anti-references

Not a SaaS-cream landing page: no gradient hero text, no purple glow, no three-identical-feature-cards, no fake dashboard screenshot in the hero. Nothing about the page should read as a template; it should read as the same restrained, data-first interface as the tool itself, just explaining itself before asking for input.

## Design Principles

- Explain the mechanism, not just the benefit: naming the real pipeline (geocode, scan, mine, score, synthesize) builds more trust than a vague promise.
- One visual language across landing and tool: a visitor should not feel like they switched sites when they click through from the pitch to the form.
- Earn the CTA: the visitor should understand the two modes (find an opportunity, improve an existing business) before they are asked to pick one.
- Show the receipts: real data sources (OpenStreetMap, Reddit, Nominatim) named explicitly, since "free and open" is the actual differentiator, not a slogan.

## Accessibility & Inclusion

Standard WCAG AA. No motion-dependent comprehension: any entrance animation must degrade cleanly under `prefers-reduced-motion`, matching the existing skeleton/ambient-background handling already in the codebase.
