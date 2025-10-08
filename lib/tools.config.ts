import base64Thumbnail from "@/public/thumbs/base64.png";
import jsonThumbnail from "@/public/thumbs/json.png";
import jsonViewerThumbnail from "@/public/thumbs/json-viewer.png";
import jwtGeneratorThumbnail from "@/public/thumbs/jwt-generator.png";
import qrCodeThumbnail from "@/public/thumbs/qr-code.png";
import urlExpanderThumbnail from "@/public/thumbs/url-expander.png";
import uuidThumbnail from "@/public/thumbs/uuid.png";
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
  {
    slug: "short-url-expander",
    title: "Short URL Expander",
    description: "Reveal the final destination behind shortened links.",
    tags: ["url", "short", "expand"],
    thumbnail: urlExpanderThumbnail,
    icon: "link",
    component: () => import("@/components/tools/UrlExpander"),
  },
  {
    slug: "qr-code-generator",
    title: "QR Code Generator",
    description: "Encode text or URLs into QR codes with instant preview and PNG download.",
    tags: ["qr", "code", "generator"],
    thumbnail: qrCodeThumbnail,
    icon: "qrcode",
    component: () => import("@/components/tools/QrCodeGenerator"),
  },
  {
    slug: "jwt-generator",
    title: "JWT Generator",
    description: "Craft HS256 JWTs with custom payload fields directly in your browser.",
    tags: ["jwt", "auth", "token"],
    thumbnail: jwtGeneratorThumbnail,
    icon: "shield",
    component: () => import("@/components/tools/JwtGenerator"),
  },
  {
    slug: "base64-tool",
    title: "Base64 Tool",
    description: "Encode plain text or decode Base64 strings with instant copy-friendly output.",
    tags: ["base64", "encoding", "decoding"],
    thumbnail: base64Thumbnail,
    icon: "binary",
    component: () => import("@/components/tools/Base64Utility"),
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
