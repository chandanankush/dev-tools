# Security Policy

## Reporting a vulnerability

Please **do not open a public issue or pull request** for an unpatched vulnerability — this is a public repository, so anything posted is visible to everyone immediately.

Report it privately through GitHub: **[Report a vulnerability](https://github.com/chandanankush/dev-tools/security/advisories/new)** (Security tab → *Report a vulnerability*). Include the affected URL or file, steps to reproduce, and the impact you expect.

You can expect an acknowledgement, and a fix or an explanation, as soon as the maintainer can review it. This is a personal open-source project, so there is no guaranteed response time.

## Scope

- The hosted site and the code in this repository (`app/`, `components/`, `lib/`, `proxy.ts`, `Dockerfile`, CI workflows).
- Most tools run entirely in the browser. The only server-side route is `/api/expand-url`; see `/privacy` for what it processes.

## Supported versions

Only the latest `main` is supported.

## Handling secrets

If you notice a credential, token or internal hostname committed anywhere in this repository or its history, report it through the same private channel rather than posting it publicly.
