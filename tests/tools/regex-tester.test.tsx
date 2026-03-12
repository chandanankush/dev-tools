import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RegexTester from "@/components/tools/RegexTester";

describe("RegexTester", () => {
  it("shows match count when pattern matches", () => {
    render(<RegexTester />);

    fireEvent.change(screen.getByLabelText("Regular Expression"), {
      target: { value: "\\bfox\\b" },
    });

    expect(screen.getByText(/1 match/i)).toBeDefined();
  });

  it("shows 0 matches when pattern does not match", () => {
    render(<RegexTester />);

    fireEvent.change(screen.getByLabelText("Regular Expression"), {
      target: { value: "ZZZNOMATCH" },
    });

    expect(screen.getByText(/0 matches/i)).toBeDefined();
  });

  it("shows error for invalid regex pattern", () => {
    render(<RegexTester />);

    fireEvent.change(screen.getByLabelText("Regular Expression"), {
      target: { value: "[invalid" },
    });

    expect(screen.getByRole("paragraph", { hidden: true })?.textContent ?? screen.getByText(/invalid/i)).toBeDefined();
  });

  it("toggles the case-insensitive flag", () => {
    render(<RegexTester />);

    fireEvent.change(screen.getByLabelText("Test String"), {
      target: { value: "Hello World" },
    });
    fireEvent.change(screen.getByLabelText("Regular Expression"), {
      target: { value: "hello" },
    });

    // Without 'i' flag → 0 matches
    expect(screen.getByText(/0 matches/i)).toBeDefined();

    // Toggle 'i' flag on
    fireEvent.click(screen.getByTitle("Case insensitive"));

    expect(screen.getByText(/1 match/i)).toBeDefined();
  });
});
