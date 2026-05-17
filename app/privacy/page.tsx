/**
 * Privacy Policy page — required for any public-facing site (see CLAUDE.md rule 12).
 *
 * Discloses data practices honestly: most tools are fully client-side and send
 * nothing to the server; the Short URL Expander is the one exception and is
 * called out explicitly.
 *
 * `LAST_UPDATED` is a string constant rather than a computed date so that the
 * "last updated" date only changes when the policy is intentionally revised —
 * not on every rebuild. Update it alongside any material policy change.
 *
 * The `Section` helper reduces repetition for the consistent heading + body
 * layout used across every policy section.
 */

import type { Metadata } from "next";
import Link from "next/link";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mopplications.com";

export const metadata: Metadata = {
  title: "Privacy Policy | Dev Toolkit",
  description: "Privacy policy for mopplications.com — what data is collected, how it is used, and your rights.",
  alternates: { canonical: `${baseUrl}/privacy` },
};

const LAST_UPDATED = "May 14, 2026";

export default function PrivacyPage() {
  return (
    <main className="w-full px-4 py-10 sm:px-6 sm:py-14 lg:px-10 xl:px-16 2xl:px-20">
      <div className="mx-auto max-w-2xl space-y-10">

        <header className="space-y-2">
          <p className="font-mono text-xs text-muted-foreground">mopplications.com</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        </header>

        <Section title="Overview">
          <p>
            Dev Toolkit (mopplications.com) is a collection of browser-based developer utilities.
            We are committed to collecting as little data as possible. Most tools run entirely in
            your browser — no data is sent to our servers.
          </p>
        </Section>

        <Section title="Data we do not collect">
          <ul className="list-disc space-y-1 pl-5">
            <li>We do not require an account or registration.</li>
            <li>We do not use cookies for tracking or analytics.</li>
            <li>We do not use third-party analytics services (e.g. Google Analytics).</li>
            <li>We do not sell, share, or monetise any data.</li>
          </ul>
        </Section>

        <Section title="Tool data handling">
          <p className="mb-3">
            All tools except the Short URL Expander operate entirely client-side. Input you type
            into the JSON formatter, UUID generator, password generator, and similar tools never
            leaves your browser.
          </p>
          <p>
            <strong>Short URL Expander:</strong> URLs you submit are sent to our server-side API
            solely to follow the redirect chain and return the final destination. They are not
            stored, logged, or used for any other purpose.
          </p>
        </Section>

        <Section title="Infrastructure and CDN">
          <p>
            The site is served through Cloudflare, which acts as a CDN and security layer.
            Cloudflare may log standard HTTP request metadata (IP address, user-agent, timestamp)
            for security and reliability purposes in accordance with{" "}
            <a
              href="https://www.cloudflare.com/privacypolicy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4 hover:opacity-80"
            >
              Cloudflare&apos;s Privacy Policy
            </a>
            . We do not have access to individual-level Cloudflare logs.
          </p>
        </Section>

        <Section title="Open source">
          <p>
            The full source code for this site is publicly available on{" "}
            <a
              href="https://github.com/chandanankush/dev-tools"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4 hover:opacity-80"
            >
              GitHub
            </a>
            . You can audit exactly what each tool does with your data.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If we make material changes to this policy, we will update the &ldquo;Last updated&rdquo; date
            above. Continued use of the site after changes constitutes acceptance of the revised policy.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions or concerns about this policy? Open an issue on{" "}
            <a
              href="https://github.com/chandanankush/dev-tools/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4 hover:opacity-80"
            >
              GitHub
            </a>
            .
          </p>
        </Section>

        <div className="border-t border-border/40 pt-6">
          <Link
            href="/"
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            &larr; Back to tools
          </Link>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
