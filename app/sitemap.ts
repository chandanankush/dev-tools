/**
 * sitemap.ts — Next.js XML sitemap route.
 *
 * Generates one entry per tool by iterating the central `tools` array, so
 * adding a new tool to tools.config.ts automatically includes it in the
 * sitemap without touching this file.
 *
 * `LAST_UPDATED` is a hard-coded date rather than a build timestamp so that
 * crawlers are not told the content changed on every redeploy (which would
 * waste crawl budget). Update it manually when tool content meaningfully changes.
 */

import type { MetadataRoute } from "next";

import { tools } from "@/lib/tools.config";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mopplications.com";

// Use a fixed build date so lastModified doesn't change on every crawl.
// Update this when you make meaningful content changes to signal Google to re-crawl.
const LAST_UPDATED = "2025-01-01";

export default function sitemap(): MetadataRoute.Sitemap {
  const toolEntries = tools.map((tool) => ({
    url: `${baseUrl}/tools/${tool.slug}`,
    lastModified: LAST_UPDATED,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [
    {
      url: baseUrl,
      lastModified: LAST_UPDATED,
      changeFrequency: "weekly" as const,
      priority: 1,
    },
    ...toolEntries,
  ];
}
