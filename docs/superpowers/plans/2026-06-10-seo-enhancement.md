# Google SEO Enhancement (Option B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Google discoverability of mopplications.com at both site level (homepage) and tool level (individual tool pages) by fixing stale metadata, adding JSON-LD structured data, expanding search-query-matched tags, and generating a proper OG image.

**Architecture:** All changes are in Next.js App Router files — no new runtime dependencies (Next.js bundles `next/og`). JSON-LD is rendered as `<script type="application/ld+json">` tags in Server Components; this MIME type is outside `script-src` CSP scope (not executable), so no nonce is required. The OG image is generated at build time via `app/opengraph-image.tsx`. A `lib/seo.ts` helper keeps the JSON-LD construction testable and decoupled from the page component.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Vitest 4, `next/og` (ImageResponse), schema.org structured data

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `lib/tools.config.ts` | Modify | Expand `tags` arrays with real search query terms |
| `app/sitemap.ts` | Modify | Update date, tune priorities, add `/privacy` entry |
| `app/layout.tsx` | Modify | Keyword-rich description, expand keywords, remove broken `/og.png` ref |
| `app/opengraph-image.tsx` | Create | Build-time 1200×630 OG image via `ImageResponse` |
| `lib/seo.ts` | Create | `buildToolJsonLd(tool, url)` helper — keeps JSON-LD logic testable |
| `app/tools/[slug]/page.tsx` | Modify | Inject `SoftwareApplication` JSON-LD per tool |
| `app/page.tsx` | Modify | Inject `WebSite` JSON-LD on homepage |
| `tests/seo/sitemap.test.ts` | Create | Verify sitemap entries, priorities, date |
| `tests/seo/seo.test.ts` | Create | Verify `buildToolJsonLd` output structure |

---

### Task 1: Expand tool tags in `lib/tools.config.ts`

**Files:**
- Modify: `lib/tools.config.ts`

- [ ] **Step 1: Update `tags` for all 13 tools**

In `lib/tools.config.ts`, replace each tool's `tags` array with the expanded versions below. Find each `slug` to locate the correct entry.

```ts
// slug: "json-tools"
tags: ["json", "format", "viewer", "tree", "developer", "json formatter online", "json prettifier", "json validator"],

// slug: "uuid-generator"
tags: ["uuid", "generator", "id", "uuid generator online free", "guid generator"],

// slug: "short-url-expander"
tags: ["url", "short", "expand", "url expander", "unshorten url", "link expander"],

// slug: "qr-code-generator"
tags: ["qr", "code", "generator", "qr code generator free", "qr code maker"],

// slug: "jwt-generator"
tags: ["jwt", "auth", "token", "jwt decoder online", "jwt builder", "json web token"],

// slug: "compare-tools"
tags: ["compare", "json", "curl", "diff", "json diff", "json compare online", "curl compare"],

// slug: "base64-tool"
tags: ["base64", "encoding", "decoding", "base64 encoder decoder online", "base64 converter"],

// slug: "regex-tester"
tags: ["regex", "regexp", "search", "developer", "regex tester online", "regular expression tester"],

// slug: "timestamp-converter"
tags: ["timestamp", "date", "unix", "converter", "time", "unix timestamp converter", "epoch converter"],

// slug: "url-encoder-decoder"
tags: ["url", "encode", "decode", "percent", "developer", "url encode decode online", "percent encode"],

// slug: "password-generator"
tags: ["password", "security", "generator", "random", "password generator online", "strong password generator"],

// slug: "basic-calculator"
tags: ["calculator", "math", "arithmetic", "developer", "online calculator", "expression calculator"],

// slug: "editor-pad"
tags: ["editor", "notepad", "text", "rich text", "notes", "writing", "online notepad", "browser text editor", "rich text editor online"],
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm build 2>&1 | tail -10
```

Expected: no type errors (zero lines starting with `Type error:`)

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

Expected: all 97 tests pass

- [ ] **Step 4: Commit**

```bash
git add lib/tools.config.ts
git commit -m "feat(seo): expand tool tags with real search query terms"
```

---

### Task 2: Update `app/sitemap.ts` (TDD)

