import { render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VisitCounter } from "@/components/VisitCounter";

const KEY = "dt-visit-counted";

function makeLocalStorage(initial: Record<string, string> = {}) {
  let store = { ...initial };
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response);
}

let fetchMock: ReturnType<typeof vi.fn>;
let storage: ReturnType<typeof makeLocalStorage>;

beforeEach(() => {
  storage = makeLocalStorage();
  vi.stubGlobal("localStorage", storage);
  fetchMock = vi.fn(() => jsonResponse({ count: 1234 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const methods = () => fetchMock.mock.calls.map(([, init]) => (init as RequestInit).method);

describe("VisitCounter", () => {
  it("counts a first-time visitor with one POST and shows the number", async () => {
    render(<VisitCounter />);

    expect(await screen.findByText("Visitors: 1,234")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/visits", expect.objectContaining({ method: "POST", cache: "no-store" }));
    expect(storage.getItem(KEY)).toBe("1");
  });

  it("only reads the count on a return visit", async () => {
    vi.stubGlobal("localStorage", makeLocalStorage({ [KEY]: "1" }));
    render(<VisitCounter />);

    expect(await screen.findByText("Visitors: 1,234")).toBeInTheDocument();
    expect(methods()).toEqual(["GET"]);
  });

  it("never POSTs when localStorage is unavailable, so the count cannot be inflated", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    });
    render(<VisitCounter />);

    expect(await screen.findByText("Visitors: 1,234")).toBeInTheDocument();
    expect(methods()).toEqual(["GET"]);
  });

  it("counts once under React Strict Mode's double-invoked effect", async () => {
    render(
      <StrictMode>
        <VisitCounter />
      </StrictMode>,
    );

    expect(await screen.findByText("Visitors: 1,234")).toBeInTheDocument();
    expect(methods().filter((m) => m === "POST")).toHaveLength(1);
  });

  it("renders nothing and retries next visit when the POST fails", async () => {
    fetchMock.mockImplementation(() => jsonResponse({}, false, 500));
    const { container } = render(<VisitCounter />);

    await waitFor(() => expect(storage.removeItem).toHaveBeenCalledWith(KEY));
    expect(container).toBeEmptyDOMElement();
    expect(storage.getItem(KEY)).toBeNull();
  });

  it("renders nothing on a network error", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new TypeError("network down")));
    const { container } = render(<VisitCounter />);

    await waitFor(() => expect(storage.removeItem).toHaveBeenCalledWith(KEY));
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the 'counted' flag when only a read fails", async () => {
    vi.stubGlobal("localStorage", makeLocalStorage({ [KEY]: "1" }));
    fetchMock.mockImplementation(() => jsonResponse({}, false, 503));
    const { container } = render(<VisitCounter />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ["a string", { count: "12" }],
    ["missing", {}],
    ["null", { count: null }],
  ])("ignores a response whose count is %s", async (_label, body) => {
    fetchMock.mockImplementation(() => jsonResponse(body));
    const { container } = render(<VisitCounter />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("formats large numbers with thousands separators", async () => {
    fetchMock.mockImplementation(() => jsonResponse({ count: 1234567 }));
    render(<VisitCounter />);

    expect(await screen.findByText("Visitors: 1,234,567")).toBeInTheDocument();
  });

  it("announces updates politely to assistive tech", async () => {
    render(<VisitCounter />);

    expect(await screen.findByText("Visitors: 1,234")).toHaveAttribute("aria-live", "polite");
  });
});
