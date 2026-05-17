/**
 * Dynamic tool page — renders a single tool by slug (e.g. /tools/uuid-generator).
 *
 * Static generation strategy:
 * - `generateStaticParams` returns every known slug at build time so Next.js
 *   pre-renders all tool pages as static HTML. No server is needed at runtime
 *   for these routes.
 * - If a slug is requested that doesn't exist in the registry (e.g. a stale
 *   bookmark or a mistyped URL), `notFound()` hands control to `not-found.tsx`.
 *
 * Dynamic import pattern:
 * - Each tool entry in the registry exposes a `component` thunk —
 *   `() => import("../path/to/ToolComponent")`. Awaiting it here keeps every
 *   tool's code out of the shared bundle; only the requested tool's module is
 *   loaded for a given page render.
 *
 * Metadata:
 * - `generateMetadata` runs at build time (same slug iteration as the page
 *   itself) and sets per-tool Open Graph tags and a canonical URL, which is
 *   important for SEO since each tool has a unique description.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ToolShell } from "@/components/ToolShell";
import { getToolBySlug, tools } from "@/lib/tools.config";

/** Shape of the route segment params for this dynamic route. */
interface ToolPageProps {
  params: Promise<{
    slug: string;
  }>;
}

/**
 * Tells Next.js which slugs to pre-render at build time.
 * Every tool registered in `tools.config.ts` gets a static page — no
 * on-demand ISR or server rendering is needed.
 */
export async function generateStaticParams() {
  return tools.map((tool) => ({ slug: tool.slug }));
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mopplications.com";

/**
 * Generates per-tool metadata for `<head>` (title, description, OG image,
 * canonical URL). Returns an empty object for unknown slugs; `notFound()` in
 * the page component handles the actual 404 response in that case.
 */
export async function generateMetadata({ params }: ToolPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolBySlug(slug);

  if (!tool) {
    return {};
  }

  const title = `${tool.title} | Dev Toolkit`;
  const description = tool.description;
  const canonicalUrl = `${baseUrl}/tools/${slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      // Only set an OG image if the tool has a thumbnail; omitting it is
      // preferable to sending a broken image URL.
      images: tool.thumbnail ? [{ url: tool.thumbnail.src }] : undefined,
    },
  };
}

export default async function ToolPage({ params }: ToolPageProps) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);

  if (!tool) {
    // Triggers the nearest not-found.tsx boundary; never returns.
    notFound();
  }

  // Execute the dynamic import thunk to load only this tool's module.
  // `.default` is the standard ES module default export convention.
  const ToolComponent = (await tool.component()).default;

  return (
    <main className="w-full px-4 py-8 sm:px-6 sm:py-12 lg:px-10 xl:px-16 2xl:px-20">
      <ToolShell title={tool.title} description={tool.description}>
        <ToolComponent />
      </ToolShell>
    </main>
  );
}
