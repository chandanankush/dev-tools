import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import QrCodeGenerator from "@/components/tools/QrCodeGenerator";

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn(async () => "data:image/png;base64,AAA"),
  },
}));

describe("QrCodeGenerator", () => {
  it("generates a QR preview for text input", async () => {
    render(<QrCodeGenerator />);

    fireEvent.change(screen.getByLabelText("QR content"), { target: { value: "hello world" } });

    expect(await screen.findByAltText("Generated QR code")).toBeInTheDocument();
  });

  it("shows URL validation error in URL mode", async () => {
    render(<QrCodeGenerator />);

    fireEvent.click(screen.getByText("URL"));
    fireEvent.change(screen.getByLabelText("QR content"), { target: { value: "not-a-url" } });

    await waitFor(() => {
      expect(screen.getByText("Enter a valid absolute URL (including http/https)."))
        .toBeInTheDocument();
    });
  });
});
