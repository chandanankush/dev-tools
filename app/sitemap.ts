import type { MetadataRoute } from "next";
import { tools } from "@/lib/tools.config";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mopplications.com";

const LAST_UPDATED = "2026-06-10";

const HIGH_VALUE_SLUGS = new Set([
  "uuid-generator",
  "jwt-generator",
  "qr-code-generator",
  "password-generator",
]);

export default function sitemap(): MetadataRoute.Sitemap {
  const toolEntries = tools.map((tool) => ({
    url: `${baseUrl}/tools/${tool.slug}`,
    lastModified: LAST_UPDATED,
    changeFrequency: "monthly" as const,
    priority: HIGH_VALUE_SLUGS.has(tool.slug) ? 0.9 : 0.7,
  }));

  return [
    {
      url: baseUrl,
      lastModified: LAST_UPDATED,
      changeFrequency: "weekly" as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: LAST_UPDATED,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    },
    ...toolEntries,
  ];
}
