# CLAUDE.md — Project rules for Claude Code

This file is read automatically on every session. All rules are mandatory.

---

## Project identity

- **Live site:** https://mopplications.com
- **Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS v4, Vitest 4
- **Middleware file:** `proxy.ts` (Next.js 16 convention — NOT `middleware.ts`)
- **Package manager:** pnpm — always use `pnpm`, never `npm install` or `yarn`
- **Visibility:** this is a **public** GitHub repository (`chandanankush/dev-tools`, MIT) — see the next section

---

## Public repository — mandatory

Everything pushed here is world-readable, indexed, cached and cloneable: code, docs, commit history, branches, PRs, issues, review comments and CI logs. Deleting something later does not un-publish it. Write and review every change as if a stranger — or a scraper — will read it.

**Never commit, paste, or mention (in code, docs, tests, fixtures, commit messages, PR/issue text, screenshots or logs):**
- Secrets of any kind — API keys, tokens, passwords, private keys, webhook URLs — including "test" or already-expired ones
- Private or internal infrastructure — hostnames, IPs, LAN names, VPN/wiki/ticket links, credential IDs, internal service ports
- Employer-confidential or customer information, and personal data about anyone
- Local machine details — absolute paths such as `/Users/<name>/…`, `.env*` files, `.claude/settings.local.json`, session transcripts, private tool or MCP output

Use placeholders instead: `example.com`, `<deploy-host>`, `user@your-host`, `YOUR_TOKEN`.

**Rules that follow from it:**
- **Author identity is permanent.** Check `git config user.email` before committing; use a personal or `@users.noreply.github.com` address, never an employer address.
- **Fork PRs run untrusted code in CI.** Keep workflows on `pull_request` (never `pull_request_target` that checks out PR code), keep secrets out of PR workflows, and keep `permissions` least-privilege.
- **Unpatched vulnerabilities are not reported publicly.** No public issue/PR describing an unfixed hole — use GitHub private vulnerability reporting (see `SECURITY.md`). A fix for an already-published advisory is fine.
- **Infra details belong in parameters, not literals.** New Jenkins/Docker/CI changes take hostnames, credential IDs and URLs as parameters or placeholders.
- **Agent-written text is public too.** Commit messages, PR descriptions and issue comments written by an agent follow the same rules; never include session paths, tokens or internal URLs.

**In code review** (human or agent), check the diff against this section in addition to the banned patterns below. For external contributions, read the whole diff — tests, `package.json`, the lockfile and `.github/` included — before approving a CI run or merging.

If you find a secret or private detail already committed: stop, tell the owner, rotate the credential first, then rewrite history only with the owner's approval.

---

## Branch workflow — mandatory

- **`main` is protected** — never commit directly to `main`.
- **`development` is permanent** — never delete it, locally or remotely. It is the long-lived integration branch.
- **`development` is the default working branch.** All day-to-day work, experiments, and incremental commits go here.
- At the start of every session, sync `development` with `main`:
  ```bash
  git checkout development && git pull origin main
  ```
- When a meaningful goal is complete (feature, bugfix, refactor), raise a PR from `development` → `main`. A "goal" is something coherent and shippable — not every commit, but not weeks of work either.
- Feature branches (e.g. `feat/xyz`) may be cut from `development` for isolated work, then merged back into `development` before the PR to `main`.
- Never raise a PR to `main` with failing tests or a broken build.

---

## Before every commit — mandatory checklist

Run these in order. Do not commit if any step fails.

```bash
pnpm test        # all tests must pass
pnpm build       # must succeed with zero type errors
pnpm lint        # must be clean
```

Then self-review the diff against every rule in the **Banned patterns** section below.

---

## Security rules — non-negotiable

These rules exist because AI agents previously introduced each of these vulnerabilities into this codebase. Every rule maps to a real bug that was found and fixed.

### 1. Cryptographic randomness — no modulo bias

**NEVER write this:**
```ts
crypto.getRandomValues(new Uint32Array(1))[0] % n   // ❌ modulo bias
Math.random()                                        // ❌ not cryptographic
```

