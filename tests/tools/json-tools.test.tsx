import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import JsonTools from "@/components/tools/JsonTools";

describe("JsonTools", () => {
  it("formats valid JSON", () => {
    render(<JsonTools />);

    const input = screen.getByPlaceholderText("Paste your JSON here...") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '{"a":1}' } });

    fireEvent.click(screen.getByTitle("Format JSON"));

    expect(input.value).toBe(`{
  "a": 1
}`);
  });

  it("clears content and errors", () => {
    render(<JsonTools />);

    const input = screen.getByPlaceholderText("Paste your JSON here...") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "{invalid" } });
    fireEvent.click(screen.getByTitle("Format JSON"));
    expect(screen.getByText(/Error:/)).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Clear"));

    expect(input.value).toBe("");
    expect(screen.queryByText(/Error:/)).not.toBeInTheDocument();
  });
});
