import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import UuidGenerator from "@/components/tools/UuidGenerator";

describe("UuidGenerator", () => {
  it("generates the requested number of UUIDs", () => {
    const randomUuid = vi
      .spyOn(crypto, "randomUUID")
      .mockImplementation(() => `00000000-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`);

    render(<UuidGenerator />);

    const amount = screen.getByLabelText("Count");
    fireEvent.change(amount, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate UUIDs" }));

    const output = screen.getByLabelText("Generated UUIDs") as HTMLTextAreaElement;
    const lines = output.value.split("\n").filter(Boolean);

    expect(lines).toHaveLength(3);
    randomUuid.mockRestore();
  });
});
