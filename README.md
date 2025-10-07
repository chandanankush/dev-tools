# Dev Toolkit

A TypeScript-first Next.js 15 App Router project for showcasing developer utilities. The homepage renders a searchable grid of tools sourced from a single configuration file so new tools can be added with minimal effort.

## Features

- ⚡️ Next.js 15 App Router with React Server Components
- 🎨 Tailwind CSS, shadcn/ui primitives, and lucide-react icons
- 🔍 Fuse.js fuzzy search across tool titles and tags
- 🧱 Modular tool registry via `lib/tools.config.ts`
- 🧰 Example tools: JSON Prettifier, UUID Generator, and JSON Viewer
- 🖼️ Rich thumbnails with matching lucide-react icons

## Getting started

```bash
pnpm install
pnpm dev
```

### Available scripts

- `pnpm dev` – start the development server
- `pnpm build` – create an optimized production build
- `pnpm start` – run the production server
- `pnpm lint` – lint with ESLint and Next.js rules
- `pnpm format` – format all supported files with Prettier

## Project layout

```
app/
  layout.tsx               # Global metadata + layout
  page.tsx                 # Homepage grid & search
  tools/[slug]/page.tsx    # Dynamic tool route using the registry
components/
  ToolCard.tsx             # Card representation for each tool tile
  ToolGallery.tsx          # Client component for Fuse.js search
  ToolShell.tsx            # Shell used on individual tool pages
  tools/                   # Lazy-loaded tool implementations
  ui/                      # shadcn/ui primitives (button, input, etc.)
lib/
  tools.config.ts          # Single source of truth for available tools
  search.ts                # Fuse.js wrapper with memoised index
styles/
  globals.css              # Tailwind base + design tokens
public/
  thumbs/                  # Tool thumbnails
```

## Adding a new tool

1. **Register metadata** in `lib/tools.config.ts`:
   - Add an object with `slug`, `title`, `description`, `tags`, `thumbnail`, `icon`, and `component`.
   - `icon` should be a string key that maps to one of the icons in `components/ToolCard.tsx`'s `iconLibrary`. Add new entries there if you need additional icons.
   - Point `component` to a lazy import, e.g. `() => import("@/components/tools/MyTool")`.
2. **Create the component** under `components/tools/` and export a default React component.
   - Use shadcn/ui primitives when possible for visual consistency.
   - For client-side interactivity, start the file with `"use client";`.
3. **Add a thumbnail** image to `public/thumbs/` and reference it in the config.
4. Optionally add tests or stories that live close to the new component.

Once saved, the tool automatically appears on the homepage, participates in search, and can be accessed at `/tools/{slug}`.

## Deployment

The project is Vercel-ready with defaults provided by Next.js. Configure your deployment to use the `pnpm build` and `pnpm start` commands or deploy directly from GitHub with Vercel.