**Files:**
- Create: `tests/seo/sitemap.test.ts`
- Modify: `app/sitemap.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/seo/sitemap.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import sitemap from "@/app/sitemap";

const HIGH_VALUE_SLUGS = ["uuid-generator", "jwt-generator", "qr-code-generator", "password-generator"];

describe("sitemap", () => {
  it("includes the homepage at priority 1", () => {
    const entries = sitemap();
    const home = entries.find((e) => e.url === "https://mopplications.com");
    expect(home).toBeDefined();
    expect(home?.priority).toBe(1);
  });

  it("includes the privacy page at priority 0.3", () => {
    const entries = sitemap();
    const privacy = entries.find((e) => e.url === "https://mopplications.com/privacy");
    expect(privacy).toBeDefined();
    expect(privacy?.priority).toBe(0.3);
  });

  it("gives high-value tools priority 0.9", () => {
    const entries = sitemap();
    for (const slug of HIGH_VALUE_SLUGS) {
      const entry = entries.find((e) => e.url === `https://mopplications.com/tools/${slug}`);
      expect(entry?.priority, `expected ${slug} to have priority 0.9`).toBe(0.9);
    }
  });

  it("gives other tools priority 0.7", () => {
    const entries = sitemap();
    const jsonTools = entries.find((e) => e.url === "https://mopplications.com/tools/json-tools");
    expect(jsonTools?.priority).toBe(0.7);
  });

  it("uses the 2026-06-10 lastModified date", () => {
    const entries = sitemap();
    const home = entries.find((e) => e.url === "https://mopplications.com");
    expect(home?.lastModified).toBe("2026-06-10");
  });
});
```

- [ ] **Step 2: Run to confirm failures**

```bash
pnpm test tests/seo/sitemap.test.ts
```

Expected: 2–4 failures (privacy missing, priorities wrong, date stale)

- [ ] **Step 3: Rewrite `app/sitemap.ts`**

Replace the entire file content:

```ts
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm test tests/seo/sitemap.test.ts
```

Expected: `5 passed`

- [ ] **Step 5: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add app/sitemap.ts tests/seo/sitemap.test.ts
git commit -m "feat(seo): update sitemap with current date, priority tuning, and privacy page"
```

---

### Task 3: Fix global metadata in `app/layout.tsx`

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Replace the `metadata` export**

In `app/layout.tsx`, find the `export const metadata: Metadata = { ... }` block (lines 38–95) and replace it entirely:

```ts
export const metadata: Metadata = {
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description:
    "Free browser-based developer tools: JSON formatter, UUID generator, JWT builder, QR code maker, regex tester, Base64 encoder, and more. No install required.",
  metadataBase: new URL(baseUrl),
  applicationName: siteName,
  keywords: [
    "developer tools online",
    "free developer utilities",
    "browser tools for developers",
    "json formatter online",
    "json prettifier",
    "json validator",
    "uuid generator online free",
    "guid generator",
    "jwt decoder online",
    "jwt builder",
    "json web token",
    "qr code generator free",
    "qr code maker",
    "regex tester online",
    "regular expression tester",
    "base64 encoder decoder online",
    "base64 converter",
    "unix timestamp converter",
    "epoch converter",
    "url encode decode online",
    "password generator online",
    "strong password generator",
    "online notepad",
    "browser text editor",
    "url expander",
    "unshorten url",
    "json diff",
    "json compare online",
  ],
  alternates: {
    canonical: baseUrl,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: siteName,
    description:
      "Free browser-based developer tools: JSON formatter, UUID generator, JWT builder, QR code maker, regex tester, Base64 encoder, and more. No install required.",
    url: baseUrl,
    siteName,
    type: "website",
    locale: "en_US",
    // No images field — app/opengraph-image.tsx provides the og:image automatically.
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description:
      "Free browser-based developer tools: JSON formatter, UUID generator, JWT builder, QR code maker, regex tester, Base64 encoder, and more. No install required.",
  },
  icons: {
    icon: "/favicon.ico",
  },
};
```

- [ ] **Step 2: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(seo): keyword-rich root description, expanded keywords, remove broken og.png ref"
```

---

### Task 4: Create build-time OG image

**Files:**
- Create: `app/opengraph-image.tsx`

- [ ] **Step 1: Create `app/opengraph-image.tsx`**

```tsx
import { ImageResponse } from "next/og";

