/**
 * Single source of truth for the color-theme catalog.
 *
 * The CSS variables themselves live in `src/app/globals.css` under
 * `html[data-theme="..."]` blocks — that file is the one we paste
 * theme tokens into. This module only carries the metadata the UI
 * (settings picker, no-flash boot script) needs.
 *
 * Adding a new theme is a two-step change:
 *   1. Append the new `html[data-theme="<id>"]` block in globals.css
 *      with every token from an existing theme (use violet as the
 *      shape reference).
 *   2. Add an entry below. The order here drives the picker grid.
 */

export const THEME_IDS = [
  "violet",
  "emerald",
  "cobalt",
  "amber",
  "rose",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = "violet";

export const STORAGE_KEY = "wacrm.theme";

/**
 * MODE — the light/dark dimension, orthogonal to the accent theme.
 *
 * The CSS variables live in `src/app/globals.css` under
 * `html[data-mode="..."]` blocks (neutral surfaces only). Applied
 * at runtime via `document.documentElement.dataset.mode`.
 *
 * The user picks a *preference* — light, dark, or "system" (follow the
 * OS) — which resolves to one of the two concrete modes. Persisted
 * under its own localStorage key so it composes freely with the
 * accent choice. Stored values from before "system" existed ("light" /
 * "dark") remain valid preferences.
 */
export const MODES = ["light", "dark"] as const;

export type Mode = (typeof MODES)[number];

export const MODE_PREFERENCES = ["light", "dark", "system"] as const;

export type ModePreference = (typeof MODE_PREFERENCES)[number];

/** Server-rendered mode before the boot script resolves the real one. */
export const DEFAULT_MODE: Mode = "light";

export const DEFAULT_MODE_PREFERENCE: ModePreference = "system";

export const MODE_STORAGE_KEY = "wacrm.mode";

export function isMode(value: unknown): value is Mode {
  return (
    typeof value === "string" && (MODES as ReadonlyArray<string>).includes(value)
  );
}

export function isModePreference(value: unknown): value is ModePreference {
  return (
    typeof value === "string" &&
    (MODE_PREFERENCES as ReadonlyArray<string>).includes(value)
  );
}

/** Resolve a preference to the concrete mode for this device. */
export function resolveMode(pref: ModePreference): Mode {
  if (pref !== "system") return pref;
  if (typeof window === "undefined" || !window.matchMedia) return DEFAULT_MODE;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  tagline: string;
  /**
   * Static swatch color for the picker chip. Hard-coded so the boot
   * script / picker cards don't need a getComputedStyle round trip
   * before the page settles. Must mirror `--primary` of the same
   * theme in globals.css.
   */
  swatch: string;
}

export const THEMES: ReadonlyArray<ThemeMeta> = [
  {
    id: "violet",
    name: "Violet",
    tagline: "The default — a calm indigo-violet.",
    swatch: "oklch(0.52 0.18 283)",
  },
  {
    id: "emerald",
    name: "Emerald",
    tagline: "Growth-coded, nods at messaging without copying WhatsApp green.",
    swatch: "oklch(0.54 0.12 162)",
  },
  {
    id: "cobalt",
    name: "Cobalt",
    tagline: "Clean B2B-SaaS blue — calm and product-y.",
    swatch: "oklch(0.53 0.17 256)",
  },
  {
    id: "amber",
    name: "Amber",
    tagline: "Warm and friendly — feels good for SMB teams.",
    swatch: "oklch(0.62 0.15 58)",
  },
  {
    id: "rose",
    name: "Rose",
    tagline: "Bold and modern — D2C, creator-economy, lifestyle.",
    swatch: "oklch(0.57 0.19 14)",
  },
];

export function isThemeId(value: unknown): value is ThemeId {
  return (
    typeof value === "string" &&
    (THEME_IDS as ReadonlyArray<string>).includes(value)
  );
}
