import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ToolShell } from "@/components/ToolShell";
import { getToolBySlug } from "@/lib/tools.config";

interface ToolPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: ToolPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolBySlug(slug);

  if (!tool) {
    return {};
  }

  const title = `${tool.title} | Dev Toolkit`;
  const description = tool.description;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
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
    <main className="container py-12">
      <ToolShell title={tool.title} description={tool.description}>
        <ToolComponent />
      </ToolShell>
    </main>
  );
}
