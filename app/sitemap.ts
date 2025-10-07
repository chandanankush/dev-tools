import type { MetadataRoute } from "next";

import { tools } from "@/lib/tools.config";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dev-tools.example.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  const toolEntries = tools.map((tool) => ({
    url: `${baseUrl}/tools/${tool.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...toolEntries,
  ];
}
