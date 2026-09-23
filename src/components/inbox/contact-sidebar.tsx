"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn, initialOf } from "@/lib/utils";
import type { Contact, Deal, ContactNote, Tag } from "@/types";
import Link from "next/link";
import { Copy, Check, ArrowUpRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { contactHandle } from "@/lib/whatsapp/wa-identity";
import { formatCurrency } from "@/lib/currency";

interface ContactSidebarProps {
  contact: Contact | null;
}

export function ContactSidebar({ contact }: ContactSidebarProps) {
  const tSidebar = useTranslations("Inbox.sidebar");
  const tThread = useTranslations("Inbox.messageThread");

  const { accountId, defaultCurrency } = useAuth();
  const [copied, setCopied] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [tags, setTags] = useState<(Tag & { contact_tag_id: string })[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const fetchContactData = useCallback(async () => {
    if (!contact) return;

    const supabase = createClient();

    // Fetch deals, notes, and tags in parallel
    const [dealsRes, notesRes, tagsRes] = await Promise.all([
      supabase
        .from("deals")
        .select("*, stage:pipeline_stages(*)")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_notes")
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_tags")
        .select("id, tag_id, tags(*)")
        .eq("contact_id", contact.id),
    ]);

    if (dealsRes.data) setDeals(dealsRes.data);
    if (notesRes.data) setNotes(notesRes.data);
    if (tagsRes.data) {
      const mapped = tagsRes.data
        .filter((ct: Record<string, unknown>) => ct.tags)
        .map((ct: Record<string, unknown>) => ({
          ...(ct.tags as Tag),
          contact_tag_id: ct.id as string,
        }));
      setTags(mapped);
    }
  }, [contact]);

  // Load on contact change. setContactData/setTags run inside async
  // Supabase callbacks, not synchronously in the effect body.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchContactData();
  }, [fetchContactData]);

  const handleCopyPhone = useCallback(async () => {
    // Copies whatever the row displays — a BSUID-only contact has no
    // phone number to copy, but its @username still identifies them.
    const handle = contact ? contactHandle(contact) : '';
    if (!handle) return;
    await navigator.clipboard.writeText(handle);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // Dep is the whole `contact` object (not `contact?.phone`) so the
    // React Compiler's inference agrees with the manual dep list —
    // fixes the `preserve-manual-memoization` lint error.
  }, [contact]);

  const handleAddNote = useCallback(async () => {
    if (!contact || !newNote.trim()) return;
    if (!accountId) return;
    setAddingNote(true);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    const { data, error } = await supabase
      .from("contact_notes")
      .insert({
        contact_id: contact.id,
        account_id: accountId,
        user_id: user?.id,
        note_text: newNote.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setNotes((prev) => [data, ...prev]);
      setNewNote("");
    }
    setAddingNote(false);
  }, [contact, newNote, accountId]);

  if (!contact) {
    return (
      <div className="flex h-full w-[300px] items-center justify-center border-l border-border bg-background px-6 text-center">
        <p className="text-[13px] text-muted-foreground">{tThread("selectConversation")}</p>
      </div>
    );
  }

  const displayName = contact.name || contactHandle(contact);
  const initials = initialOf(displayName);
  const handle = contactHandle(contact);

  return (
    <div className="flex h-full w-[300px] flex-col border-l border-border bg-background">
      {/* Identity */}
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4">
        <Avatar className="size-8">
          {contact.avatar_url ? <AvatarImage src={contact.avatar_url} alt="" /> : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[13px] font-semibold text-foreground">{displayName}</h3>
          {contact.company ? (
            <p className="truncate text-xs text-muted-foreground">{contact.company}</p>
          ) : null}
        </div>
        <Link
          href={`/contacts?contact=${contact.id}`}
          title={tSidebar("openContact")}
          aria-label={tSidebar("openContact")}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowUpRight className="size-4" />
        </Link>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {/* Details */}
        <SidebarSection title={tSidebar("details")}>
          <dl className="space-y-0.5">
            <DetailRow label={tSidebar("phone")}>
              <button
                type="button"
                onClick={handleCopyPhone}
                title={copied ? tSidebar("copied") : tSidebar("copy")}
                className="group/copy -mx-1 flex min-w-0 max-w-full cursor-pointer items-center gap-1.5 rounded px-1 text-left hover:bg-accent"
              >
                <span className="truncate font-mono text-xs">{handle || tSidebar("none")}</span>
                {copied ? (
                  <Check className="size-3 shrink-0 text-success" />
                ) : (
                  <Copy className="size-3 shrink-0 text-subtle-foreground opacity-0 group-hover/copy:opacity-100" />
                )}
              </button>
            </DetailRow>
            <DetailRow label={tSidebar("email")}>
              <span className="truncate">{contact.email || <span className="text-subtle-foreground">{tSidebar("none")}</span>}</span>
            </DetailRow>
            <DetailRow label={tSidebar("company")}>
              <span className="truncate">{contact.company || <span className="text-subtle-foreground">{tSidebar("none")}</span>}</span>
            </DetailRow>
          </dl>
        </SidebarSection>

        {/* Tags */}
        <SidebarSection title={tSidebar("tags")} count={tags.length}>
          {tags.length === 0 ? (
            <p className="text-xs text-subtle-foreground">{tSidebar("noTags")}</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={tag.contact_tag_id}
                  className="inline-flex h-5 items-center gap-1.5 rounded-[5px] border border-border bg-card px-1.5 text-[11px] font-medium text-foreground"
                >
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </SidebarSection>

        {/* Deals */}
        <SidebarSection title={tSidebar("deals")} count={deals.length}>
          {deals.length === 0 ? (
            <p className="text-xs text-subtle-foreground">{tSidebar("noDeals")}</p>
          ) : (
            <ul className="-mx-1 space-y-0.5">
              {deals.map((deal) => (
                <li key={deal.id}>
                  <Link
                    href="/pipelines"
                    className="flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-accent"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: deal.stage?.color ?? "var(--border-strong)" }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-foreground">{deal.title}</p>
                      {deal.stage ? (
                        <p className="truncate text-[11px] text-muted-foreground">{deal.stage.name}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs font-medium text-foreground tabular-nums">
                      {formatCurrency(deal.value ?? 0, deal.currency || defaultCurrency)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SidebarSection>

        {/* Notes */}
        <SidebarSection title={tSidebar("notes")} count={notes.length} last>
          <div className="space-y-2">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder={tSidebar("addNotePlaceholder")}
              aria-label={tSidebar("addNote")}
              rows={2}
              className="min-h-14 resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void handleAddNote();
                }
              }}
            />
            {newNote.trim() ? (
              <div className="flex justify-end">
                <Button size="xs" onClick={handleAddNote} disabled={addingNote}>
                  {addingNote ? <Loader2 className="animate-spin" /> : null}
                  {tSidebar("addNote")}
                </Button>
              </div>
            ) : null}
          </div>

          {notes.length === 0 ? (
            <p className="mt-3 text-xs text-subtle-foreground">{tSidebar("noNotes")}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {notes.map((note) => (
                <li key={note.id} className="rounded-md border border-border bg-card-2 px-2.5 py-2">
                  <p className="text-xs whitespace-pre-wrap break-words text-foreground">
                    {note.note_text}
                  </p>
                  <p className="mt-1 text-[11px] text-subtle-foreground tabular-nums">
                    {format(new Date(note.created_at), "MMM d, yyyy · HH:mm")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SidebarSection>
      </ScrollArea>
    </div>
  );
}

function SidebarSection({
  title,
  count,
  last,
  children,
}: {
  title: string;
  count?: number;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("px-4 py-3.5", !last && "border-b border-border")}>
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {title}
        {count ? <span className="text-subtle-foreground tabular-nums">{count}</span> : null}
      </h4>
      {children}
    </section>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2 py-1 text-[13px]">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 text-foreground">{children}</dd>
    </div>
  );
}
