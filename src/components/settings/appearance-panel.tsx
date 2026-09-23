"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";

import { useTheme } from "@/hooks/use-theme";
import { MODE_PREFERENCES, THEMES, type ModePreference } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { SettingsPanelHead } from "./settings-panel-head";

/**
 * Appearance panel — light / dark / system mode + accent-color picker.
 *
 * Two independent controls. Either applies + persists immediately; no
 * save button: each change is a single attribute swap on <html>, there's
 * nothing to roll back.
 *
 * Persistence: localStorage only (device-scoped). The boot script in
 * layout.tsx replays both choices before first paint on subsequent
 * loads.
 */

const MODE_META: Record<
  ModePreference,
  { icon: typeof Sun; labelKey: string }
> = {
  light: { icon: Sun, labelKey: "modeLight" },
  dark: { icon: Moon, labelKey: "modeDark" },
  system: { icon: Monitor, labelKey: "modeSystem" },
};

export function AppearancePanel() {
  const { theme, setTheme, modePreference, setMode } = useTheme();
  const t = useTranslations("Settings.appearance");

  return (
    <section>
      <SettingsPanelHead title={t("title")} description={t("description")} />

      <div className="space-y-8">
        <div>
          <h3 className="text-[13px] font-medium text-foreground">{t("mode")}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("modeHint")}</p>
          <div
            role="radiogroup"
            aria-label={t("colorMode")}
            className="mt-3 grid max-w-lg grid-cols-3 gap-2"
          >
            {MODE_PREFERENCES.map((m) => (
              <ModeOption
                key={m}
                mode={m}
                isActive={m === modePreference}
                onPick={() => setMode(m)}
              />
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-[13px] font-medium text-foreground">
            {t("accentColor")}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("accentHint")}</p>
          <div
            role="radiogroup"
            aria-label={t("accentColor")}
            className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card"
          >
            {THEMES.map((tObj) => {
              const isActive = tObj.id === theme;
              return (
                <button
                  key={tObj.id}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  aria-label={t("useTheme", { name: tObj.name })}
                  onClick={() => setTheme(tObj.id)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none",
                  )}
                >
                  <span
                    aria-hidden
                    className="size-4 shrink-0 rounded-full"
                    style={{
                      background: tObj.swatch,
                      boxShadow: "inset 0 0 0 1px oklch(0 0 0 / 0.12)",
                    }}
                  />
                  <span className="w-20 shrink-0 text-[13px] font-medium text-foreground">
                    {tObj.name}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {tObj.tagline}
                  </span>
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full",
                      isActive ? "bg-foreground text-background" : "border border-border-strong",
                    )}
                  >
                    {isActive && <Check className="size-2.5" strokeWidth={3.5} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function ModeOption({
  mode,
  isActive,
  onPick,
}: {
  mode: ModePreference;
  isActive: boolean;
  onPick: () => void;
}) {
  const t = useTranslations("Settings.appearance");
  const meta = MODE_META[mode];
  const Icon = meta.icon;
  return (
    <button
      type="button"
      role="radio"
      onClick={onPick}
      aria-checked={isActive}
      className={cn(
        "flex cursor-pointer flex-col gap-2 rounded-lg border bg-card p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
        isActive
          ? "border-foreground/60 ring-1 ring-foreground/20"
          : "border-border hover:border-border-strong",
      )}
    >
      <ModePreview mode={mode} />
      <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
        <Icon className="size-3.5 text-muted-foreground" />
        {t(meta.labelKey)}
      </span>
    </button>
  );
}

/** A tiny, static sketch of the app chrome in each mode. */
function ModePreview({ mode }: { mode: ModePreference }) {
  const light = (
    <div className="flex h-full w-full bg-white">
      <div className="w-1/3 border-r border-zinc-200 bg-zinc-50 p-1">
        <div className="mb-1 h-1 w-3/4 rounded-full bg-zinc-300" />
        <div className="h-1 w-1/2 rounded-full bg-zinc-200" />
      </div>
      <div className="flex-1 p-1.5">
        <div className="mb-1 h-1.5 w-1/2 rounded-full bg-zinc-300" />
        <div className="h-1 w-3/4 rounded-full bg-zinc-200" />
      </div>
    </div>
  );
  const dark = (
    <div className="flex h-full w-full bg-zinc-900">
      <div className="w-1/3 border-r border-zinc-800 bg-zinc-950 p-1">
        <div className="mb-1 h-1 w-3/4 rounded-full bg-zinc-700" />
        <div className="h-1 w-1/2 rounded-full bg-zinc-800" />
      </div>
      <div className="flex-1 p-1.5">
        <div className="mb-1 h-1.5 w-1/2 rounded-full bg-zinc-700" />
        <div className="h-1 w-3/4 rounded-full bg-zinc-800" />
      </div>
    </div>
  );
  return (
    <div
      aria-hidden
      className="relative h-12 w-full overflow-hidden rounded-md border border-border"
    >
      {mode === "light" ? light : mode === "dark" ? dark : (
        <>
          {light}
          <div className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]">
            {dark}
          </div>
        </>
      )}
    </div>
  );
}
