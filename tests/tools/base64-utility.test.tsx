import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Base64Utility from "@/components/tools/Base64Utility";

describe("Base64Utility", () => {
  it("encodes plain text to base64", () => {
    render(<Base64Utility />);

    fireEvent.change(screen.getByLabelText("Plain text"), { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Encode" }));

    const output = screen.getByLabelText("Base64 output") as HTMLTextAreaElement;
    expect(output.value).toBe("aGVsbG8=");
  });

  it("decodes base64 to plain text", () => {
    render(<Base64Utility />);

    fireEvent.click(screen.getByRole("button", { name: "Decode Base64" }));
    fireEvent.change(screen.getByLabelText("Base64 input"), { target: { value: "aGVsbG8=" } });
    fireEvent.click(screen.getByRole("button", { name: "Decode" }));

    const output = screen.getByLabelText("Decoded text") as HTMLTextAreaElement;
    expect(output.value).toBe("hello");
  });
});
