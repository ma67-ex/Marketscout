import type { NextConfig } from "next";

// CSP notes:
// - 'unsafe-inline' for scripts/styles is required by Next.js hydration and
//   Tailwind's inline style injection without a nonce setup. If you later add
//   middleware, switch to nonce-based CSP and drop 'unsafe-inline'.
// - 'unsafe-eval' is added in DEVELOPMENT ONLY: Next.js dev mode and React
//   DevTools use eval() for fast refresh and callstack reconstruction. It is
//   never emitted in production, so the deployed policy stays strict.
// - connect-src includes ws:/wss: in development for the hot-reload socket;
//   in production everything is same-origin because external calls are
//   server-side.
const isDev = process.env.NODE_ENV !== "production";

const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const connectSrc = isDev
  ? "connect-src 'self' ws: wss:"
  : "connect-src 'self'";

const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  connectSrc,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
