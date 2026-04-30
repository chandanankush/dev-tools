import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";

import BasicCalculator from "@/components/tools/BasicCalculator";

// Build a proper in-memory localStorage mock (jsdom's may be incomplete)
function makeLocalStorage() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", makeLocalStorage());
});

function getInput(): HTMLInputElement {
  return screen.getByLabelText("Expression") as HTMLInputElement;
}

function clickButton(label: string) {
  fireEvent.click(screen.getByRole("button", { name: label }));
}

describe("BasicCalculator", () => {
  it("renders the expression input and key buttons", () => {
    render(<BasicCalculator />);
    expect(getInput()).toBeInTheDocument();
    // Spot-check a few buttons
    expect(screen.getByRole("button", { name: "7" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Equals" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Backspace" })).toBeInTheDocument();
  });

  it("clicking digit buttons appends to expression", () => {
    render(<BasicCalculator />);
    clickButton("3");
    clickButton("7");
    expect(getInput().value).toBe("37");
  });

  it("clicking operator buttons appends value", () => {
    render(<BasicCalculator />);
    clickButton("5");
    clickButton("+");
    clickButton("2");
    expect(getInput().value).toBe("5+2");
  });

  it("C button clears the expression", () => {
    render(<BasicCalculator />);
    clickButton("9");
    clickButton("Clear");
    expect(getInput().value).toBe("");
  });

  it("⌫ button deletes the last character", () => {
    render(<BasicCalculator />);
    clickButton("4");
    clickButton("2");
    clickButton("Backspace");
    expect(getInput().value).toBe("4");
  });

  it("evaluates 3 + 4 = 7", () => {
    render(<BasicCalculator />);
    clickButton("3");
    clickButton("+");
    clickButton("4");
    clickButton("Equals");
    expect(getInput().value).toBe("7");
  });

  it("evaluates 10 / 2 = 5", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "10/2" } });
    clickButton("Equals");
    expect(getInput().value).toBe("5");
  });

  it("evaluates (2 + 3) * 4 = 20", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "(2+3)*4" } });
    clickButton("Equals");
    expect(getInput().value).toBe("20");
  });

  it("shows an error for an empty expression", () => {
    render(<BasicCalculator />);
    clickButton("Equals");
    expect(screen.getByRole("alert")).toHaveTextContent(/empty/i);
  });

  it("shows an error for division by zero", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "1/0" } });
    clickButton("Equals");
    expect(screen.getByRole("alert")).toHaveTextContent(/undefined|division/i);
  });

  it("Enter key evaluates the expression", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "6*7" } });
    fireEvent.keyDown(getInput(), { key: "Enter" });
    expect(getInput().value).toBe("42");
  });

  it("typing non-allowed characters is blocked", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "2+a" } });
    // 'a' is not in ALLOWED_RE so value should remain unchanged (empty)
    expect(getInput().value).toBe("");
  });

  it("adds an entry to history after evaluation", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "8+2" } });
    clickButton("Equals");
    expect(screen.getByText("8+2")).toBeInTheDocument();
    expect(screen.getByText("= 10")).toBeInTheDocument();
  });

  it("clicking a history item loads the expression", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "5*5" } });
    clickButton("Equals");
    // After evaluation the input shows "25"; history shows "5*5"
    // Click the history button to reload
    fireEvent.click(screen.getByText("5*5").closest("button")!);
    expect(getInput().value).toBe("5*5");
  });

  it("saves history to localStorage after evaluation", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "3+3" } });
    clickButton("Equals");
    const stored = JSON.parse(localStorage.getItem("calc-history") ?? "[]") as Array<{
      expression: string;
      result: string;
    }>;
    expect(stored[0].expression).toBe("3+3");
    expect(stored[0].result).toBe("6");
  });

  it("loads history from localStorage on mount", () => {
    const item = { expression: "1+1", result: "2", timestamp: Date.now() };
    localStorage.setItem("calc-history", JSON.stringify([item]));
    render(<BasicCalculator />);
    expect(screen.getByText("1+1")).toBeInTheDocument();
  });

  // ─── Parentheses tests ───────────────────────────────────────────────────

  it("evaluates ((3+2)*2)-4 = 6", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "((3+2)*2)-4" } });
    clickButton("Equals");
    expect(getInput().value).toBe("6");
  });

  it("evaluates (10-4)/(2+1) = 2", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "(10-4)/(2+1)" } });
    clickButton("Equals");
    expect(getInput().value).toBe("2");
  });

  it("evaluates -(5+3) = -8", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "-(5+3)" } });
    clickButton("Equals");
    expect(getInput().value).toBe("-8");
  });

  it("evaluates 2*(3+(4*5)) = 46", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "2*(3+(4*5))" } });
    clickButton("Equals");
    expect(getInput().value).toBe("46");
  });

  it("shows error for mismatched parentheses", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "(2+3" } });
    clickButton("Equals");
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  // ─── Multiple operators / precedence tests ────────────────────────────────

  it("respects operator precedence: 2+3*4 = 14", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "2+3*4" } });
    clickButton("Equals");
    expect(getInput().value).toBe("14");
  });

  it("evaluates left-to-right addition/subtraction: 10-2+5 = 13", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "10-2+5" } });
    clickButton("Equals");
    expect(getInput().value).toBe("13");
  });

  it("evaluates 100/5-8 = 12", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "100/5-8" } });
    clickButton("Equals");
    expect(getInput().value).toBe("12");
  });

  it("evaluates 2*3+4*5 = 26", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "2*3+4*5" } });
    clickButton("Equals");
    expect(getInput().value).toBe("26");
  });

  it("evaluates chained subtraction: 20-5-3 = 12", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "20-5-3" } });
    clickButton("Equals");
    expect(getInput().value).toBe("12");
  });

  it("evaluates mixed with parentheses overriding precedence: (2+3)*4-1 = 19", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "(2+3)*4-1" } });
    clickButton("Equals");
    expect(getInput().value).toBe("19");
  });

  // ─── Percentage tests ────────────────────────────────────────────────────

  it("renders the % button", () => {
    render(<BasicCalculator />);
    expect(screen.getByRole("button", { name: "%" })).toBeInTheDocument();
  });

  it("clicking % button appends % to expression", () => {
    render(<BasicCalculator />);
    clickButton("5");
    clickButton("0");
    clickButton("%");
    expect(getInput().value).toBe("50%");
  });

  it("evaluates 50% = 0.5", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "50%" } });
    clickButton("Equals");
    expect(getInput().value).toBe("0.5");
  });

  it("evaluates 100% = 1", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "100%" } });
    clickButton("Equals");
    expect(getInput().value).toBe("1");
  });

  it("evaluates 25% = 0.25", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "25%" } });
    clickButton("Equals");
    expect(getInput().value).toBe("0.25");
  });

  it("evaluates 200+10% = 220 (10% of 200 is 20)", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "200+10%" } });
    clickButton("Equals");
    expect(getInput().value).toBe("220");
  });

  it("evaluates 100-50% = 50 (50% of 100 is 50)", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "100-50%" } });
    clickButton("Equals");
    expect(getInput().value).toBe("50");
  });

  it("evaluates 200*10% = 20", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "200*10%" } });
    clickButton("Equals");
    expect(getInput().value).toBe("20");
  });

  it("evaluates 50%*2 = 1", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "50%*2" } });
    clickButton("Equals");
    expect(getInput().value).toBe("1");
  });

  it("evaluates 1000-20% = 800 (20% of 1000 is 200)", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "1000-20%" } });
    clickButton("Equals");
    expect(getInput().value).toBe("800");
  });

  it("evaluates 500+5% = 525 (5% of 500 is 25)", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "500+5%" } });
    clickButton("Equals");
    expect(getInput().value).toBe("525");
  });

  it("shows error for bare % with no preceding number", () => {
    render(<BasicCalculator />);
    fireEvent.change(getInput(), { target: { value: "%" } });
    clickButton("Equals");
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
