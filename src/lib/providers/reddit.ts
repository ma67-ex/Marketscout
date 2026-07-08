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

  // Live provider: Reddit OAuth (client-credentials flow). Requires a free
  // "script" app registration at https://www.reddit.com/prefs/apps.
  return {
    async search(
      location: GeoLocation,
      keywords: string[],
      opts?: RedditSearchOptions,
    ) {
      const limit = opts?.limit ?? config.reddit.maxPosts;
      const token = await getRedditToken(config);
      const query = keywords.join(" ");

      const params = new URLSearchParams({
        q: query,
        sort: "relevance",
        t: "year",
        limit: String(limit),
        type: "link",
        restrict_sr: "false",
      });

      const res = await fetch(
        `https://oauth.reddit.com/search?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "User-Agent": config.reddit.userAgent,
          },
        },
      );

      if (!res.ok) {
        throw new Error(`Reddit search failed: ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as RedditListing;
      const cityLower = (location.city || "").toLowerCase();

      return data.data.children.map((child) => {
        const p = child.data;
        const combined = `${p.title} ${p.selftext}`.toLowerCase();
        const mentionsCity = cityLower
          ? combined.includes(cityLower)
          : false;

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
    },
  };
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
