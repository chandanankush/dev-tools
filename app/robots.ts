/**
 * robots.ts — Next.js robots.txt route.
 *
 * Allows all crawlers and advertises the sitemap URL so search engines can
 * discover all tool pages automatically.
 *
 * `NEXT_PUBLIC_SITE_URL` lets the same build artefact be deployed to staging
 * (different domain) and production without re-building; the fallback ensures
 * the production URL is correct when the variable is absent.
 */

import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mopplications.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: [`${baseUrl}/sitemap.xml`],
    host: baseUrl,
  };
}
