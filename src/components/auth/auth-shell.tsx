import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/**
 * Chrome shared by every signed-out screen (login, signup, password
 * reset, invitation): a quiet brand bar and a centred column. Works in
 * both server and client components.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const t = useTranslations("Sidebar");
  return (
    <div className="flex min-h-dvh flex-col bg-card-2">
      <header className="flex h-14 shrink-0 items-center gap-2 px-5 sm:px-8">
        <span className="flex size-6 items-center justify-center rounded-[6px] bg-foreground text-xs font-semibold text-background">
          {t("productName").charAt(0).toUpperCase()}
        </span>
        <span className="text-[13px] font-semibold text-foreground">
          {t("productName")}
        </span>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-[8vh] pb-16 sm:items-center sm:pt-0">
        {children}
      </main>
    </div>
  );
}

/**
 * Title block + bordered form card + optional footer line. The one
 * layout every auth form uses so they read as a single flow.
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
    <div className={cn("w-full max-w-[400px]", className)}>
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
        {children}
      </div>
      {footer ? (
        <div className="mt-5 text-center text-[13px] text-muted-foreground">
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
