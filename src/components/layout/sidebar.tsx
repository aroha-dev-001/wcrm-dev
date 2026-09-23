"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Check,
  ChevronsUpDown,
  KeyRound,
  LogOut,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  PlugZap,
  Search,
  Settings,
  Sun,
  User,
  UsersRound,
  X,
} from "lucide-react";

import { cn, initialOf } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import type { ModePreference } from "@/lib/themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { ROLE_META } from "@/components/settings/role-meta";
import { useCommandMenu } from "./command-menu";
import {
  NAV_GROUPS,
  SETTINGS_NAV_ITEM,
  isNavItemActive,
  type NavItem,
} from "./nav-config";

interface SidebarProps {
  /** Mobile drawer state, controlled by the shell. Ignored on lg+. */
  open?: boolean;
  onClose?: () => void;
  /** Desktop icon-only mode. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** Live counters, owned by the shell (one realtime subscription each). */
  unreadConversations?: number;
  unreadNotifications?: number;
}

const THEME_OPTIONS: { value: ModePreference; icon: typeof Sun; key: string }[] = [
  { value: "light", icon: Sun, key: "themeLight" },
  { value: "dark", icon: Moon, key: "themeDark" },
  { value: "system", icon: Monitor, key: "themeSystem" },
];

export function Sidebar({
  open = false,
  onClose,
  collapsed = false,
  onToggleCollapsed,
  unreadConversations: totalUnread = 0,
  unreadNotifications = 0,
}: SidebarProps) {
  const t = useTranslations("Sidebar");
  const tRoles = useTranslations("Settings.roles");
  const tSections = useTranslations("Settings.sections");
  const pathname = usePathname();
  const { profile, account, accountRole, signOut } = useAuth();
  const { modePreference, setMode } = useTheme();
  const { open: openCommandMenu } = useCommandMenu();

  // Collapsed styling only applies on desktop; the mobile drawer is
  // always full width.
  const c = collapsed;

  // Close the drawer when the route changes — users opened it to
  // navigate, so once they pick a destination it should get out of the way.
  useEffect(() => {
    onClose?.();
    // Only pathname drives this — onClose identity doesn't need to re-run it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Lock body scroll and allow Escape to close while the mobile drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const counterFor = (item: NavItem): number => {
    if (item.counter === "inbox") return totalUnread;
    if (item.counter === "notifications") return unreadNotifications;
    return 0;
  };

  const workspaceName = account?.name || t("productName");
  const displayName = profile?.full_name || profile?.email || t("defaultUser");
  const initial = initialOf(profile?.full_name || profile?.email, "U");
  const roleMeta = accountRole ? ROLE_META[accountRole] : null;

  return (
    <>
      {/* Mobile backdrop */}
      <button
        type="button"
        aria-label={t("closeMenu")}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-black/40 transition-opacity lg:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        aria-label={t("primaryNav")}
        data-collapsed={c ? "true" : undefined}
        className={cn(
          "group/sidebar fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
          "transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:z-0 lg:translate-x-0 lg:transition-[width] lg:duration-150",
          c ? "lg:w-[52px]" : "lg:w-60",
        )}
      >
        {/* Workspace row */}
        <div className={cn("flex h-12 shrink-0 items-center gap-1 px-2", c && "lg:justify-center lg:px-0")}>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t("workspaceMenu")}
              className={cn(
                "flex h-8 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-1.5 text-left outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring/40 data-popup-open:bg-sidebar-accent",
                c && "lg:w-8 lg:flex-none lg:justify-center lg:px-0",
              )}
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded-[5px] bg-foreground text-[11px] font-semibold text-background">
                {initialOf(workspaceName, "W")}
              </span>
              <span className={cn("truncate text-[13px] font-semibold text-foreground", c && "lg:hidden")}>
                {workspaceName}
              </span>
              <ChevronsUpDown className={cn("ml-auto size-3.5 shrink-0 text-muted-foreground", c && "lg:hidden")} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={4} className="w-60">
              <div className="flex items-center gap-2.5 px-2 py-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground text-xs font-semibold text-background">
                  {initialOf(workspaceName, "W")}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-foreground">{workspaceName}</p>
                  {roleMeta && accountRole ? (
                    <p className="text-xs text-muted-foreground">{tRoles(accountRole)}</p>
                  ) : null}
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/settings" />}>
                <Settings />
                {t("workspaceSettings")}
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/settings?tab=members" />}>
                <UsersRound />
                {t("teamMembers")}
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/settings?tab=whatsapp" />}>
                <PlugZap />
                {t("whatsappConnection")}
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/settings?tab=api" />}>
                <KeyRound />
                {tSections("api")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Collapse (desktop) / close (mobile) */}
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={c ? t("expand") : t("collapse")}
            title={c ? t("expand") : t("collapse")}
            className={cn(
              "hidden size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none lg:flex",
              c && "lg:hidden",
            )}
          >
            <PanelLeftClose className="size-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("closeMenu")}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground lg:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Search / command menu */}
        <div className={cn("px-2 pb-1", c && "lg:px-0 lg:flex lg:justify-center")}>
          <button
            type="button"
            onClick={openCommandMenu}
            title={t("search")}
            className={cn(
              "flex h-8 w-full cursor-pointer items-center gap-2 rounded-md border border-sidebar-border bg-background px-2 text-[13px] text-muted-foreground shadow-xs transition-colors hover:border-border-strong hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none dark:bg-sidebar-accent/60",
              c && "lg:size-8 lg:justify-center lg:px-0",
            )}
          >
            <Search className="size-3.5 shrink-0" />
            <span className={cn("flex-1 text-left", c && "lg:hidden")}>{t("search")}</span>
            <Kbd className={cn("hidden bg-transparent sm:inline-flex", c && "lg:hidden")}>⌘K</Kbd>
          </button>
        </div>

        {/* Navigation */}
        <nav className={cn("flex-1 overflow-y-auto px-2 pb-3", c && "lg:px-0")}>
          {NAV_GROUPS.map((group) => (
            <div key={group.id} className="pt-3 first:pt-2">
              {group.labelKey ? (
                <div
                  className={cn(
                    "px-2 pb-1 text-[11px] font-medium text-subtle-foreground",
                    c && "lg:hidden",
                  )}
                >
                  {t(group.labelKey)}
                </div>
              ) : null}
              {c && group.labelKey ? (
                <div className="mx-auto mb-2 hidden h-px w-6 bg-sidebar-border lg:block" />
              ) : null}
              <ul className="flex flex-col gap-px">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <NavLink
                      item={item}
                      label={t(item.labelKey)}
                      betaLabel={t("beta")}
                      active={isNavItemActive(pathname, item.href)}
                      count={counterFor(item)}
                      countLabel={
                        item.counter === "inbox"
                          ? t("unreadConversations", { count: totalUnread })
                          : item.counter === "notifications"
                            ? t("unreadNotifications", { count: unreadNotifications })
                            : undefined
                      }
                      collapsed={c}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer: settings + account */}
        <div className={cn("shrink-0 border-t border-sidebar-border px-2 py-2", c && "lg:px-0")}>
          <NavLink
            item={SETTINGS_NAV_ITEM}
            label={t(SETTINGS_NAV_ITEM.labelKey)}
            betaLabel={t("beta")}
            active={isNavItemActive(pathname, SETTINGS_NAV_ITEM.href)}
            count={0}
            collapsed={c}
          />
          {c ? (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={t("expand")}
              title={t("expand")}
              className="mx-auto mt-px hidden size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground lg:flex"
            >
              <PanelLeftOpen className="size-4" />
            </button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t("accountMenu")}
              className={cn(
                "mt-1 flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-md px-1.5 text-left outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring/40 data-popup-open:bg-sidebar-accent",
                c && "lg:mx-auto lg:size-9 lg:justify-center lg:px-0",
              )}
            >
              <Avatar className="size-7 shrink-0">
                {profile?.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? t("defaultAvatar")} />
                ) : null}
                <AvatarFallback className="bg-primary-soft text-primary">{initial}</AvatarFallback>
              </Avatar>
              <div className={cn("min-w-0 flex-1 leading-tight", c && "lg:hidden")}>
                <p className="truncate text-[13px] font-medium text-foreground">{displayName}</p>
                {profile?.email ? (
                  <p className="truncate text-[11px] text-muted-foreground">{profile.email}</p>
                ) : null}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" sideOffset={6} className="w-60">
              <DropdownMenuItem render={<Link href="/settings?tab=profile" />}>
                <User />
                {t("menuProfile")}
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/settings" />}>
                <Settings />
                {t("menuSettings")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t("theme")}</DropdownMenuLabel>
                {THEME_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const selected = modePreference === opt.value;
                  return (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => setMode(opt.value)}
                      aria-checked={selected}
                      role="menuitemradio"
                    >
                      <Icon />
                      {t(opt.key)}
                      {selected ? <Check className="ml-auto size-3.5 text-foreground!" /> : null}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <LogOut />
                {t("menuSignOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}

function NavLink({
  item,
  label,
  betaLabel,
  active,
  count,
  countLabel,
  collapsed,
}: {
  item: NavItem;
  label: string;
  betaLabel: string;
  active: boolean;
  count: number;
  countLabel?: string;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const showCount = count > 0;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "group/nav relative flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
        collapsed && "lg:mx-auto lg:size-8 lg:justify-center lg:px-0",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors",
          active ? "text-foreground" : "text-muted-foreground group-hover/nav:text-foreground",
        )}
      />
      <span className={cn("flex-1 truncate", collapsed && "lg:hidden")}>{label}</span>
      {item.beta ? (
        <span
          className={cn(
            "rounded-[4px] border border-border px-1 py-px text-[10px] leading-none font-medium text-muted-foreground",
            collapsed && "lg:hidden",
          )}
        >
          {betaLabel}
        </span>
      ) : null}
      {showCount ? (
        <span
          aria-label={countLabel}
          className={cn(
            "flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums",
            collapsed && "lg:absolute lg:-top-0.5 lg:-right-0.5 lg:h-3.5 lg:min-w-3.5 lg:px-0.5 lg:text-[9px]",
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
