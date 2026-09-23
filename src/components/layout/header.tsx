"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Bell, Menu, Search } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useCommandMenu } from "./command-menu";

import { initialOf } from "@/lib/utils";
interface HeaderProps {
  /** Opens the sidebar drawer. */
  onOpenSidebar?: () => void;
  unreadNotifications?: number;
}

/**
 * Mobile-only top bar. On lg+ the sidebar carries navigation, search
 * and the account menu, and each page renders its own header — so this
 * bar only exists below the lg breakpoint.
 */
export function Header({ onOpenSidebar, unreadNotifications = 0 }: HeaderProps) {
  const t = useTranslations("Sidebar");
  const { account } = useAuth();
  const { open: openCommandMenu } = useCommandMenu();
  const unread = unreadNotifications;
  const workspaceName = account?.name || t("productName");

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b border-border bg-sidebar px-2 lg:hidden">
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label={t("openMenu")}
        className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Menu className="size-5" />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-[5px] bg-foreground text-[11px] font-semibold text-background">
          {initialOf(workspaceName, "W")}
        </span>
        <span className="truncate text-[13px] font-semibold text-foreground">
          {workspaceName}
        </span>
      </div>
      <button
        type="button"
        onClick={openCommandMenu}
        aria-label={t("search")}
        className="flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Search className="size-[18px]" />
      </button>
      <Link
        href="/notifications"
        aria-label={t("notifications")}
        className="relative flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Bell className="size-[18px]" />
        {unread > 0 ? (
          <span className="absolute top-2 right-2 size-2 rounded-full bg-primary ring-2 ring-sidebar" />
        ) : null}
      </Link>
    </header>
  );
}
