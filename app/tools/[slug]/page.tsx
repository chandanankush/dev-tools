import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ToolShell } from "@/components/ToolShell";
import { getToolBySlug, tools } from "@/lib/tools.config";

interface ToolPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  return tools.map((tool) => ({ slug: tool.slug }));
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mopplications.com";

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
      images: tool.thumbnail ? [{ url: tool.thumbnail.src }] : undefined,
    },
  };
}

export default async function ToolPage({ params }: ToolPageProps) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);

  if (!tool) {
    notFound();
  }

  const ToolComponent = (await tool.component()).default;

  return (
    <main className="w-full px-4 py-8 sm:px-6 sm:py-12 lg:px-10 xl:px-16 2xl:px-20">
      <ToolShell title={tool.title} description={tool.description}>
        <ToolComponent />
      </ToolShell>
    </main>
  );
}
