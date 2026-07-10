// Slim, single-row footer: credit + social links on one side, the privacy
// link on the other. Kept deliberately thin (one text-size row) so it never
// competes with the globe/report above it.

import Link from "next/link";

const SOCIALS = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/ma67",
    icon: (
      <path d="M4.98 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.7c0-1.36-.02-3.1-1.89-3.1-1.9 0-2.19 1.48-2.19 3v5.8h-4V9Z" />
    ),
  },
  {
    label: "GitHub",
    href: "https://github.com/ma67-tech",
    icon: (
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.15-1.11-1.46-1.11-1.46-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5.01 0c1.91-1.3 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.35 4.68-4.58 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    ),
  },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-border/50 px-5 py-3">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>Muhammad Abdullah</span>
          <div className="flex items-center gap-2.5">
            {SOCIALS.map(({ label, href, icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                className="text-muted-foreground/70 transition-all duration-200 hover:-translate-y-0.5 hover:text-foreground"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-3.5 w-3.5"
                  aria-hidden
                >
                  {icon}
                </svg>
              </a>
            ))}
          </div>
        </div>

        <Link
          href="/privacy"
          className="underline decoration-transparent underline-offset-2 transition-colors duration-200 hover:text-foreground hover:decoration-current"
        >
          Privacy Policy
        </Link>
      </div>
    </footer>
  );
}
