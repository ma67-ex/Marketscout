import type { AppConfig } from "@/lib/config";
import type { GeoLocation, AreaContext } from "@/lib/types";
import type { ContextProvider } from "@/lib/providers/contracts";

// Keyless area context from Wikipedia's public REST API.
//
// No key, no login, no card. Gives the report real background on the place --
// what it is known for, roughly how big it is, its character -- which grounds
// the analysis in something concrete instead of a bare category list.

export function createContextProvider(
  _config: AppConfig,
  useMock: boolean,
): ContextProvider {
  if (useMock) {
    return { async describe() { return undefined; } };
  }

  return {
    async describe(location: GeoLocation) {
      // Query every title candidate concurrently rather than one at a time --
      // a sequential fallback chain pays each miss's full timeout before
      // trying the next. Still prefer the most specific title on success by
      // picking from the settled results in priority order, not by whichever
      // request happened to finish first.
      const candidates = titleCandidates(location);
      if (candidates.length === 0) return undefined;

      const settled = await Promise.all(candidates.map((title) => fetchSummary(title)));
      return settled.find((context) => context !== undefined);
    },
  };
}

async function fetchSummary(title: string): Promise<AreaContext | undefined> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    title,
  )}?redirect=true`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "MarketScout/0.1 (local analysis tool)",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return undefined;

    const data = (await res.json()) as WikiSummary;
    // Skip disambiguation pages and empty extracts -- they carry no signal.
    if (data.type === "disambiguation") return undefined;
    if (!data.extract || data.extract.length < 40) return undefined;

    return {
      title: data.title,
      extract: data.extract,
      url:
        data.content_urls?.desktop?.page ||
        `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    };
  } catch {
    return undefined;
  }
}

function titleCandidates(location: GeoLocation): string[] {
  const titles: string[] = [];
  const { city, region, country } = location;
  if (city && region) titles.push(`${city}, ${region}`);
  if (city) titles.push(city);
  if (city && country) titles.push(`${city}, ${country}`);
  if (region) titles.push(region);
  // Dedupe while preserving order.
  return Array.from(new Set(titles));
}

interface WikiSummary {
  type?: string;
  title: string;
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
}
