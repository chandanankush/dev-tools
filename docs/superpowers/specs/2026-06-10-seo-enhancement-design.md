# SEO Enhancement — Design Spec

**Date:** 2026-06-10  
**Branch:** development  
**Scope:** Option B — structured metadata enhancement (site-level + tool-level Google discoverability)

---

## Goal

Make both the homepage and individual tool pages discoverable in Google search.

- Homepage ranks as a curated developer tools collection
- Each tool page ranks independently for its own search queries (e.g. "regex tester online", "uuid generator free")

---

## Changes

### 1. `app/sitemap.ts`

- Update `LAST_UPDATED` from `"2025-01-01"` to `"2026-06-10"` so Google knows content is current
- Tune `priority` per tool: `0.9` for high-traffic keyword tools (`uuid-generator`, `jwt-generator`, `qr-code-generator`, `password-generator`), `0.7` for all others
- Add `/privacy` page as a sitemap entry (`changeFrequency: "yearly"`, `priority: 0.3`)

### 2. `app/layout.tsx`

- Replace description `"A curated collection of developer utilities built with Next.js 15."` with a keyword-rich description: `"Free browser-based developer tools: JSON formatter, UUID generator, JWT builder, QR code maker, regex tester, Base64 encoder, and more. No install required."`
- Expand `keywords` array to cover real search queries across all 13 tools (see Keyword Strategy section)
- Remove the broken `openGraph.images` reference to `/og.png` (file does not exist in `/public`) — the new `app/opengraph-image.tsx` file replaces it via Next.js convention
- Omit `twitter:creator` — no Twitter/X account to reference

### 3. `app/opengraph-image.tsx` (new file)

Generate a 1200×630 OG image at build time using Next.js `ImageResponse`. Displays the site name ("Dev Toolkit"), tagline, and the `mopplications.com` domain. This satisfies the `og:image` tag for all pages that don't override it (homepage, privacy page). No runtime dependency — generated as a static asset at build time.

### 4. `app/tools/[slug]/page.tsx`

Inject a `<script type="application/ld+json">` tag inside the page `<head>` with a `SoftwareApplication` schema for each tool:

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "<tool.title>",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "Web",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "description": "<tool.description>",
  "url": "https://mopplications.com/tools/<tool.slug>"
}
```

The `"price": "0"` value signals to Google that the tool is free — eligible to display "Free" in rich results. The JSON-LD is rendered as a Server Component (no `"use client"` needed).

### 5. `app/page.tsx`

Inject a bare `WebSite` JSON-LD schema on the homepage:

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Dev Toolkit",
  "url": "https://mopplications.com",
  "description": "Free browser-based developer tools..."
}
```

`SearchAction`/`potentialAction` is omitted — the gallery search does not support `?q=` URL parameters, so including it would be invalid and ignored by Google.

### 6. `lib/tools.config.ts`

Expand `tags` arrays per tool to include real search query terms. No type changes required — `tags` is already `string[]`.

| Tool | Expanded tags (additions) |
|---|---|
| JSON Tools | `"json formatter online"`, `"json prettifier"`, `"json validator"` |
| UUID Generator | `"uuid generator online free"`, `"guid generator"` |
| Short URL Expander | `"url expander"`, `"unshorten url"`, `"link expander"` |
| QR Code Generator | `"qr code generator free"`, `"qr code maker"` |
| JWT Generator | `"jwt decoder online"`, `"jwt builder"`, `"json web token"` |
| Compare Tools | `"json diff"`, `"json compare online"`, `"curl compare"` |
| Base64 Tool | `"base64 encoder decoder online"`, `"base64 converter"` |
| Regex Tester | `"regex tester online"`, `"regexp tester"`, `"regular expression tester"` |
| Timestamp Converter | `"unix timestamp converter"`, `"epoch converter"`, `"date converter"` |
| URL Encoder / Decoder | `"url encode decode online"`, `"percent encode"` |
| Password Generator | `"password generator online"`, `"strong password generator"`, `"random password"` |
| Basic Calculator | `"online calculator"`, `"expression calculator"` |
| Editor Pad | `"online notepad"`, `"browser text editor"`, `"rich text editor online"` |

---

## Keyword Strategy

Root metadata `keywords` in `layout.tsx` should aggregate the most important terms across all tools plus site-level terms:

```
developer tools online, free developer utilities, browser tools for developers,
json formatter online, uuid generator online free, guid generator,
jwt decoder online, jwt builder, json web token,
qr code generator free, regex tester online, base64 encoder decoder online,
unix timestamp converter, epoch converter, url encode decode online,
password generator online, strong password generator,
online notepad, browser text editor, url expander, unshorten url,
json diff, json compare online
```

---

## Out of Scope

- Dynamic per-tool OG images (Option C)
- PWA manifest
- Breadcrumb JSON-LD
- `?q=` search URL parameter (would be needed for `SearchAction`)

---

## Files Touched

```
app/sitemap.ts              — update date, priorities, add /privacy
app/layout.tsx              — description, keywords, remove broken og.png ref
app/opengraph-image.tsx     — new: Next.js ImageResponse OG image
app/tools/[slug]/page.tsx   — add SoftwareApplication JSON-LD
app/page.tsx                — add WebSite JSON-LD
lib/tools.config.ts         — expand tags per tool
```
