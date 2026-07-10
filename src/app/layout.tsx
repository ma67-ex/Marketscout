import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AmbientDriftBackground from "@/components/ui/ambient-drift-background";
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
        {children}
      </body>
    </html>
  );
}
