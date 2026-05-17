/**
 * Root layout — wraps every page in the application.
 *
 * Key responsibilities:
 * 1. Nonce-based CSP: `proxy.ts` generates a per-request nonce and forwards it
 *    via the `x-nonce` response header. We read it here with `headers()` and
 *    stamp it onto the inline theme script so the strict-dynamic CSP allows it
 *    without needing `'unsafe-inline'`.
 * 2. Flash-free dark mode: THEME_SCRIPT runs synchronously before React hydrates,
 *    so the correct `.dark` class is already on `<html>` when the first paint
 *    happens — eliminating the light-flash that occurs when toggling is deferred
 *    to a client effect.
 * 3. Font loading: Inter is loaded via `next/font` (self-hosted by Next.js at
 *    build time) and exposed as a CSS custom property so Tailwind's `font-sans`
 *    utility can reference it.
 * 4. ThemeProvider wraps the entire subtree so any component can call `useTheme`.
 * 5. `suppressHydrationWarning` on `<html>` prevents React from complaining that
 *    the server-rendered class list differs from the client's (the theme script
 *    may have added `.dark` before hydration).
 */
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import "../styles/globals.css";

// Runs before React hydrates — reads localStorage and sets .dark on <html> with zero flash.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-sans" });

const siteName = "Dev Toolkit";
const description = "A curated collection of developer utilities built with Next.js 15.";
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mopplications.com";

export const metadata: Metadata = {
  title: {
    default: siteName,
    // Tool pages use generateMetadata to set their own title; the template
    // ensures the site name always appears as a suffix.
    template: `%s | ${siteName}`,
  },
  description,
  metadataBase: new URL(baseUrl),
  applicationName: siteName,
  keywords: [
    "developer tools",
    "next.js utilities",
    "json prettifier",
    "uuid generator",
    "qr code generator",
    "jwt generator",
    "url expander",
  ],
  alternates: {
    canonical: baseUrl,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: siteName,
    description,
    url: baseUrl,
    siteName,
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: siteName,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description,
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#5b21b6",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // `headers()` is a Next.js dynamic API — making this an async Server Component
  // is required so Next.js opts the layout into dynamic rendering for nonce reads.
  const hdrs = await headers();
  const nonce = hdrs.get("x-nonce") ?? "";
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* nonce ties this inline script to the per-request CSP; without it the
            strict-dynamic policy would block script execution. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} suppressHydrationWarning />
      </head>
      <body className={`${inter.variable} font-sans`}>
        <ThemeProvider>
          {/* ThemeToggle is placed here so it renders on every page without
              each page needing to include it explicitly. */}
          <ThemeToggle />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
