import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AmbientDriftBackground from "@/components/ui/ambient-drift-background";
import ConsentNotice from "@/components/ui/consent-notice";
import ServiceWorker from "@/components/ui/service-worker";
import SiteFooter from "@/components/ui/site-footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Market Scout",
  description:
    "Enter a location and your field of study. Market Scout reads the local market and tells you what business is in demand.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AmbientDriftBackground />
        <div className="flex min-h-full flex-1 flex-col">
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </div>
        <ConsentNotice />
        <ServiceWorker />
      </body>
    </html>
  );
}
