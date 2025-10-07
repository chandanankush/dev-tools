import jsonThumbnail from "@/public/thumbs/json.png";
import uuidThumbnail from "@/public/thumbs/uuid.png";
import jsonViewerThumbnail from "@/public/thumbs/json-viewer.png";
import type { ComponentType } from "react";
import type { StaticImageData } from "next/image";

export type ToolMeta = {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  thumbnail: StaticImageData;
  icon?: string;
  component: () => Promise<{ default: ComponentType }>; // lazy-loaded per tool
};

export type ToolSummary = Omit<ToolMeta, "component" | "thumbnail"> & {
  thumbnail: string;
};

export const tools: ToolMeta[] = [
  {
    slug: "json-prettifier",
    title: "JSON Prettifier",
    description: "Format and validate JSON with instant feedback.",
    tags: ["json", "format", "developer"],
    thumbnail: jsonThumbnail,
    icon: "braces",
    component: () => import("@/components/tools/JsonPrettifier"),
  },
  {
    slug: "uuid-generator",
    title: "UUID Generator",
    description: "Generate RFC 4122 compliant UUIDs on demand.",
    tags: ["uuid", "generator", "id"],
    thumbnail: uuidThumbnail,
    icon: "fingerprint",
    component: () => import("@/components/tools/UuidGenerator"),
  },
  {
    slug: "json-viewer",
    title: "JSON Viewer",
    description: "Inspect and explore JSON data with a blazing-fast tree explorer.",
    tags: ["json", "viewer", "tree"],
    thumbnail: jsonViewerThumbnail,
    icon: "tree",
    component: () => import("@/components/tools/JsonViewer"),
  },
];

export const toolSummaries: ToolSummary[] = tools.map((tool) => {
  const { component, thumbnail, ...rest } = tool;
  void component;
  return {
    ...rest,
    thumbnail: thumbnail.src,
  };
});

export function getToolBySlug(slug: string) {
  return tools.find((tool) => tool.slug === slug);
}
