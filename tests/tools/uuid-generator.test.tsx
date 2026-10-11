import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import UuidGenerator from "@/components/tools/UuidGenerator";
import * as clipboardModule from "@/lib/clipboard";

describe("UuidGenerator", () => {
  it("generates the requested number of UUIDs", () => {
    const randomUuid = vi
      .spyOn(crypto, "randomUUID")
      .mockImplementation(
        () => `00000000-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`,
      );

    render(<UuidGenerator />);

    const amount = screen.getByLabelText("Count");
    fireEvent.change(amount, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate UUIDs" }));

    const output = screen.getByLabelText("Generated UUIDs") as HTMLTextAreaElement;
    const lines = output.value.split("\n").filter(Boolean);

    expect(lines).toHaveLength(3);
    randomUuid.mockRestore();
  });

  it("renders the Copy all button", () => {
    render(<UuidGenerator />);

    const copyButton = screen.getByRole("button", { name: "Copy all" });
    expect(copyButton).toBeInTheDocument();
    // In this component, 5 UUIDs are generated on mount, so output is non-empty and button is enabled.
    expect(copyButton).toBeEnabled();
  });

  it("calls clipboard utility with all generated UUIDs joined by newlines and shows success feedback", async () => {
    const copySpy = vi.spyOn(clipboardModule, "copyToClipboard").mockResolvedValue(undefined);

    render(<UuidGenerator />);

    const copyButton = screen.getByRole("button", { name: "Copy all" });
    const output = screen.getByLabelText("Generated UUIDs") as HTMLTextAreaElement;

    await act(async () => {
      fireEvent.click(copyButton);
    });

    expect(copySpy).toHaveBeenCalledWith(output.value);
    expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument();
  });

  it("copies to clipboard using navigator.clipboard when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(<UuidGenerator />);

    const output = screen.getByLabelText("Generated UUIDs") as HTMLTextAreaElement;

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy all" }));
    });

    expect(writeText).toHaveBeenCalledWith(output.value);
  });

  it("displays an error message and preserves UUIDs when copying fails", async () => {
    vi.spyOn(clipboardModule, "copyToClipboard").mockRejectedValue(
      new Error("Clipboard permission denied"),
    );

    render(<UuidGenerator />);

    const output = screen.getByLabelText("Generated UUIDs") as HTMLTextAreaElement;
    const initialUuids = output.value;

    const copyButton = screen.getByRole("button", { name: "Copy all" });

    await act(async () => {
      fireEvent.click(copyButton);
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Clipboard permission denied");
    expect(output.value).toBe(initialUuids);
    expect(screen.getByRole("button", { name: "Copy all" })).toBeInTheDocument();
  });

  it("resets copied state when UUIDs are regenerated", async () => {
    vi.spyOn(clipboardModule, "copyToClipboard").mockResolvedValue(undefined);

    render(<UuidGenerator />);

    const copyButton = screen.getByRole("button", { name: "Copy all" });

    await act(async () => {
      fireEvent.click(copyButton);
    });

    expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Generate UUIDs" }));

    expect(screen.getByRole("button", { name: "Copy all" })).toBeInTheDocument();
  });

  it("clears error message when UUIDs are regenerated", async () => {
    vi.spyOn(clipboardModule, "copyToClipboard").mockRejectedValue(
      new Error("Clipboard permission denied"),
    );

    render(<UuidGenerator />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy all" }));
    });

    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Generate UUIDs" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