export const alt = "Dev Toolkit — Free browser-based developer tools";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0f172a",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#f8fafc",
            letterSpacing: "-2px",
          }}
        >
          Dev Toolkit
        </div>
        <div
          style={{
            fontSize: 30,
            color: "#94a3b8",
            textAlign: "center",
            maxWidth: 800,
          }}
        >
          Free browser-based developer tools — no install required
        </div>
        <div
          style={{
            fontSize: 22,
            color: "#818cf8",
            marginTop: 12,
          }}
        >
          mopplications.com
        </div>
      </div>
    ),
    { ...size }
  );
}
```

- [ ] **Step 2: Build to confirm `ImageResponse` compiles**

```bash
pnpm build 2>&1 | grep -E "error|opengraph" | head -10
```

Expected: no lines containing `error`

- [ ] **Step 3: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add app/opengraph-image.tsx
git commit -m "feat(seo): add build-time OG image via Next.js ImageResponse"
```

---

### Task 5: JSON-LD helper + tool page structured data (TDD)

**Files:**
- Create: `lib/seo.ts`
- Create: `tests/seo/seo.test.ts`
- Modify: `app/tools/[slug]/page.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/seo/seo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildToolJsonLd, serializeJsonLd } from "@/lib/seo";
import type { ToolMeta } from "@/lib/tools.config";

const mockTool: Pick<ToolMeta, "title" | "description"> = {
  title: "UUID Generator",
  description: "Generate RFC 4122 compliant UUIDs on demand.",
};

const canonicalUrl = "https://mopplications.com/tools/uuid-generator";

describe("buildToolJsonLd", () => {
  it("returns a SoftwareApplication schema object", () => {
    const ld = buildToolJsonLd(mockTool, canonicalUrl);
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("SoftwareApplication");
  });

  it("sets applicationCategory to DeveloperApplication", () => {
    const ld = buildToolJsonLd(mockTool, canonicalUrl);
    expect(ld.applicationCategory).toBe("DeveloperApplication");
  });

  it("sets operatingSystem to Web", () => {
    const ld = buildToolJsonLd(mockTool, canonicalUrl);
    expect(ld.operatingSystem).toBe("Web");
  });

  it("includes a free Offer", () => {
    const ld = buildToolJsonLd(mockTool, canonicalUrl);
    expect(ld.offers).toEqual({ "@type": "Offer", price: "0", priceCurrency: "USD" });
  });

  it("uses tool name, description, and canonical url", () => {
    const ld = buildToolJsonLd(mockTool, canonicalUrl);
    expect(ld.name).toBe("UUID Generator");
    expect(ld.description).toBe("Generate RFC 4122 compliant UUIDs on demand.");
    expect(ld.url).toBe(canonicalUrl);
  });
});

describe("serializeJsonLd", () => {
  it("escapes < to prevent </script> injection", () => {
    const result = serializeJsonLd({ description: "</script><script>alert(1)" });
    expect(result).not.toContain("</script>");
    expect(result).toContain("\\u003c");
  });

  it("produces valid JSON after escaping", () => {
    const obj = { name: "test", url: "https://example.com" };
    const result = serializeJsonLd(obj);
    expect(() => JSON.parse(result)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test tests/seo/seo.test.ts
```

Expected: `Cannot find module '@/lib/seo'`

- [ ] **Step 3: Create `lib/seo.ts`**

```ts
import type { ToolMeta } from "@/lib/tools.config";

export interface ToolJsonLd {
  "@context": "https://schema.org";
  "@type": "SoftwareApplication";
  name: string;
  applicationCategory: "DeveloperApplication";
  operatingSystem: "Web";
  offers: { "@type": "Offer"; price: "0"; priceCurrency: "USD" };
  description: string;
  url: string;
}

export function buildToolJsonLd(
  tool: Pick<ToolMeta, "title" | "description">,
  url: string
): ToolJsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: tool.title,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description: tool.description,
    url,
  };
}

// JSON.stringify does not escape `<`, so a description containing `</script>`
// would terminate the script tag early and allow HTML injection. Unicode-escape
// `<` before writing to dangerouslySetInnerHTML.
export function serializeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm test tests/seo/seo.test.ts
```

