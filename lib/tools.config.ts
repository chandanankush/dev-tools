/**
 * Tool registry — the single source of truth for every tool in the gallery.
 *
 * Architecture decisions:
 *  - All tools live in this one array; nothing else in the codebase imports from
 *    individual tool files to discover what tools exist.
 *  - `component` is a thunk (a zero-argument function returning a dynamic import)
 *    so that Next.js code-splits each tool into its own JS chunk. The component
 *    bundle is never loaded until the user actually navigates to that tool's page.
 *  - `ToolMeta` keeps the full Next.js `StaticImageData` object (width/height
 *    metadata needed by <Image>) while `ToolSummary` reduces it to a plain URL
 *    string. This split exists because ToolSummary is serialised as JSON for the
 *    search index and the card grid — shipping the extra metadata fields to the
 *    client would be wasteful.
 *  - `toolSummaries` is derived once at module evaluation time (not per-render)
 *    and sorted alphabetically so the gallery is deterministic regardless of the
 *    order entries appear in the `tools` array above.
 */

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

/**
 * The minimal shape required for a tool to participate in search.
 * Kept separate so the Fuse index can operate on a subset of ToolMeta
 * without pulling in component bundles or image data.
 */
export type ToolSearchable = {
  /** Human-readable name shown in the gallery card and page title. */
  title: string;
  /** Keyword list used as secondary search weight (see search.ts). */
  tags: string[];
};

/**
 * Full tool descriptor used inside the app — extends ToolSearchable with
 * everything needed to render a detail page.
 */
export type ToolMeta = ToolSearchable & {
  /** URL segment used for routing, e.g. "json-tools" → /tools/json-tools. */
  slug: string;
  /** One-line summary shown on gallery cards and in search results. */
  description: string;
  /**
   * Next.js StaticImageData (includes width/height) so <Image> can compute
   * layout without a network round-trip. Use the plain `.src` string for
   * serialisation (see ToolSummary).
   */
  thumbnail: StaticImageData;
  /** Lucide icon name rendered on the card badge; optional cosmetic only. */
  icon?: string;
  /**
   * Thunk that returns the dynamic import for the tool's React component.
   * Expressed as a function (rather than a direct `import()` call) so the
   * import is deferred until the tool page is actually mounted, enabling
   * per-tool code splitting. The resolved module must export a default React
   * component via `{ default: ComponentType }`.
   */
  component: () => Promise<{ default: ComponentType }>;
};

/**
 * Serialisation-safe subset of ToolMeta used for the gallery grid and the
 * client-side search index. Strips the component thunk (not serialisable)
 * and replaces StaticImageData with a plain URL string.
 */
export type ToolSummary = ToolSearchable & {
  /** Same value as ToolMeta.slug. */
  slug: string;
  /** Same value as ToolMeta.description. */
  description: string;
  /** Same value as ToolMeta.icon. */
  icon?: string;
  /** Plain URL string extracted from StaticImageData.src for safe serialisation. */
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
  {
    slug: "basic-calculator",
    title: "Basic Calculator",
    description: "Evaluate arithmetic expressions with history. Supports +, -, *, /, parentheses, and decimals.",
    tags: ["calculator", "math", "arithmetic", "developer"],
    thumbnail: uuidThumbnail,
    icon: "calculator",
    component: () => import("@/components/tools/BasicCalculator"),
  },
  {
    slug: "editor-pad",
    title: "Editor Pad",
    description: "A browser-based notepad with multiple notes, plain and rich text modes, find & replace, and file import/export.",
    tags: ["editor", "notepad", "text", "rich text", "notes", "writing"],
    thumbnail: uuidThumbnail,
    icon: "notebook-pen",
    component: () => import("@/components/tools/EditorPad"),
  },
];

/**
 * Looks up the full ToolMeta (including the component thunk) by its URL slug.
 * Returns undefined when no matching tool exists, allowing the tool page to
 * render a 404 rather than throw.
 */
export function getToolBySlug(slug: string): ToolMeta | undefined {
  return tools.find((tool) => tool.slug === slug);
}

/**
 * Pre-computed, alphabetically sorted list of ToolSummary objects for the
 * gallery grid and client-side search index. Built once at module load time.
 *
 * The `component` thunk and full StaticImageData are stripped here so that
 * this array is safe to pass as JSON to Client Components without hitting
 * Next.js serialisation restrictions.
 */
export const toolSummaries: ToolSummary[] = tools
  .map((tool) => {
    const { component, thumbnail, ...rest } = tool;
    // `component` is intentionally discarded; the void prevents lint warnings
    // about unused destructured variables.
    void component;
    return {
      ...rest,
      thumbnail: thumbnail.src,
    };
  })
  .sort((a, b) => a.title.localeCompare(b.title, "en", { sensitivity: "base" }));
