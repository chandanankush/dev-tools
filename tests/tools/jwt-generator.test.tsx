import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import JwtGenerator from "@/components/tools/JwtGenerator";

vi.mock("@/lib/jwt", () => ({
  createHs256Token: vi.fn(async () => "aaa.bbb.ccc"),
  decodeJwt: vi.fn(() => ({
    header: { alg: "HS256", typ: "JWT" },
    payload: { clientId: "client-1" },
    signature: "ccc",
    hasSignature: true,
  })),
}));

describe("JwtGenerator", () => {
  it("generates token in encode mode", async () => {
    render(<JwtGenerator />);

    fireEvent.click(screen.getByRole("button", { name: "Generate JWT" }));

    expect(await screen.findByDisplayValue("aaa.bbb.ccc")).toBeInTheDocument();
  });

  it("shows validation on empty decode input", () => {
    render(<JwtGenerator />);

    fireEvent.click(screen.getByRole("button", { name: "Decode JWT" }));
    const submitButton = document.querySelector('button[type="submit"]') as HTMLButtonElement;
    fireEvent.click(submitButton);

    expect(screen.getByText("Paste a JWT to decode.")).toBeInTheDocument();
  });
});