Expected: `5 passed`

- [ ] **Step 5: Update `app/tools/[slug]/page.tsx`**

Add the import at the top of the file, after the existing imports:

```ts
import { buildToolJsonLd, serializeJsonLd } from "@/lib/seo";
```

In the `ToolPage` function, `canonicalUrl` is already computed in `generateMetadata` but not in the page scope. Add it inside `ToolPage`, then wrap the return with a fragment and the JSON-LD script.

Find the `ToolPage` function body (after `const ToolComponent = ...` line) and replace the `return` statement:

```tsx
  const canonicalUrl = `${baseUrl}/tools/${slug}`;
  const jsonLd = buildToolJsonLd(tool, canonicalUrl);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <main className="w-full px-4 py-8 sm:px-6 sm:py-12 lg:px-10 xl:px-16 2xl:px-20">
        <ToolShell title={tool.title} description={tool.description}>
          <ToolComponent />
        </ToolShell>
      </main>
    </>
  );
```

- [ ] **Step 6: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add lib/seo.ts tests/seo/seo.test.ts app/tools/[slug]/page.tsx
git commit -m "feat(seo): add SoftwareApplication JSON-LD to tool pages"
```

---

### Task 6: Add WebSite JSON-LD to homepage

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add `websiteJsonLd` constant to `app/page.tsx`**

Add after the existing imports at the top of `app/page.tsx` (including the import for `serializeJsonLd`):

```ts
import { serializeJsonLd } from "@/lib/seo";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mopplications.com";

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Dev Toolkit",
  url: baseUrl,
  description:
    "Free browser-based developer tools: JSON formatter, UUID generator, JWT builder, QR code maker, regex tester, Base64 encoder, and more. No install required.",
};
```

- [ ] **Step 2: Wrap the homepage return with a fragment and JSON-LD script**

Find the `return (` in `HomePage` and replace it so the script is the first child:

```tsx
export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(websiteJsonLd) }}
      />
      <main className="relative isolate min-h-screen overflow-hidden">
        {/* ... all existing content inside <main> is unchanged ... */}
```

Only the outer wrapper changes — everything inside `<main>` stays identical.

- [ ] **Step 3: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass

- [ ] **Step 4: Run build**

```bash
pnpm build 2>&1 | tail -10
```

Expected: zero type errors

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat(seo): add WebSite JSON-LD schema to homepage"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run full checks**

```bash
pnpm test && pnpm build && pnpm lint
```

Expected: zero errors across all three

- [ ] **Step 2: Start dev server and verify sitemap**

```bash
pnpm dev &
DEV_PID=$!
sleep 6
curl -s http://localhost:3000/sitemap.xml | grep -E "<loc>|<priority>" | head -20
kill $DEV_PID
```

Expected output includes:
```
<loc>https://mopplications.com</loc>
<priority>1</priority>
<loc>https://mopplications.com/privacy</loc>
<priority>0.3</priority>
<loc>https://mopplications.com/tools/uuid-generator</loc>
<priority>0.9</priority>
<loc>https://mopplications.com/tools/json-tools</loc>
<priority>0.7</priority>
```

- [ ] **Step 3: Verify JSON-LD in a tool page**

```bash
pnpm dev &
DEV_PID=$!
sleep 6
curl -s http://localhost:3000/tools/uuid-generator | grep -o 'application/ld+json.*' | head -2
kill $DEV_PID
```

Expected: `application/ld+json` present with `"@type":"SoftwareApplication"`

- [ ] **Step 4: Verify OG image route**

```bash
pnpm dev &
DEV_PID=$!
sleep 6
curl -sI http://localhost:3000/opengraph-image | grep content-type
kill $DEV_PID
```

Expected: `content-type: image/png`

- [ ] **Step 5: Verify homepage JSON-LD**

```bash
pnpm dev &
DEV_PID=$!
sleep 6
curl -s http://localhost:3000 | grep -o '"@type":"WebSite"'
kill $DEV_PID
```

Expected: `"@type":"WebSite"`
