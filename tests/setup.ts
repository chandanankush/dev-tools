import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { createElement } from "react";

vi.mock("next/image", () => ({
  default: ({ alt, src, priority, ...props }: { alt: string; src: string; priority?: boolean } & Record<string, unknown>) => {
    void priority;
    return createElement("img", { alt, src, ...props });
  },
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
