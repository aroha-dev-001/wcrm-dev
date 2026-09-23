"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_MODE,
  DEFAULT_MODE_PREFERENCE,
  DEFAULT_THEME,
  MODE_STORAGE_KEY,
  STORAGE_KEY,
  isMode,
  isModePreference,
  isThemeId,
  resolveMode,
  type Mode,
  type ModePreference,
  type ThemeId,
} from "@/lib/themes";

/**
 * ThemeProvider — wraps the whole app, owns the two theming axes:
 *   • `theme` — the accent color (`data-theme` on <html>)
 *   • `mode`  — light / dark (`data-mode` on <html>), resolved from the
 *     user's `modePreference` (light / dark / system).
 * The two are independent, so any accent renders in either mode.
 *
 * The boot script in `src/app/layout.tsx` has already applied both
 * `data-theme` and `data-mode` before React hydrates, so by the time
 * this Provider mounts the page is already painted correctly. We just
 * read what's there and keep it in sync going forward — including
 * following OS appearance changes while the preference is "system".
 *
 * Persistence is localStorage only (device-scoped).
 */

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (next: ThemeId) => void;
  /** The concrete mode currently applied. */
  mode: Mode;
  /** What the user picked — may be "system". */
  modePreference: ModePreference;
  /** Pin a concrete mode or follow the OS with "system". */
  setMode: (next: ModePreference) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const fromAttr = document.documentElement.dataset.theme;
  if (isThemeId(fromAttr)) return fromAttr;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isThemeId(stored)) return stored;
  } catch {
    // localStorage can throw in private-browsing / sandboxed contexts.
  }
  return DEFAULT_THEME;
}

function readInitialPreference(): ModePreference {
  if (typeof window === "undefined") return DEFAULT_MODE_PREFERENCE;
  try {
    const stored = localStorage.getItem(MODE_STORAGE_KEY);
    if (isModePreference(stored)) return stored;
  } catch {
    // localStorage can throw in private-browsing / sandboxed contexts.
  }
  return DEFAULT_MODE_PREFERENCE;
}

function readInitialMode(): Mode {
  if (typeof window === "undefined") return DEFAULT_MODE;
  const fromAttr = document.documentElement.dataset.mode;
  if (isMode(fromAttr)) return fromAttr;
  return resolveMode(readInitialPreference());
}

function applyMode(mode: Mode) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.mode = mode;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(readInitialTheme);
  const [modePreference, setPreferenceState] =
    useState<ModePreference>(readInitialPreference);
  const [mode, setModeState] = useState<Mode>(readInitialMode);

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = next;
    }
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Same private-browsing edge case as above; the in-memory state
      // still updates so the current tab works for the session.
    }
  }, []);

  const setMode = useCallback((next: ModePreference) => {
    const resolved = resolveMode(next);
    setPreferenceState(next);
    setModeState(resolved);
    applyMode(resolved);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // Same private-browsing edge case as above.
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  // Follow the OS appearance while the preference is "system".
  useEffect(() => {
    if (modePreference !== "system" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next: Mode = mql.matches ? "dark" : "light";
      setModeState(next);
      applyMode(next);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [modePreference]);

  // Sync from other tabs — change theme or mode in tab A, tab B
  // catches up without a refresh.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        if (isThemeId(e.newValue) && e.newValue !== theme) {
          setThemeState(e.newValue);
          document.documentElement.dataset.theme = e.newValue;
        }
        return;
      }
      if (e.key === MODE_STORAGE_KEY) {
        if (isModePreference(e.newValue) && e.newValue !== modePreference) {
          const resolved = resolveMode(e.newValue);
          setPreferenceState(e.newValue);
          setModeState(resolved);
          applyMode(resolved);
        }
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [theme, modePreference]);

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, mode, modePreference, setMode, toggleMode }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback for components rendered outside the provider — return
    // no-op setters so callers don't crash. The boot script still
    // applied the right CSS attributes, so visually the page is fine.
    return {
      theme: DEFAULT_THEME,
      setTheme: () => {},
      mode: DEFAULT_MODE,
      modePreference: DEFAULT_MODE_PREFERENCE,
      setMode: () => {},
      toggleMode: () => {},
    };
  }
  return ctx;
}
