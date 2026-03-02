import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CompareTools from "@/components/tools/CompareTools";

describe("CompareTools", () => {
  it("compares JSON and shows differences", () => {
    render(<CompareTools />);

    fireEvent.click(screen.getByRole("button", { name: "Compare" }));

    expect(screen.getByText("3 differences")).toBeInTheDocument();
  });

  it("clears JSON inputs", () => {
    render(<CompareTools />);

    const [left, right] = screen.getAllByRole("textbox") as HTMLTextAreaElement[];
    expect(left.value.length).toBeGreaterThan(0);
    expect(right.value.length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(left.value).toBe("");
    expect(right.value).toBe("");
  });
});
