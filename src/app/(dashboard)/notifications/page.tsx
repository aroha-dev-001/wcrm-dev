"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Notification } from "@/types";
import { Bell, CheckCheck, Loader2, UserPlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Page, PageBody, PageHeader } from "@/components/layout/page";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

// Icon per notification type. Only one type exists today
// (conversation_assigned) but this keeps future types a one-line add.
const TYPE_ICON: Record<Notification["type"], typeof Bell> = {
  conversation_assigned: UserPlus,
};

export default function NotificationsPage() {
  const t = useTranslations("Notifications");
  const router = useRouter();
  const { accountId } = useAuth();
  const [notifications, setNotifications] = useState<Notification[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const load = useCallback(async () => {
    if (!accountId) return;
    const supabase = createClient();
    const { data, error: fetchErr } = await supabase
      .from("notifications")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (fetchErr) {
      setError(fetchErr.message);
      return;
    }
    setNotifications((data ?? []) as Notification[]);
  }, [accountId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Realtime — new assignments appear without a refresh, and a
  // "mark all read" fired from another tab/device stays in sync here.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("notifications-page")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as Notification;
            setNotifications((prev) => {
              if (!prev) return [row];
              if (prev.some((n) => n.id === row.id)) return prev;
              return [row, ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as Notification;
            setNotifications((prev) =>
              prev?.map((n) => (n.id === row.id ? { ...n, ...row } : n)) ??
              prev,
            );
          } else if (payload.eventType === "DELETE") {
            const oldRow = payload.old as Partial<Notification>;
            setNotifications(
              (prev) => prev?.filter((n) => n.id !== oldRow.id) ?? prev,
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const markRead = useCallback(
    async (id: string) => {
      // Optimistic — the row is already visually "read" by the time the
      // request lands, so the UI doesn't wait on the round-trip.
      setNotifications(
        (prev) =>
          prev?.map((n) =>
            n.id === id && !n.read_at
              ? { ...n, read_at: new Date().toISOString() }
              : n,
          ) ?? prev,
      );
      const supabase = createClient();
      const { error: updateErr } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id)
        .is("read_at", null);
      if (updateErr) {
        toast.error(t("markReadFailed"));
        load();
      }
    },
    [load, t],
  );

  const handleClick = useCallback(
    (n: Notification) => {
      if (!n.read_at) markRead(n.id);
      if (n.conversation_id) {
        router.push(`/inbox?c=${n.conversation_id}`);
      }
    },
    [markRead, router],
  );

  const unreadIds = notifications?.filter((n) => !n.read_at).map((n) => n.id) ?? [];

  const markAllRead = useCallback(async () => {
    if (unreadIds.length === 0) return;
    setMarkingAll(true);
    const now = new Date().toISOString();
    setNotifications(
      (prev) => prev?.map((n) => (n.read_at ? n : { ...n, read_at: now })) ?? prev,
    );
    const supabase = createClient();
    const { error: updateErr } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .is("read_at", null);
    setMarkingAll(false);
    if (updateErr) {
      toast.error(t("markAllFailed"));
      load();
    }
  }, [unreadIds.length, load, t]);

  const header = (
    <PageHeader
      title={t("title")}
      description={
        notifications ? t("unreadCount", { count: unreadIds.length }) : t("description")
      }
      actions={
        <>
          <SegmentedControl
            aria-label={t("title")}
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: "all", label: t("filterAll") },
              { value: "unread", label: t("filterUnread") },
            ]}
          />
          <Button
            variant="outline"
            disabled={unreadIds.length === 0 || markingAll}
            onClick={markAllRead}
          >
            {markingAll ? <Loader2 className="animate-spin" /> : <CheckCheck />}
            {t("markAllRead")}
          </Button>
        </>
      }
    />
  );

  if (error) {
    return (
      <Page>
        {header}
        <PageBody>
          <div className="rounded-lg border border-border bg-card">
            <ErrorState
              title={t("loadErrorTitle")}
              description={error}
              action={
                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                  {t("retry")}
                </Button>
              }
            />
          </div>
        </PageBody>
      </Page>
    );
  }

  if (notifications === null) {
    return (
      <Page>
        {header}
        <PageBody>
          <div className="mx-auto max-w-3xl overflow-hidden rounded-lg border border-border bg-card">
            <SkeletonRows rows={6} />
          </div>
        </PageBody>
      </Page>
    );
  }

  const visible =
    filter === "unread" ? notifications.filter((n) => !n.read_at) : notifications;

  return (
    <Page>
      {header}
      <PageBody>
        <div className="mx-auto max-w-3xl">
          {visible.length === 0 ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState
                icon={Bell}
                title={filter === "unread" && notifications.length > 0 ? t("noUnread") : t("emptyTitle")}
                description={filter === "unread" && notifications.length > 0 ? undefined : t("emptyDesc")}
              />
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {visible.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Bell;
                const isUnread = !n.read_at;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleClick(n)}
                      className={cn(
                        "flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none",
                        isUnread && "bg-primary-soft/60",
                      )}
                    >
                      <span
                        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground"
                        aria-hidden
                      >
                        <Icon className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "truncate text-[13px]",
                              isUnread
                                ? "font-semibold text-foreground"
                                : "font-medium text-muted-foreground",
                            )}
                          >
                            {n.title}
                          </span>
                          <span className="ml-auto shrink-0 text-xs text-subtle-foreground tabular-nums">
                            {formatDistanceToNow(new Date(n.created_at), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        {n.body && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {n.body}
                          </p>
                        )}
                      </div>
                      {isUnread && (
                        <span
                          aria-label={t("unread")}
                          className="mt-2 size-2 shrink-0 rounded-full bg-primary"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PageBody>
    </Page>
  );
}
