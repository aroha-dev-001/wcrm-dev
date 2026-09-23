"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CONVERSATION_SELECT,
  matchesContactFilters,
  normalizeConversations,
} from "@/lib/inbox/conversations";
import { cn, initialOf } from "@/lib/utils";
import type { Conversation, ConversationStatus, Tag } from "@/types";
import { Search, ListFilter, X, Check, Inbox as InboxIcon } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

interface ConversationListProps {
  activeConversationId: string | null;
  onSelect: (conversation: Conversation) => void;
  conversations: Conversation[];
  onConversationsLoaded: (conversations: Conversation[]) => void;
  /**
   * Increment to force the fetch effect below to refire. The parent
   * bumps this on realtime reconnect / tab visibility → visible so the
   * list catches up on any events sent while the WS was disconnected
   * or the tab was throttled. Optional so existing callers keep working.
   */
  resyncToken?: number;
}

const STATUS_COLORS: Record<ConversationStatus, string> = {
  open: "bg-success",
  pending: "bg-warning",
  closed: "bg-subtle-foreground/60",
};



type InboxFilter = ConversationStatus | "all" | "unread";

export function ConversationList({
  activeConversationId,
  onSelect,
  conversations,
  onConversationsLoaded,
  resyncToken = 0,
}: ConversationListProps) {
  const t = useTranslations("Inbox.conversationList");
  
  const FILTER_OPTIONS: { label: string; value: InboxFilter }[] = useMemo(() => [
    { label: t("filterAll"), value: "all" },
    { label: t("filterUnread"), value: "unread" },
    { label: t("filterOpen"), value: "open" },
    { label: t("filterPending"), value: "pending" },
    { label: t("filterClosed"), value: "closed" },
  ], [t]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [loading, setLoading] = useState(true);
  // Contact-based filters (issue #272). Tags use OR logic (a conversation
  // matches if its contact carries any selected tag), consistent with
  // Broadcast audience filtering. Company is an exact match on the field.
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

  // Keep the latest callback in a ref so the fetch effect below can
  // have a stable, empty-dep identity. Previously the fetch useCallback
  // depended on `onConversationsLoaded`, which depends on the parent's
  // `deepLinkConvId` — so every URL change (including one the parent
  // triggered via router.replace after a click) caused a fresh
  // conversations fetch. That extra refetch was the trigger for the
  // deep-link auto-select running a second time and wiping the active
  // thread's messages.
  // Mutation lives in an effect (not render) per React 19's refs rule;
  // the fetch runs once on mount so it's fine to read the slightly
  // older value — the very next render updates the ref for any
  // subsequent async completion.
  const onConversationsLoadedRef = useRef(onConversationsLoaded);
  useEffect(() => {
    onConversationsLoadedRef.current = onConversationsLoaded;
  });

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(CONVERSATION_SELECT)
        .order("last_message_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        // Supabase errors have non-enumerable properties — log fields explicitly
        console.error("Failed to fetch conversations:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        setLoading(false);
        return;
      }

      onConversationsLoadedRef.current(normalizeConversations(data ?? []));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // `resyncToken` is included so the parent can force a refetch when
    // the realtime channel reconnects or the tab regains focus — catches
    // up on any events sent while the WS was disconnected or throttled.
  }, [resyncToken]);

  // Tag definitions for the filter picker — loaded once so labels/colours
  // stay stable regardless of which conversations happen to be loaded.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("tags").select("*").order("name");
      if (!cancelled && data) setTags(data as Tag[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Company options are derived from the loaded conversations — there's no
  // separate companies table, and only companies with a live conversation
  // are worth offering as an inbox filter.
  const companies = useMemo(() => {
    const set = new Set<string>();
    for (const c of conversations) {
      const co = c.contact?.company?.trim();
      if (co) set.add(co);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [conversations]);

  const tagsById = useMemo(() => {
    const m = new Map<string, Tag>();
    for (const t of tags) m.set(t.id, t);
    return m;
  }, [tags]);

  const filtered = useMemo(() => {
    let result = conversations;

    if (filter === "unread") {
      result = result.filter((c) => c.unread_count > 0);
    } else if (filter !== "all") {
      result = result.filter((c) => c.status === filter);
    }

    // Contact-based filters (tags via OR logic, exact company match).
    if (selectedTagIds.length > 0 || selectedCompany !== null) {
      result = result.filter((c) =>
        matchesContactFilters(c, {
          tagIds: selectedTagIds,
          company: selectedCompany,
        })
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) => {
        const name = c.contact?.name?.toLowerCase() ?? "";
        const phone = c.contact?.phone?.toLowerCase() ?? "";
        const lastMsg = c.last_message_text?.toLowerCase() ?? "";
        return name.includes(q) || phone.includes(q) || lastMsg.includes(q);
      });
    }

    return result;
  }, [conversations, filter, search, selectedTagIds, selectedCompany]);

  const toggleTag = useCallback((id: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }, []);

  const clearContactFilters = useCallback(() => {
    setSelectedTagIds([]);
    setSelectedCompany(null);
  }, []);

  const hasContactFilters = selectedTagIds.length > 0 || selectedCompany !== null;

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
    },
    []
  );

  const handleSelect = useCallback(
    (conv: Conversation) => {
      onSelect(conv);
    },
    [onSelect]
  );

  const hasSearchOrFilter =
    search.trim().length > 0 || filter !== "all" || hasContactFilters;

  return (
    // Full width on mobile (single pane); a fixed column on desktop
    // where it shares the row with the thread + contact panel.
    <div className="flex h-full w-full flex-col border-r border-border bg-background lg:w-[320px]">
      {/* Title + filters */}
      <div className="shrink-0 space-y-2.5 px-3 pt-3 pb-2">
        <div className="flex items-center justify-between gap-2 px-1">
          <h1 className="text-[15px] font-semibold text-foreground">{t("title")}</h1>
          {(tags.length > 0 || companies.length > 0) && (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={t("filters")}
                title={t("filters")}
                className={cn(
                  "relative inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-popup-open:bg-accent",
                  hasContactFilters && "text-foreground",
                )}
              >
                <ListFilter className="size-4" />
                {hasContactFilters && (
                  <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-80 w-60">
                {tags.length > 0 && (
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>{t("tags")}</DropdownMenuLabel>
                    {tags.map((tag) => (
                      <DropdownMenuCheckboxItem
                        key={tag.id}
                        checked={selectedTagIds.includes(tag.id)}
                        onCheckedChange={() => toggleTag(tag.id)}
                      >
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="truncate">{tag.name}</span>
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuGroup>
                )}
                {tags.length > 0 && companies.length > 0 && <DropdownMenuSeparator />}
                {companies.length > 0 && (
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>{t("company")}</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setSelectedCompany(null)}>
                      <span className="flex-1">{t("allCompanies")}</span>
                      {selectedCompany === null && <Check className="size-3.5 text-foreground!" />}
                    </DropdownMenuItem>
                    {companies.map((co) => (
                      <DropdownMenuItem key={co} onClick={() => setSelectedCompany(co)}>
                        <span className="flex-1 truncate">{co}</span>
                        {selectedCompany === co && <Check className="size-3.5 text-foreground!" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                )}
                {hasContactFilters && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={clearContactFilters}>
                      <X />
                      {t("clearAll")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={handleSearchChange}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="pl-8"
          />
        </div>

        {/* Status filter */}
        <div
          role="tablist"
          aria-label={t("statusLabel")}
          className="scrollbar-none -mx-1 flex items-center gap-0.5 overflow-x-auto px-1"
        >
          {FILTER_OPTIONS.map((opt) => {
            const active = filter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(opt.value)}
                className={cn(
                  "h-6 shrink-0 cursor-pointer rounded-[5px] px-2 text-xs font-medium transition-colors",
                  active
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {hasContactFilters && (
          <div className="flex flex-wrap items-center gap-1">
            {selectedTagIds.map((id) => {
              const tag = tagsById.get(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleTag(id)}
                  className="inline-flex h-6 items-center gap-1.5 rounded-[5px] border border-border bg-card px-1.5 text-[11px] text-foreground hover:bg-accent"
                >
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tag?.color ?? "var(--muted-foreground)" }}
                  />
                  <span className="max-w-24 truncate">{tag?.name ?? t("tags")}</span>
                  <X className="size-3 text-muted-foreground" />
                </button>
              );
            })}
            {selectedCompany && (
              <button
                type="button"
                onClick={() => setSelectedCompany(null)}
                className="inline-flex h-6 items-center gap-1.5 rounded-[5px] border border-border bg-card px-1.5 text-[11px] text-foreground hover:bg-accent"
              >
                <span className="max-w-24 truncate">{selectedCompany}</span>
                <X className="size-3 text-muted-foreground" />
              </button>
            )}
            <button
              type="button"
              onClick={clearContactFilters}
              className="px-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {t("clearAll")}
            </button>
          </div>
        )}
      </div>

      {/* Conversation Items.
          `min-h-0` is load-bearing: a flex child defaults to
          min-height:auto, so without it this ScrollArea grows to fit
          every conversation instead of shrinking to the remaining
          space — the list then overflows and gets clipped by the
          parent's overflow-hidden with no scrollbar (issue #229). */}
      <ScrollArea className="min-h-0 flex-1 border-t border-border">
        {loading ? (
          <div>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1 space-y-2 pt-0.5">
                  <Skeleton className="h-3 w-2/5" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            size="sm"
            icon={InboxIcon}
            title={t("noConversations")}
            description={hasSearchOrFilter ? t("noMatchHint") : t("noConversationsHint")}
          />
        ) : (
          <div className="flex flex-col py-1">
            {filtered.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConversationId}
                onSelect={handleSelect}
                t={t}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (conversation: Conversation) => void;
  t: ReturnType<typeof useTranslations>;
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  t,
}: ConversationItemProps) {
  const contact = conversation.contact;
  const displayName = contact?.name || contact?.phone || t("unknown");
  const initials = initialOf(displayName);

  const handleClick = useCallback(() => {
    onSelect(conversation);
  }, [onSelect, conversation]);

  const timeAgo = conversation.last_message_at
    ? formatDistanceToNowStrict(new Date(conversation.last_message_at))
        .replace(/ seconds?/, "s")
        .replace(/ minutes?/, "m")
        .replace(/ hours?/, "h")
        .replace(/ days?/, "d")
        .replace(/ months?/, "mo")
        .replace(/ years?/, "y")
    : "";
  const unread = conversation.unread_count > 0;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-current={isActive ? "true" : undefined}
      className={cn(
        "mx-1.5 flex w-[calc(100%-0.75rem)] cursor-pointer items-start gap-3 rounded-md px-2.5 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        isActive ? "bg-accent" : "hover:bg-muted/60",
      )}
    >
      <Avatar className="mt-0.5 size-8">
        {contact?.avatar_url ? (
          <AvatarImage src={contact.avatar_url} alt="" />
        ) : null}
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "truncate text-[13px] text-foreground",
              unread ? "font-semibold" : "font-medium",
            )}
          >
            {displayName}
          </span>
          <span
            className={cn(
              "shrink-0 text-[11px] tabular-nums",
              unread ? "font-medium text-foreground" : "text-subtle-foreground",
            )}
          >
            {timeAgo}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p
            className={cn(
              "truncate text-xs",
              unread ? "text-foreground/80" : "text-muted-foreground",
            )}
          >
            {conversation.last_message_text || t("noMessagesYet")}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {unread && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums">
                {conversation.unread_count}
              </span>
            )}
            <span
              className={cn("size-1.5 rounded-full", STATUS_COLORS[conversation.status])}
              title={conversation.status}
              aria-label={conversation.status}
            />
          </div>
        </div>
      </div>
    </button>
  );
}
