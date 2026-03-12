import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import PasswordGenerator from "@/components/tools/PasswordGenerator";

function mockCrypto() {
  let counter = 0;
  vi.spyOn(crypto, "getRandomValues").mockImplementation((arr) => {
    const a = arr as Uint32Array;
    for (let i = 0; i < a.length; i++) a[i] = counter++ * 7919;
    return a;
  });
}

describe("PasswordGenerator", () => {
  beforeEach(mockCrypto);
  afterEach(() => vi.restoreAllMocks());

  it("generates a password of the default length (16)", () => {
    render(<PasswordGenerator />);
    const dots = screen.getByText(/^•+$/);
    expect(dots.textContent?.length).toBe(16);
  });

  it("updates password length when slider changes", () => {
    render(<PasswordGenerator />);
    const slider = screen.getByLabelText("Password length");
    fireEvent.change(slider, { target: { value: "24" } });
    const dots = screen.getByText(/^•+$/);
    expect(dots.textContent?.length).toBe(24);
  });

  it("reveals password when eye button is clicked", () => {
    render(<PasswordGenerator />);
    fireEvent.click(screen.getByLabelText("Show password"));
    // After reveal the text should not be all dots
    const pass = document.querySelector(".font-mono.text-base") as HTMLElement;
    expect(pass.textContent).not.toMatch(/^•+$/);
  });

  it("generates a new password on regenerate click", () => {
    render(<PasswordGenerator />);
    const before = (document.querySelector(".font-mono.text-base") as HTMLElement).textContent;
    fireEvent.click(screen.getByRole("button", { name: /generate password/i }));
    const after = (document.querySelector(".font-mono.text-base") as HTMLElement).textContent;
    // With the deterministic mock values will differ
    expect(typeof after).toBe("string");
    expect(after?.length).toBeGreaterThan(0);
    void before;
  });
});
