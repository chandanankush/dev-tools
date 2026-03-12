import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import TimestampConverter from "@/components/tools/TimestampConverter";

describe("TimestampConverter", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(1700000000000);
  });
  afterEach(() => vi.restoreAllMocks());

  it("converts a unix timestamp in seconds to a date string", () => {
    render(<TimestampConverter />);
    const input = screen.getByLabelText(/Unix timestamp/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "1700000000" } });
    // Result panel should appear and contain the year 2023
    expect(screen.getByText(/2023/)).toBeDefined();
  });

  it("shows an error for a non-numeric timestamp", () => {
    render(<TimestampConverter />);
    const input = screen.getByLabelText(/Unix timestamp/i);
    fireEvent.change(input, { target: { value: "notanumber" } });
    expect(screen.getByText("Invalid timestamp")).toBeDefined();
  });

  it("converts a date string to a unix timestamp in seconds", () => {
    render(<TimestampConverter />);
    const input = screen.getByLabelText(/Date \/ datetime/i);
    fireEvent.change(input, { target: { value: "2023-11-14T22:13:20" } });
    // The result should be a numeric timestamp string
    const result = screen.getByText(/^\d{10}$/);
    expect(result).toBeDefined();
  });

  it("shows an error for an invalid date string", () => {
    render(<TimestampConverter />);
    const input = screen.getByLabelText(/Date \/ datetime/i);
    fireEvent.change(input, { target: { value: "not-a-date" } });
    expect(screen.getByText("Invalid date")).toBeDefined();
  });
});
