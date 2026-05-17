/**
 * ThemeProvider — app-level light/dark theme context.
 *
 * Design decisions:
 * - The theme is stored in localStorage ("theme") so it persists across page
 *   reloads without a server round-trip. The first effect reads it on mount;
 *   the second effect writes it whenever the theme changes.
 * - System preference (`prefers-color-scheme`) is used as the default when no
 *   stored value exists, giving first-time visitors the expected appearance.
 * - The `.dark` class is toggled on `document.documentElement` (the <html>
 *   element) rather than a wrapper div so Tailwind's `dark:` variants work
 *   anywhere in the tree, including portals that render outside the React root.
 * - State is initialised to "light" on the server (SSR) to avoid a hydration
 *   mismatch; the first useEffect corrects it client-side after mount.
 *
 * useTheme is co-located here so consumers import from a single module.
 */

"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  // On mount: read stored preference or fall back to system preference
  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    const resolved =
      stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setThemeState(resolved);
  }, []);

  // Apply/remove .dark class + persist whenever theme changes
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
