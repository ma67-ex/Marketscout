// Lightweight, keyless bot/scripted-abuse barrier for same-origin-only API
// routes.
//
// This app has no public API contract: every route here exists only to be
// called by this app's own page via fetch(). Real browsers reliably attach
// either the Fetch Metadata "Sec-Fetch-Site" header or an "Origin" header to
// same-origin fetch() calls; scripted clients hitting the endpoint directly
// (curl, requests/httpx, most off-the-shelf DoS and scraping tooling) send
// neither by default. Requiring one of them to affirmatively say "this came
// from our own page" blocks the overwhelming majority of naive bot/scripted
// traffic for free -- no key, no card, no external service -- with zero false
// positives on real use of the site.
//
// This is a heuristic, not a security boundary: a determined attacker driving
// a real, automated browser (or hand-forging these headers) can still get
// through. Paired with the rate limiter in lib/rate-limit.ts, it raises the
// cost of abuse from "run curl in a loop" to "operate a browser automation
// farm", which is the realistic bar for a free hobby app with no auth.

export function isSameOriginRequest(request: Request): boolean {
  // Fetch Metadata: supported by every evergreen browser (Chrome/Edge/Firefox
  // since 2021, Safari since 16.4) and cannot be set by plain HTTP clients
  // without deliberately impersonating a browser.
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite) {
    return secFetchSite === "same-origin";
  }

  // Fallback for the rare client with no Fetch Metadata support: the Origin
  // header, which browsers attach to same-origin fetch() calls too.
  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("host");
    try {
      return host != null && new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  // Neither header present -- deny. Every browser this app supports sends
  // at least one on a fetch() call; a request with neither is not our UI.
  return false;
}

export function botBlockedResponse(): Response {
  return new Response(
    JSON.stringify({
      error: "This endpoint only accepts requests from the Market Scout app.",
    }),
    { status: 403, headers: { "Content-Type": "application/json" } },
  );
}
