# Agents & AI Coding Guidelines

This document defines conventions for AI coding agents (GitHub Copilot, Claude, etc.) working in this repository.

---

## Project identity

| Property | Value |
|---|---|
| **Live URL** | https://mopplications.com |
| **Stack** | Next.js 15 (App Router), TypeScript, Tailwind CSS, Tiptap v3, Vitest |
| **Package manager** | pnpm |
| **Node version** | 20 (LTS) |
| **Runtime target** | Browser-first; server only for `/api/expand-url` |

---

## Repository memory

Key facts an agent must know before making changes:

### Tool registry
All tools are registered in a single file: `lib/tools.config.ts`.
- Adding a tool = adding one entry to the `tools` array (slug, title, description, tags, thumbnail, icon, lazy component).
- The `toolSummaries` export is sorted A–Z by title via `localeCompare` — do not break this.
- Never remove `getToolBySlug` — it is used by the dynamic route.
- **Embedded sub-tools** (e.g. `WeightPriceCalculator` inside `BasicCalculator`) are NOT registered in `tools.config.ts`. They are imported directly by the host component and rendered as tabs. Do not add them to the registry.

### Routing
- Tool pages live at `/tools/[slug]` — the slug must match `tools.config.ts`.
- `generateStaticParams` pre-renders all known slugs at build time (`output: "standalone"`).

### CSP
- The project enforces a **nonce-based Content Security Policy** via `middleware.ts`.
- **Never use `eval`, `new Function`, or dynamic `<script>` injection** in any tool component.
- In production: `script-src 'nonce-...' 'strict-dynamic'` — no `unsafe-eval`, no `unsafe-inline` scripts.
- Tiptap v3 is CSP-safe (ProseMirror, no eval). Keep it that way when extending.
- → Full header table: [docs/ARCHITECTURE.md — Security model](ARCHITECTURE.md#security-model)

### Persistence
- All tools store state in **localStorage only** — no user accounts, no backend persistence.
- Storage keys follow the pattern `<toolname>-<data>` (e.g. `editorpad-notes`, `calc-history`).

### Layout
- Tool pages use `w-full` with fluid responsive padding — **no fixed max-width cap**.
- Padding scale: `px-4 sm:px-6 lg:px-10 xl:px-16 2xl:px-20`.
- Full-height tool panels use `h-[calc(100vh-360px)] min-h-[440px]` to prevent page scroll.

---

## Implementation discipline

- **Only change what is asked.** Do not refactor, add comments, or improve unrelated code.
- **No docstrings on unchanged functions.**
- **No new abstractions** for one-off operations.
- **No `eval` or `new Function`** anywhere, ever.
- Validate only at system boundaries (API routes, file uploads, user input).

---

## Adding a new tool

→ Full step-by-step guide with PR checklist: [docs/CONTRIBUTING.md — Adding a new tool](CONTRIBUTING.md#adding-a-new-tool)

Quick agent checklist:
1. Create `components/tools/<ToolName>.tsx` with `"use client"` at the top.
2. Add entry to `lib/tools.config.ts` `tools` array (lazy import).
3. Add a thumbnail to `public/thumbs/` (PNG, ~400×250px) and import it in `tools.config.ts`.
4. Add regression tests at `tests/tools/<tool-name>.test.tsx`.
5. Update `README.md` tools table, `testcase.md`, and `docs/ARCHITECTURE.md` tool registry table.
6. Run `pnpm test` and `pnpm build` — both must pass.

---

## Testing conventions

- Runner: **Vitest** + `@testing-library/react` + `jsdom`.
- Setup file: `tests/setup.ts` — mocks `next/image`, runs `cleanup` after each test.
- 13 test files, 84+ tests across all tools (39 for basic-calculator alone).
- Heavy DOM packages (ProseMirror/Tiptap, canvas, WebGL) **must be mocked** — jsdom does not support them.
- Mocks go at the top of the test file using `vi.mock(...)` before any imports of the component.
- Use `vi.stubGlobal("localStorage", ...)` for localStorage — do not rely on jsdom's built-in implementation for persistence tests.
- Fake timers (`vi.useFakeTimers()`) are required for debounce/auto-save tests; always call `vi.useRealTimers()` after.
- → Per-tool test cases: [testcase.md](../testcase.md)

---

## What agents must NOT do

| Action | Reason |
|---|---|
| Add server-side persistence (DB, sessions) | Project is intentionally stateless beyond localStorage |
| Introduce `eval` or `new Function` | Breaks CSP in production |
| Remove or weaken CSP headers in `middleware.ts` | Security regression |
| Push to `main` directly | Use PRs |
| Run `git push --force` or `git reset --hard` without confirmation | Destructive |
| Delete files without confirmation | Destructive |
| Add features beyond what was asked | Over-engineering |
