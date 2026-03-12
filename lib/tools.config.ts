import base64Thumbnail from "@/public/thumbs/base64.png";
import compareThumbnail from "@/public/thumbs/json-viewer.png";
import jsonThumbnail from "@/public/thumbs/json.png";
import regexThumbnail from "@/public/thumbs/uuid.png";

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
    slug: "json-tools",
    title: "JSON Tools",
    description: "All-in-one JSON utility: Prettify, Validate, and Explore.",
    tags: ["json", "format", "viewer", "tree", "developer"],
    thumbnail: jsonThumbnail,
    icon: "braces",
    component: () => import("@/components/tools/JsonTools"),
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
    slug: "compare-tools",
    title: "Compare Tools",
    description: "Side-by-side comparison for JSON payloads and cURL commands.",
    tags: ["compare", "json", "curl", "diff"],
    thumbnail: compareThumbnail,
    icon: "braces",
    component: () => import("@/components/tools/CompareTools"),
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
  {
    slug: "regex-tester",
    title: "Regex Tester",
    description: "Build and test regular expressions with live match highlighting, flag toggles, and named group support.",
    tags: ["regex", "regexp", "search", "developer"],
    thumbnail: regexThumbnail,
    icon: "braces",
    component: () => import("@/components/tools/RegexTester"),
  },
  {
    slug: "timestamp-converter",
    title: "Timestamp Converter",
    description: "Convert Unix timestamps to human-readable dates and back. Supports seconds/milliseconds and local/UTC timezones.",
    tags: ["timestamp", "date", "unix", "converter", "time"],
    thumbnail: uuidThumbnail,
    icon: "clock",
    component: () => import("@/components/tools/TimestampConverter"),
  },
  {
    slug: "url-encoder-decoder",
    title: "URL Encoder / Decoder",
    description: "Percent-encode or decode URL components instantly. Safe for query params, path segments, and full URLs.",
    tags: ["url", "encode", "decode", "percent", "developer"],
    thumbnail: urlExpanderThumbnail,
    icon: "globe2",
    component: () => import("@/components/tools/UrlEncoderDecoder"),
  },
  {
    slug: "password-generator",
    title: "Password Generator",
    description: "Generate strong, cryptographically random passwords with configurable length and character sets.",
    tags: ["password", "security", "generator", "random"],
    thumbnail: uuidThumbnail,
    icon: "key",
    component: () => import("@/components/tools/PasswordGenerator"),
  },
];

export function getToolBySlug(slug: string): ToolMeta | undefined {
  return tools.find((tool) => tool.slug === slug);
}

export const toolSummaries: ToolSummary[] = tools.map((tool) => {
  const { component, thumbnail, ...rest } = tool;
  void component;
  return {
    ...rest,
    thumbnail: thumbnail.src,
  };
});