**ALWAYS write this (rejection sampling):**
```ts
function unbiasedRandom(n: number): number {
  const limit = Math.floor(0x100000000 / n) * n;
  let v: number;
  do { v = crypto.getRandomValues(new Uint32Array(1))[0]; } while (v >= limit);
  return v % n;
}
```

Why: `2^32` is rarely divisible by `n`, so `% n` over-represents low values. Rejection sampling guarantees uniform distribution. This was a GitHub CodeQL `js/biased-cryptographic-random` finding.

---

### 2. Server-side fetch — SSRF prevention

**NEVER write this in any API route:**
```ts
await fetch(userSuppliedUrl)                          // ❌ SSRF
await fetch(url, { redirect: "follow" })              // ❌ redirect SSRF bypass
```

**ALWAYS validate before every fetch and every redirect hop:**
```ts
// 1. Protocol allowlist
if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error(...)

// 2. Private host blocklist
function isPrivateHost(hostname: string): boolean { ... }  // blocks RFC-1918, loopback, link-local

// 3. Manual redirect following — validate EVERY hop
const response = await fetch(validated.href, { redirect: "manual" })
if (response.status >= 300 && response.status < 400) {
  const location = response.headers.get("location")
  // validate location through isPrivateHost before following
}
```

Why: `redirect: "follow"` lets an attacker use a public URL that redirects to `169.254.169.254` (AWS metadata) or internal services. This bypasses any hostname check on the initial URL. This was a GitHub CodeQL `js/request-forgery` finding (CRITICAL).

Canonical implementation: `app/api/expand-url/route.ts` — copy `isPrivateHost` and `fetchWithValidatedRedirects` for any new server-side fetch.

---

### 3. CSP — no unsafe directives

**NEVER add these to the CSP in `proxy.ts`:**
```
'unsafe-inline'    // ❌ breaks XSS protection entirely
'unsafe-eval'      // ❌ only allowed in dev for HMR, never production
```

**Nonce pattern is already implemented.** Pass nonce through `x-nonce` header → read via `headers()` in layout → apply to `<script>` and `<style>` tags.

Style rule: use Tailwind classes or CSS modules. If dynamic styles are unavoidable, use `style={}` prop — Next.js does not require a nonce for inline `style` attributes (only `<style>` tags).

---

### 4. Docker — never run as root

**The runner stage MUST have:**
```dockerfile
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
# ... copy files ...
RUN chown -R appuser:appgroup /app
USER appuser          # ← mandatory, never remove
```

**The runner stage MUST patch the OS and ship no package manager:**
```dockerfile
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
```

