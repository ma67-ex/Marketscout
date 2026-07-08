import type { AppConfig } from "@/lib/config";
import type { RedditProvider, RedditSearchOptions } from "@/lib/providers/contracts";
import type { GeoLocation, RedditPost } from "@/lib/types";
import { mockRedditFor } from "@/lib/mock/dataset";

export function createRedditProvider(
  config: AppConfig,
  useMock: boolean,
): RedditProvider {
  if (useMock) {
    return {
      async search(location, keywords, opts) {
        const limit = opts?.limit ?? config.reddit.maxPosts;
        return mockRedditFor(location, keywords, limit);
      },
    };
  }

  return {
    async search(
      location: GeoLocation,
      keywords: string[],
      opts?: RedditSearchOptions,
    ) {
      const limit = opts?.limit ?? config.reddit.maxPosts;
      const query = keywords.join(" ");

      try {
        // Prefer OAuth when a free "script" app is registered: higher rate
        // limits and more reliable. Falls through to the public endpoint on
        // any failure (expired token, bad creds, etc).
        if (config.reddit.clientId && config.reddit.clientSecret) {
          return await oauthSearch(config, query, limit, location);
        }
      } catch (err) {
        console.error("[reddit] OAuth search failed, trying public search:", err);
      }

      try {
        return await publicSearch(config, query, limit, location);
      } catch (err) {
        // Reddit being unreachable should not take down the whole report --
        // an empty result is accurate ("no local discussion found"), while
        // fabricating posts would not be.
        console.error("[reddit] public search failed, returning no posts:", err);
        return [];
      }
    },
  };
}

// Reddit's public, unauthenticated JSON search. No account or key required --
// works for anyone, subject to Reddit's anonymous rate limits.
async function publicSearch(
  config: AppConfig,
  query: string,
  limit: number,
  location: GeoLocation,
): Promise<RedditPost[]> {
  const params = new URLSearchParams({
    q: query,
    sort: "relevance",
    t: "year",
    limit: String(limit),
    type: "link",
  });

  const res = await fetch(`https://www.reddit.com/search.json?${params}`, {
    headers: { "User-Agent": config.reddit.userAgent },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`Reddit public search failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as RedditListing;
  return mapListing(data, location);
}

// OAuth client-credentials flow. Optional -- only used when the user has
// registered a free "script" app at https://www.reddit.com/prefs/apps.
async function oauthSearch(
  config: AppConfig,
  query: string,
  limit: number,
  location: GeoLocation,
): Promise<RedditPost[]> {
  const token = await getRedditToken(config);

  const params = new URLSearchParams({
    q: query,
    sort: "relevance",
    t: "year",
    limit: String(limit),
    type: "link",
    restrict_sr: "false",
  });

  const res = await fetch(`https://oauth.reddit.com/search?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": config.reddit.userAgent,
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`Reddit search failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as RedditListing;
  return mapListing(data, location);
}

function mapListing(data: RedditListing, location: GeoLocation): RedditPost[] {
  const cityLower = (location.city || "").toLowerCase();

  return data.data.children.map((child) => {
    const p = child.data;
    const combined = `${p.title} ${p.selftext}`.toLowerCase();
    const mentionsCity = cityLower ? combined.includes(cityLower) : false;

    return {
      id: p.id,
      subreddit: `r/${p.subreddit}`,
      title: p.title,
      text: p.selftext || "",
      score: p.score,
      numComments: p.num_comments,
      url: `https://reddit.com${p.permalink}`,
      createdUtc: p.created_utc,
      relevance: mentionsCity ? 0.9 : 0.5,
    } satisfies RedditPost;
  });
}

async function getRedditToken(config: AppConfig): Promise<string> {
  const { clientId, clientSecret, userAgent } = config.reddit;
  if (!clientId || !clientSecret) {
    throw new Error("Reddit API credentials are not configured.");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent,
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`Reddit auth failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

interface RedditListing {
  data: {
    children: Array<{
      data: {
        id: string;
        subreddit: string;
        title: string;
        selftext: string;
        score: number;
        num_comments: number;
        permalink: string;
        created_utc: number;
      };
    }>;
  };
}
