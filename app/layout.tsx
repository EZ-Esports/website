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

export const metadata: Metadata = {
  title: {
    default: METADATA.defaultTitle,
    template: `%s | ${SITE_CONFIG.company}`,
  },
  description: METADATA.defaultDescription,
  metadataBase: new URL('https://ezesports.org'),
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
