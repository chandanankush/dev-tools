import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import UrlExpander from "@/components/tools/UrlExpander";

describe("UrlExpander", () => {
  it("shows validation when no URL is provided", async () => {
    render(<UrlExpander />);

    fireEvent.click(screen.getByRole("button", { name: "Expand URLs" }));

    expect(await screen.findByText("Enter at least one short URL.")).toBeInTheDocument();
  });

  it("renders expansion results from API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          results: [
            {
              shortUrl: "https://bit.ly/a",
              longUrl: "https://example.com/real",
              status: "success",
            },
          ],
        }),
      }))
    );

    render(<UrlExpander />);

    fireEvent.change(screen.getByLabelText("Short URLs"), { target: { value: "https://bit.ly/a" } });
    fireEvent.click(screen.getByRole("button", { name: "Expand URLs" }));

    expect(await screen.findByText("1 URL processed.")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/real")).toBeInTheDocument();
  });
});
