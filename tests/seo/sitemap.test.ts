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
