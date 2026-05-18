# I built a dev toolkit for myself — here's what's in it

Every engineer has a set of tools they reach for constantly. JSON prettifier, Base64 decoder, JWT inspector, regex tester. For years I was jumping between random browser tabs, half of which had ads, slow load times, or asked me to sign up before I could use a textarea.

So I built my own: **mopplications.com**

It's a clean, fast, single-site toolkit with 13 utilities I actually use — no accounts, no tracking, no noise.

---

## What's in it

**JSON Tools** — prettify, validate, and explore payloads with a collapsible tree viewer. Useful when you're staring at a minified API response at 11pm.

**Compare Tools** — side-by-side diff for JSON payloads and cURL commands. Saves a lot of "wait, what changed?" moments during API debugging.

**JWT Generator** — craft HS256 tokens with custom payload fields directly in the browser. Good for local testing without spinning up a server.

**Regex Tester** — live match highlighting, flag toggles, named group support. I use this more than I expected to.

**Basic Calculator** — not just arithmetic. It has a GST quick-action button, a discount calculator, and a Weight Price tab (per kg/500g/100g/2kg, with rounding and reverse mode). The fintech work bleeds in.

**Editor Pad** — a browser-based notepad with multiple notes, WYSIWYG mode, find & replace, and file import/export. Useful when you want a scratch pad that isn't Google Docs.

The rest: Base64 encode/decode, Timestamp Converter, URL Encoder/Decoder, UUID Generator, Password Generator, QR Code Generator, Short URL Expander.

---

## How it's built

Next.js 15 App Router, TypeScript, Tailwind CSS, shadcn/ui. Fuzzy search with Fuse.js. Adding a new tool is one config entry in `lib/tools.config.ts` — the grid, search, and tag filtering wire up automatically.

Ships as a Docker container via a multi-stage build, deployed through a Jenkins pipeline. Nonce-based Content Security Policy enforced on every request. 84+ Vitest tests covering every tool.

I used agentic coding workflows throughout — explicit agent governance files, defined boundaries, mandatory build and test verification before changes land. It made solo development feel like working with a disciplined team rather than just vibing and hoping things work.

---

## Why I'm sharing this

I'm an Engineering Manager in fintech. Most of what I build professionally isn't something I can talk about publicly. This project is something I can show: a real stack, real tests, real deployment, and a working product people can actually use.

If you work with APIs, tokens, timestamps, or JSON regularly — try it. And if something's missing, the tool registry is designed to make additions straightforward.

👉 **mopplications.com**
📂 **github.com/chandanankush**

---

*Built by Chandan Singh — Engineering Manager at Paytm Payments Bank, working on fintech UI architecture, local LLM systems, and home lab infrastructure.*
