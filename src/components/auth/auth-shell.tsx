import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import {
  AscendMark,
  AscendWordmark,
  BRAND_NAME,
} from "@/components/brand/ascend-logo";
import { cn } from "@/lib/utils";

/**
 * Chrome shared by every signed-out screen (login, signup, password
 * reset, invitation). From `lg` up it splits in two: the Ascend brand
 * panel on the left — dark in both modes — and the form on the page
 * surface to the right. Below `lg` the panel collapses to a logo bar
 * above the form. Works in both server and client components.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const t = useTranslations("AuthShell");
  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="sticky top-0 hidden h-dvh w-[44%] max-w-[680px] shrink-0 flex-col items-center justify-center bg-brand-panel px-12 text-brand-panel-foreground lg:flex dark:border-r dark:border-border">
        <div
          role="img"
          aria-label={BRAND_NAME}
          className="flex flex-col items-center"
        >
          <AscendMark animated className="w-36 xl:w-40" />
          <AscendWordmark className="mt-7 w-60 xl:w-[16.5rem]" />
        </div>
        <p className="mt-10 max-w-[30ch] text-center text-[15px] leading-relaxed text-balance text-brand-panel-muted">
          {t("tagline")}
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center px-5 sm:px-8 lg:hidden">
          <div
            role="img"
            aria-label={BRAND_NAME}
            className="flex items-center gap-2.5 text-foreground"
          >
            <AscendMark className="w-7" />
            <AscendWordmark className="w-[5.5rem]" />
          </div>
        </header>
        <main className="flex flex-1 items-start justify-center px-5 pt-[6vh] pb-16 sm:items-center sm:px-8 sm:pt-0 lg:px-12 lg:py-16">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * Title block + form + optional footer line. The one layout every
 * auth form uses so they read as a single flow.
 */
export function AuthCard({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full max-w-[380px]", className)}>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children}
      {footer ? (
        <div className="mt-8 border-t border-border pt-6 text-[13px] text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/** Inline form error shown at the top of an auth form. */
export function AuthError({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-[13px] text-destructive"
    >
      {children}
    </div>
  );
}
