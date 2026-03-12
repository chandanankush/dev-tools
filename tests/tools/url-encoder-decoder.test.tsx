import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import UrlEncoderDecoder from "@/components/tools/UrlEncoderDecoder";

describe("UrlEncoderDecoder", () => {
  it("encodes plain text to a percent-encoded string", () => {
    render(<UrlEncoderDecoder />);

    fireEvent.change(screen.getByLabelText("Plain text / URL"), {
      target: { value: "hello world & more=stuff" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Encode" }));

    const output = screen.getByLabelText("Encoded output") as HTMLTextAreaElement;
    expect(output.value).toBe("hello%20world%20%26%20more%3Dstuff");
  });

  it("decodes a percent-encoded string to plain text", () => {
    render(<UrlEncoderDecoder />);

    fireEvent.click(screen.getByRole("button", { name: "Decode URL" }));
    fireEvent.change(screen.getByLabelText("Encoded URL / string"), {
      target: { value: "hello%20world%20%26%20more%3Dstuff" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Decode" }));

    const output = screen.getByLabelText("Decoded text") as HTMLTextAreaElement;
    expect(output.value).toBe("hello world & more=stuff");
  });

  it("shows an error for an invalid percent-encoded string", () => {
    render(<UrlEncoderDecoder />);

    fireEvent.click(screen.getByRole("button", { name: "Decode URL" }));
    fireEvent.change(screen.getByLabelText("Encoded URL / string"), {
      target: { value: "%GG" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Decode" }));

    expect(screen.getByText(/invalid percent-encoded/i)).toBeDefined();
  });
});
