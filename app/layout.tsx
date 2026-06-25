import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { METADATA, SITE_CONFIG } from "@/app/lib/constants";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import type { Viewport } from "next";

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: METADATA.defaultTitle,
    template: `%s | ${SITE_CONFIG.company}`,
  },
  description: METADATA.defaultDescription,
  keywords: [
    "NYC High School Esports League",
    "EZ Esports",
    "EZ Staff",
    "High School Esports",
    "NYC League",
    "Esports Rosters",
    "Valorant High School League",
    "League of Legends High School League",
    "TFT High School League",
    "High School Gaming"
  ],
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://ezesports.org')
  ),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://ezesports.org',
    siteName: METADATA.siteName,
    title: METADATA.defaultTitle,
    description: METADATA.defaultDescription,
  },
  twitter: {
    card: 'summary_large_image',
    title: METADATA.defaultTitle,
    description: METADATA.defaultDescription,
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
