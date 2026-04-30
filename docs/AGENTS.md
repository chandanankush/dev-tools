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

## Session learnings — enforced guidelines

These guidelines were derived from real mistakes and discoveries during active development. Every agent must follow them.

---

### 1. Run tests after every change

Run `pnpm test` after **every** code change, no matter how small.

- A layout or UI change (e.g. adding a mobile header) can introduce duplicate DOM elements that break existing `getByText` / `getByTitle` queries.
- Tests must stay at the existing count and all must pass before committing.
- If tests fail, fix them in the same commit — never commit broken tests.

---

### 2. Fix test gaps when you touch a component

When editing a component that has low or missing test coverage, add regression tests for the new behaviour.

**Anti-pattern caught:** The original `BasicCalculator` had only 14 tests. After adding `%`, GST, Discount, and Weight Price features, the suite grew to 39 tests. All new behaviour was tested.

Rule: every new feature or interaction path needs at least one test.

---

### 3. WCAG AA contrast — design token discipline

All text colours must meet **WCAG AA minimum** (4.5:1 for normal text, 3:1 for large/UI text).

- **Root cause identified:** `--muted-foreground` was set to `215 20% 65%` (only 3.2:1 on white). Fixed to `42%` lightness (~5.5:1).
- **Never double-dim** muted text with opacity — e.g. `text-muted-foreground/40` on a surface that is already `bg-muted/30` compounds to unreadable contrast.
- Avoid `text-[10px]` — use `text-[11px]` minimum for readable small labels.
- After any design-token or Tailwind class change, audit affected components for contrast regressions.
- Preferred check: browser DevTools → Accessibility → Contrast ratio, or axe DevTools.

---

### 4. Mobile-first layout discipline

Every component must be usable on a 375px-wide mobile screen.

- **Fixed-width sidebars** (`w-52`, `w-64`) must collapse on mobile — use a hamburger toggle.
- Fixed-width inputs inside panels (e.g. `w-36` in Find & Replace) must use `w-full sm:w-36`.
- Use `100dvh` instead of `100vh` — mobile browser chrome eats into `100vh`.
- Minimum tap target size: 44×44px. Use `h-9 w-9` / `p-2` as a floor for icon buttons.
- Test layout at 375px, 768px, and 1280px breakpoints.

---

### 5. Commit granularity and sequencing

Follow this sequence for every change:

1. Make the code change.
2. Run `pnpm test` — all tests must pass.
3. Run `pnpm build` for non-trivial changes (routing, config, new imports).
4. Commit with a descriptive message using the conventional commit prefix (`feat:`, `fix:`, `docs:`, `chore:`).
5. Push only after commit succeeds and tests are green.

**Never batch unrelated changes into one commit.** Feature changes, documentation updates, and chore/fix items each get their own commit.

---

### 6. Update documentation after every feature

When a feature or behavioural change lands, update **all** relevant docs in the same session:

| File | Update when |
|---|---|
| `README.md` | Tool list, test count, feature description |
| `docs/ARCHITECTURE.md` | New files, directory structure, component graph |
| `docs/CONTRIBUTING.md` | New patterns (e.g. embedded sub-tools, new conventions) |
| `docs/AGENTS.md` | New rules, learnings, anti-patterns |
| `testcase.md` | New test cases, updated section counts |

Documentation commits use the `docs:` prefix.

---

### 7. Embedded sub-tools (tab pattern)

When a tool is logically a sub-section of another (e.g. Weight Price inside Basic Calculator):

- Do **not** register it in `lib/tools.config.ts`.
- Import it directly inside the host component and render it as a tab.
- Give the tab bar the `bg-muted p-1.5` container / `bg-background shadow` active / `text-foreground/60` inactive treatment for consistent contrast.
- Document the host relationship in `docs/CONTRIBUTING.md` and note it in `docs/AGENTS.md`.

---

### 8. Dev server port

The Next.js dev server does not support `--` flag forwarding with pnpm.

```bash
# ✅ correct
PORT=3001 pnpm run dev

# ❌ fails
pnpm run dev -- -p 3001
```

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
| Commit without running `pnpm test` first | May introduce silent regressions |
| Use `100vh` for full-height panels | Breaks on mobile — use `100dvh` |
| Use `text-muted-foreground` with opacity modifiers | Compounds contrast failures |
