import { describe, it, expect } from "vitest";
import { buildToolJsonLd, serializeJsonLd } from "@/lib/seo";
import type { ToolMeta } from "@/lib/tools.config";

const mockTool: Pick<ToolMeta, "title" | "description"> = {
  title: "UUID Generator",
  description: "Generate RFC 4122 compliant UUIDs on demand.",
};

const canonicalUrl = "https://mopplications.com/tools/uuid-generator";

describe("buildToolJsonLd", () => {
  it("returns a SoftwareApplication schema object", () => {
    const ld = buildToolJsonLd(mockTool, canonicalUrl);
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("SoftwareApplication");
  });

  it("sets applicationCategory to DeveloperApplication", () => {
    const ld = buildToolJsonLd(mockTool, canonicalUrl);
    expect(ld.applicationCategory).toBe("DeveloperApplication");
  });

  it("sets operatingSystem to Web", () => {
    const ld = buildToolJsonLd(mockTool, canonicalUrl);
    expect(ld.operatingSystem).toBe("Web");
  });

  it("includes a free Offer", () => {
    const ld = buildToolJsonLd(mockTool, canonicalUrl);
    expect(ld.offers).toEqual({ "@type": "Offer", price: "0", priceCurrency: "USD" });
  });

  it("uses tool name, description, and canonical url", () => {
    const ld = buildToolJsonLd(mockTool, canonicalUrl);
    expect(ld.name).toBe("UUID Generator");
    expect(ld.description).toBe("Generate RFC 4122 compliant UUIDs on demand.");
    expect(ld.url).toBe(canonicalUrl);
  });
});

describe("serializeJsonLd", () => {
  it("escapes < to prevent </script> injection", () => {
    const result = serializeJsonLd({ description: "</script><script>alert(1)" });
    expect(result).not.toContain("</script>");
    expect(result).toContain("\\u003c");
  });

  it("produces valid JSON after escaping", () => {
    const obj = { name: "test", url: "https://example.com" };
    const result = serializeJsonLd(obj);
    expect(() => JSON.parse(result)).not.toThrow();
  });
});
