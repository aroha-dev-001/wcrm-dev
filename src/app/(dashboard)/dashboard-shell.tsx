"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CommandMenuProvider } from "@/components/layout/command-menu";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { AccountAccessAlert } from "@/components/layout/account-access-alert";
import { PresenceHeartbeat } from "@/components/presence/presence-heartbeat";
import { BrowserNotificationsListener } from "@/components/notifications/browser-notifications-listener";
import { Spinner } from "@/components/ui/spinner";
import { useTotalUnread } from "@/hooks/use-total-unread";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";

// Auth-gated dashboard shell. Extracted from the layout so the layout
// itself can stay a server component and export metadata (noindex) —
// client components can't export Next's metadata object.

const SIDEBAR_COLLAPSED_KEY = "wacrm:sidebar-collapsed";

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const t = useTranslations("DashboardShell");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
          <Spinner />
          {t("loading")}
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <AuthedShell>{children}</AuthedShell>;
}

/** Chrome for a signed-in user. Split out so the realtime counters only
 *  subscribe once a session exists — and exactly once per tab. */
function AuthedShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("DashboardShell");
  // Mobile drawer state. On lg+ the sidebar is always in the layout.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // Live counters shared by the sidebar and the mobile top bar. Each
  // hook owns a named realtime channel, so they must not be mounted twice.
  const unreadConversations = useTotalUnread();
  const unreadNotifications = useUnreadNotifications();

  // Desktop icon-only mode, remembered per device. Read lazily — this
  // component only mounts client-side, after auth resolves.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
    } catch {
      // localStorage can throw in private-browsing / sandboxed contexts.
      return false;
    }
  });
  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // Persistence is best-effort.
      }
      return next;
    });
  }, []);

  return (
    <ConfirmDialogProvider>
      <CommandMenuProvider>
        <div className="flex h-dvh overflow-hidden bg-background">
          {/* Reports this tab's online/away presence once we know a user is
              signed in. Headless — renders nothing. */}
          <PresenceHeartbeat />
          {/* Desktop alerts for new customer messages (opt-in via Settings →
              Your profile). Headless — renders nothing. */}
          <BrowserNotificationsListener />
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-popover focus:px-3 focus:py-2 focus:text-[13px] focus:shadow-popover"
          >
            {t("skipToContent")}
          </a>
          <Sidebar
            open={sidebarOpen}
            onClose={closeSidebar}
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
            unreadConversations={unreadConversations}
            unreadNotifications={unreadNotifications}
          />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <Header
              onOpenSidebar={() => setSidebarOpen(true)}
              unreadNotifications={unreadNotifications}
            />
            {/* Pages own their gutters (see components/layout/page.tsx) so
                full-bleed views need no negative-margin hacks. */}
            <main id="main-content" className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
              <AccountAccessAlert />
              {children}
            </main>
          </div>
        </div>
      </CommandMenuProvider>
    </ConfirmDialogProvider>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </AuthProvider>
  );
}
