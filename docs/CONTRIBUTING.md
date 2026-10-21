# Contributing to Dev Toolkit

Thanks for your interest in contributing. This guide covers everything you need to get from zero to a merged pull request.

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 26 |
| pnpm | 10+ |
| Docker | 24+ (optional, for deployment testing) |

---

## Local setup

```bash
git clone https://github.com/chandanankush/dev-tools.git
cd dev-tools
pnpm install
pnpm dev          # http://localhost:3000
```

---

## Project conventions

### Code style
- TypeScript strict mode — no `any`, no type assertions unless absolutely necessary.
- Tailwind utility classes only — no inline `style={}` except for dynamic values that cannot be expressed as classes.
- `"use client"` directive is required on every tool component (they all use React state/hooks).
- No `eval`, `new Function`, or dynamic `<script>` injection — the project enforces a strict CSP in production via `proxy.ts`.
- No `redirect: "follow"` with user-supplied URLs in server-side fetch — use the `fetchWithValidatedRedirects` pattern in `/api/expand-url`.
- For cryptographic randomness, use `unbiasedRandom(n)` (rejection sampling) — never `crypto.getRandomValues()[0] % n`.
- → Full CSP header table and security model: [docs/ARCHITECTURE.md — Security model](ARCHITECTURE.md#security-model)

### Commits
Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(editor-pad): add find & replace panel
fix(json-tools): correct height overflow on small screens
chore: bump tiptap to 3.23.0
docs: update ARCHITECTURE.md tool table
```

Types: `feat` · `fix` · `chore` · `docs` · `test` · `refactor` · `style` · `perf`

---

## Adding a new tool

### 1. Create the component

```
components/tools/<ToolName>.tsx
```

- Must start with `"use client"`.
- Must export a **default** component (the dynamic import in `tools.config.ts` uses `.default`).
- All state stored in `localStorage` — no API calls except the existing `/api/expand-url` pattern (and the footer `/api/visits` counter).
- Use components from `components/ui/` (Button, Input, Label, Textarea) for consistency.

### 2. Register in the tool registry

`lib/tools.config.ts` — add one entry to the `tools` array:

```ts
{
  slug: "my-tool",           // URL: /tools/my-tool
  title: "My Tool",
  description: "One-line description shown on the card and in meta tags.",
  tags: ["tag1", "tag2"],    // used for fuzzy search and tag filtering
  thumbnail: myThumbnail,    // import a PNG from public/thumbs/
  icon: "lucide-icon-name",  // any lucide-react icon name (kebab-case)
  component: () => import("@/components/tools/MyTool"),
},
```

The `toolSummaries` export is automatically sorted A–Z — no manual ordering needed.

### 3. Add a thumbnail

- Size: ~400×250px PNG.
- Place in `public/thumbs/<slug>.png`.
- Import at the top of `tools.config.ts` alongside the other thumbnails.

### 4. Write regression tests

```
tests/tools/<tool-name>.test.tsx
```

Cover at minimum:
- Component renders without crashing.
- Primary action (button click, input change) produces correct output.
- Error / empty states.
- localStorage persistence if the tool uses it.

See existing tests (e.g. `tests/tools/basic-calculator.test.tsx` — 39 tests covering arithmetic, parentheses, operator precedence, percentage, GST/discount) for patterns. Mock any heavy DOM packages (canvas, WebGL, ProseMirror) — jsdom does not support them.

### Embedding a tool inside another tool

If a feature logically belongs inside an existing tool (e.g. Weight Price Calculator inside Basic Calculator), do not register it in `tools.config.ts`. Instead:
1. Create the component file normally.
2. Import it directly into the host component.
3. Add a tab bar inside the host to switch between views.
4. Document the embedding in `docs/ARCHITECTURE.md` and `docs/AGENTS.md`.

→ Per-tool test cases and post-change checklist: [testcase.md](../testcase.md)

### 5. Update docs

- `README.md` — add a row to the Tools table (keep A–Z order).
- `testcase.md` — add a section with the new test cases.
- `docs/ARCHITECTURE.md` — add a row to the Tool Registry table.

---

## Running checks locally

```bash
pnpm test          # Vitest unit + component tests (must all pass)
pnpm build         # Next.js production build (must succeed with no type errors)
pnpm lint          # ESLint + Next.js rules
```

All three must be clean before opening a PR.

---

## This is a public repository

Everything you push or post here — code, docs, commit messages, PR and issue text, screenshots, CI logs — is world-readable and permanent, including on forks. So:

- Never include secrets (even test or expired ones), internal hostnames/IPs, credential IDs, employer-confidential or personal data, or local paths like `/Users/<name>/…`.
- Use placeholders: `example.com`, `<deploy-host>`, `YOUR_TOKEN`.
- Check `git config user.email` before committing — author emails stay in history. A personal or `@users.noreply.github.com` address is fine.
- Don't open a public issue or PR describing an unpatched vulnerability. Use [private vulnerability reporting](../SECURITY.md) instead.
- Reviewers read the whole diff — tests, `package.json`, the lockfile and `.github/` included — before approving a CI run on a first-time contributor's PR.

---

## Pull request checklist

- [ ] `pnpm test` passes (all tests green)
- [ ] `pnpm build` succeeds with no type errors
- [ ] `pnpm lint` is clean
- [ ] New tool has a test file with ≥ 3 meaningful test cases
- [ ] `README.md`, `testcase.md`, and `docs/ARCHITECTURE.md` updated
- [ ] No `eval`, `new Function`, or CSP-breaking patterns introduced
- [ ] No unnecessary dependencies added
- [ ] No secrets, internal hosts/IPs, credential IDs, personal data or local paths in the diff or PR text (this repo is public)

CI (`.github/workflows/ci.yml`) enforces type-check, lint, test, and build on every push/PR to `main` — a red check blocks merge.

---

## Branch strategy

```
main          ← always deployable, protected — never commit directly
development   ← permanent integration branch — default working branch
feat/<name>   ← new tool or feature, cut from development
fix/<name>    ← bug fix, cut from development
chore/<name>  ← dependency bumps, config, docs
```

Sync `development` with `main` at the start of a session:

```bash
git checkout development && git pull origin main
```

Day-to-day work happens on `development` (or a feature branch cut from it, merged back before the PR). When a coherent, shippable goal is complete, open a PR from `development` → `main`. Squash-merge preferred for feature and fix PRs. For `development` → `main`, a merge commit keeps the two branches in sync (a squash makes `development` look diverged and the next PR list every commit again). Never raise a PR to `main` with failing tests or a broken build.

---

## Questions and first contributions

Use [Discussions](https://github.com/chandanankush/dev-tools/discussions) for setup questions and use cases. Browse [good first issues](https://github.com/chandanankush/dev-tools/labels/good%20first%20issue) and [help wanted](https://github.com/chandanankush/dev-tools/labels/help%20wanted); comment before starting. Browser testing should use invented input and local instances.

## Reporting bugs

Open a GitHub issue with:
1. URL (`/tools/<slug>`)
2. Steps to reproduce
3. Expected vs actual behaviour
4. Browser + OS

Issues are public — don't paste secrets, private URLs or personal data. For a security vulnerability, don't open an issue; follow [`SECURITY.md`](../SECURITY.md).

---

## License

This project is released under the **[MIT License](../LICENSE)**.

Copyright © 2024–2026 [Chandan Singh](https://www.linkedin.com/in/chandan-singh-mobileengineer/).

You are free to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software. Attribution is appreciated but not required beyond keeping the copyright notice in the source.