Why: the standalone server runs on `node server.js` alone — npm/pnpm/corepack are build-time only. Shipping npm into the runtime adds its transitive CVEs (e.g. npm's bundled `undici`, a HIGH `js/uncontrolled-resource-consumption` finding) for zero runtime benefit, and "keep npm current" just inherits whatever npm's bundle carries. Removing the package managers eliminates that entire class of CVE at the source. The runner is `FROM node:26-alpine` (not `FROM base`) so corepack is never installed there. `apk upgrade` still patches OS packages.

Why non-root: a container running as root gives an attacker full host access if the app is compromised. This was a HIGH severity finding in the security assessment.

---

### 5. Input validation — API boundaries only

Validate at the edge (API routes, form submissions). Never validate internal function calls between modules you control.

Every API route must check:
- Request body is valid JSON and has expected shape
- String inputs are within expected length
- URLs: protocol allowlist + `isPrivateHost` (see rule 2)
- Array inputs have a maximum length cap

---

### 6. HTTP security headers — full set required

`proxy.ts` must always set ALL of these — never remove one:

| Header | Required value |
|--------|---------------|
| `Content-Security-Policy` | nonce-based, strict-dynamic, no unsafe-inline |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Embedder-Policy` | `require-corp` |
| `Cross-Origin-Resource-Policy` | `same-origin` |

If you need to change any header value, explain why in the PR description. If a tool breaks because of a header, fix the tool — do not weaken the header.

---

### 7. No secrets in code

- Never hardcode API keys, tokens, passwords, or credentials anywhere in source files.
- Environment variables for secrets only. All secret env vars go in `.env.local` (gitignored).
- If you see a string that looks like a secret in the diff, stop and flag it before committing.
- This repo is public: the same applies to internal hostnames, IPs, credential IDs and local paths — see **Public repository**.

---

### 8. Dependency security

For vulnerable transitive dependencies, use pnpm overrides in `package.json` rather than ignoring:
```json
"pnpm": {
  "overrides": {
    "vulnerable-package": "^safe-version"
  }
}
```

Scope an override to the installed major (`"undici@^7": "^7.29.1"`) — a bare `>=` can resolve to a newer major and break things. After overriding, confirm the lockfile resolves every package at or above its patched version.

When Dependabot opens a PR: check if it's a dev-only dependency (zero production risk) or a runtime dependency (must fix immediately). Dependabot PRs all edit `package.json` and `pnpm-lock.yaml`, so they conflict serially — batch compatible patch/minor bumps into one commit on `development` and let Dependabot close the superseded PRs.

After every push, check for open alerts. **Always pass `--paginate`** — the API returns 30 per page, and an unpaginated query silently hides the rest:
```bash
gh api repos/chandanankush/dev-tools/dependabot/alerts --paginate --jq '.[] | select(.state=="open") | {number, severity: .security_advisory.severity, package: .dependency.package.name, scope: .dependency.scope}'
gh api repos/chandanankush/dev-tools/code-scanning/alerts --paginate --jq '.[] | select(.state=="open") | {number, rule_id: .rule.id, severity: .rule.severity}'
```
Dependabot alerts track the default branch, so they close only after the fix merges to `main`.

---

### 9. No code drift — repo must match production

**Never leave security-relevant changes uncommitted.** If the live site has a security fix that isn't in the repo, a redeploy from source would regress it.

Rule: every change that affects headers, CSP, auth, or any security boundary must be committed and pushed **in the same session** it is made. Never "fix it locally and commit later".

This was a HIGH severity finding in the security assessment — the production middleware had correct headers but the GitHub repo still had `style-src 'unsafe-inline'` and was missing HSTS, COOP, COEP, CORP.

---

### 10. next.config.ts — suppress framework fingerprinting

`next.config.ts` must always contain:
```ts
poweredByHeader: false,
```

Without this, Next.js adds `X-Powered-By: Next.js` to every response, advertising the framework version to attackers. This was finding F8 (LOW) in the security assessment.

---

### 11. Docker images — scan for CVEs before deploying

After every `docker build`, run Docker Scout to check for new vulnerabilities:
```bash
docker scout cves dev-tools:local
```

For unfixable base-image CVEs (e.g. Alpine busybox with no upstream patch yet): document them as accepted risk and re-check after each rebuild. The `apk upgrade --no-cache` in the runner stage will automatically apply fixes when Alpine ships them.

The runner ships no package manager (see rule 4), so npm/pnpm/corepack transitive CVEs never reach the runtime image. Do not reintroduce `npm install -g npm@latest` to "fix" a bundled-package CVE — that reintroduces the whole npm dependency tree; the correct posture is to keep those tools out of the runtime entirely.

---

### 12. Privacy Policy — required for any public-facing site

Any publicly deployed web application that processes requests must have a `/privacy` page that discloses:
- What data is collected (even if the answer is "nothing beyond CDN logs")
- Whether any server-side processing occurs (e.g. the URL Expander sends URLs to the server)
- Which third-party services handle data (Cloudflare, etc.)

This site's privacy policy is at `app/privacy/page.tsx`. If new server-side data processing is added, update it in the same PR.

---

### 13. Deprecated headers — use modern equivalents

**Do not use `Report-To`** — it is deprecated.

Use `Reporting-Endpoints` instead:
```
Reporting-Endpoints: default="https://your-endpoint/reports"
```

Currently, the `Report-To` header on this site is set by Cloudflare's Network Error Logging (NEL) feature, not by application code. If ever adding a reporting endpoint in `proxy.ts`, use `Reporting-Endpoints`.

---

### 14. Inline styles and CSP

`style-src` in production CSP uses `'nonce-...'` — no `'unsafe-inline'`. This means:

- **`<style>` tags** need `nonce={nonce}` prop — get nonce from `headers()` in Server Components
- **`style={}` props on HTML elements** are fine — browser inline style attributes don't require a nonce
- **Third-party widgets** that inject `<style>` without a nonce will be blocked — this is intentional; find a CSP-compatible alternative

If a library requires `'unsafe-inline'` to function, do not add it to the CSP. Find a nonce-compatible version or replace the library.

---

## Banned patterns — quick reference

| Pattern | Why banned | Use instead |
|---------|-----------|-------------|
| `% n` on `crypto.getRandomValues()` | Modulo bias | `unbiasedRandom(n)` |
| `fetch(url, { redirect: "follow" })` with user input | SSRF via redirect | `fetchWithValidatedRedirects` |
| `fetch(userUrl)` without `isPrivateHost` check | SSRF | Validate protocol + host first |
| `'unsafe-inline'` in CSP | XSS | Nonce-based CSP |
| `'unsafe-eval'` in production CSP | XSS | Remove; fix the code that needs it |
| `USER root` or no `USER` in Dockerfile runner | Root container | `USER appuser` |
| `Math.random()` for security-sensitive values | Not cryptographic | `crypto.getRandomValues()` + rejection sampling |
| `eval()` or `new Function()` | XSS + CSP violation | Rewrite without eval |
| Inline `<script>` without nonce | CSP violation | Add `nonce={nonce}` prop |
| `style={{ ... }}` on `<style>` tags | CSP violation | Use Tailwind or add nonce |
| Hardcoded credentials or tokens | Secret exposure | `.env.local` |
| `StrictHostKeyChecking=no` in SSH | MITM attack | `ssh-keyscan` to known_hosts |
| `sshpass` with plaintext password | Credential exposure | SSH key via `sshUserPrivateKey` |
| Missing `poweredByHeader: false` in next.config.ts | Reveals framework to attackers | Add it — already present, never remove |
| Uncommitted security changes | Production/repo drift — HIGH severity | Commit every security fix in the same session |
| Deploying Docker image without CVE scan | Unknown vulnerabilities in production | `docker scout cves <image>` before deploy |
| `Report-To` header | Deprecated | Use `Reporting-Endpoints` |
| `<style>` tag without nonce | CSP violation / `unsafe-inline` needed | Pass `nonce={nonce}` prop to `<style>` |
| Library requiring `unsafe-inline` to work | Forces CSP weakening | Find nonce-compatible version or replace |
| Public site with no `/privacy` page | GDPR/legal exposure | Add `app/privacy/page.tsx` disclosing data practices |
| Internal hostnames/IPs, credential IDs, employer addresses or local paths in code, docs, commits or PR text | Repo is public and history is permanent | Placeholders (`<deploy-host>`, `example.com`); see **Public repository** |

---

## Code quality rules

- TypeScript strict mode — no `any`, no `as unknown as X` unless unavoidable
- No comments that describe WHAT the code does — only WHY (non-obvious invariants, workarounds)
- No features beyond what was explicitly asked
- No backwards-compatibility shims for things that have no existing callers
- Do not add error handling for impossible cases — trust TypeScript types

---

## Architecture constraints

- **No new server-side APIs** without explicit user request and SSRF review
- **All tool logic runs client-side** — no new server persistence, sessions, or databases
- **localStorage only** for persistence — no cookies, no IndexedDB unless asked
- **Single tool registry** — all tools in `lib/tools.config.ts`, nowhere else
- **Next.js 16 middleware** lives in `proxy.ts` — never create `middleware.ts`

---

## Commit format

```
feat(scope): short description
fix(scope): short description
docs: what changed
chore: what changed
```

Every commit must pass `pnpm test` and `pnpm build`. Never commit broken tests.
