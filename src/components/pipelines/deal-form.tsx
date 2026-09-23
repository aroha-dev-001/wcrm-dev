"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CURRENCIES } from "@/lib/currency";
import type {
  Contact,
  Conversation,
  Deal,
  DealStatus,
  PipelineStage,
  Profile,
} from "@/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Check,
  X,
  Trash2,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { nativeSelectClass } from "@/components/ui/native-select";
interface DealFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: Deal | null;
  pipelineId: string;
  stages: PipelineStage[];
  defaultStageId?: string;
  onSaved: () => void;
}

export function DealForm({
  open,
  onOpenChange,
  deal,
  pipelineId,
  stages,
  defaultStageId,
  onSaved,
}: DealFormProps) {
  const t = useTranslations("Pipelines.form");
  const supabase = createClient();
  const { accountId, defaultCurrency } = useAuth();

  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [contactId, setContactId] = useState("");
  const [stageId, setStageId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [notes, setNotes] = useState("");

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [linkedConversation, setLinkedConversation] =
    useState<Conversation | null>(null);

  const [saving, setSaving] = useState(false);
  const [statusAction, setStatusAction] = useState<DealStatus | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset the form fields every time the sheet opens or its input
  // props change. This is a legitimate prop-driven sync; the rule is
  // over-cautious here, hence the block-level disable.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (deal) {
      setTitle(deal.title);
      setValue(String(deal.value ?? ""));
      setCurrency(deal.currency || defaultCurrency);
      // contact_id is nullable when the contact has been deleted
      // (migration 004: ON DELETE SET NULL). "" means "no selection".
      setContactId(deal.contact_id ?? "");
      setStageId(deal.stage_id);
      setAssignedTo(deal.assigned_to ?? "");
      setExpectedCloseDate(deal.expected_close_date ?? "");
      setNotes(deal.notes ?? "");
    } else {
      setTitle("");
      setValue("");
      setCurrency(defaultCurrency);
      setContactId("");
      setStageId(defaultStageId || stages[0]?.id || "");
      setAssignedTo("");
      setExpectedCloseDate("");
      setNotes("");
    }
  }, [open, deal, defaultStageId, stages, defaultCurrency]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Load supporting data once the sheet is open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const [c, p] = await Promise.all([
        supabase.from("contacts").select("*").order("name"),
        supabase.from("profiles").select("*").order("full_name"),
      ]);
      if (cancelled) return;
      setContacts((c.data ?? []) as Contact[]);
      setProfiles((p.data ?? []) as Profile[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, supabase]);

  // Fetch linked conversation for the selected contact (newest open one).
  // Clearing on no-selection is sync with prop state; the populated
  // case runs setLinkedConversation inside the async fetch callback.
  useEffect(() => {
    if (!open || !contactId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLinkedConversation(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .eq("contact_id", contactId)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setLinkedConversation((data as Conversation | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, contactId, supabase]);

  async function handleSave() {
    if (!title.trim() || !contactId || !stageId) {
      toast.error(t("toastRequired"));
      return;
    }
    setSaving(true);

    const payload = {
      title: title.trim(),
      value: parseFloat(value) || 0,
      currency,
      contact_id: contactId,
      pipeline_id: pipelineId,
      stage_id: stageId,
      assigned_to: assignedTo || null,
      notes: notes.trim() || null,
      expected_close_date: expectedCloseDate || null,
    };

    if (deal) {
      const { error } = await supabase
        .from("deals")
        .update(payload)
        .eq("id", deal.id);
      if (error) {
        toast.error(t("toastFailedSave"));
        setSaving(false);
        return;
      }
    } else {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        toast.error(t("toastNotSignedIn"));
        setSaving(false);
        return;
      }
      if (!accountId) {
        toast.error(t("toastNotLinked"));
        setSaving(false);
        return;
      }
      const { error } = await supabase
        .from("deals")
        .insert({ ...payload, user_id: user.id, account_id: accountId, status: "open" });
      if (error) {
        toast.error(t("toastFailedCreate"));
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    toast.success(deal ? t("toastUpdated") : t("toastCreated"));
    onOpenChange(false);
    onSaved();
  }

  async function handleStatusChange(status: DealStatus) {
    if (!deal) return;
    setStatusAction(status);
    const { error } = await supabase
      .from("deals")
      .update({ status })
      .eq("id", deal.id);
    setStatusAction(null);
    if (error) {
      toast.error(t("toastFailedStatus"));
      return;
    }
    toast.success(
      status === "won" ? t("toastMarkedWon") : status === "lost" ? t("toastMarkedLost") : t("toastReopened"),
    );
    onOpenChange(false);
    onSaved();
  }

  async function handleDelete() {
    if (!deal) return;
    setDeleting(true);
    const { error } = await supabase.from("deals").delete().eq("id", deal.id);
    setDeleting(false);
    if (error) {
      toast.error(t("toastFailedDelete"));
      return;
    }
    toast.success(t("toastDeleted"));
    setConfirmDelete(false);
    onOpenChange(false);
    onSaved();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[480px]">
        <div className="flex h-full min-h-0 flex-col">
          <SheetHeader className="border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <SheetTitle>{deal ? t("editDeal") : t("newDeal")}</SheetTitle>
              {deal?.status === "won" && <Badge variant="success">{t("statusWon")}</Badge>}
              {deal?.status === "lost" && <Badge variant="destructive">{t("statusLost")}</Badge>}
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="deal-title">{t("title")}</Label>
              <Input
                id="deal-title"
                autoFocus={!deal}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("titlePlaceholder")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deal-contact">{t("contact")}</Label>
              <select
                id="deal-contact"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className={nativeSelectClass}
              >
                <option value="">{t("selectContact")}</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.phone}
                  </option>
                ))}
              </select>

              {linkedConversation && (
                <Link
                  href="/inbox"
                  className="inline-flex items-center gap-1.5 pt-0.5 text-xs font-medium text-primary hover:underline"
                >
                  <MessageSquare className="size-3" />
                  {t("linkToConversation")}
                </Link>
              )}
            </div>

            <div className="grid grid-cols-[1fr_104px] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="deal-value">{t("value")}</Label>
                <Input
                  id="deal-value"
                  type="number"
                  inputMode="decimal"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0"
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deal-currency">{t("currency")}</Label>
                <select
                  id="deal-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className={nativeSelectClass}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="deal-stage">{t("stage")}</Label>
                <select
                  id="deal-stage"
                  value={stageId}
                  onChange={(e) => setStageId(e.target.value)}
                  className={nativeSelectClass}
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="deal-close">{t("expectedCloseDate")}</Label>
                <Input
                  id="deal-close"
                  type="date"
                  value={expectedCloseDate}
                  onChange={(e) => setExpectedCloseDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deal-owner">{t("assignedTo")}</Label>
              <select
                id="deal-owner"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className={nativeSelectClass}
              >
                <option value="">{t("unassigned")}</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deal-notes">{t("notes")}</Label>
              <Textarea
                id="deal-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("notesPlaceholder")}
                className="min-h-[96px]"
              />
            </div>

            {deal && (
              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-xs font-medium text-muted-foreground">{t("status")}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange("won")}
                    disabled={!!statusAction || deal.status === "won"}
                    className="text-success"
                  >
                    {statusAction === "won" ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Check />
                    )}
                    {t("markAsWon")}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive-outline"
                    size="sm"
                    onClick={() => handleStatusChange("lost")}
                    disabled={!!statusAction || deal.status === "lost"}
                  >
                    {statusAction === "lost" ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <X />
                    )}
                    {t("markAsLost")}
                  </Button>
                  {deal.status && deal.status !== "open" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStatusChange("open")}
                      disabled={!!statusAction}
                    >
                      {t("reopenDeal")}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-border bg-card-2 px-5 py-3">
            {deal && confirmDelete ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] text-foreground">{t("deletePrompt")}</span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? t("deleting") : t("confirm")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {deal && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(true)}
                    className="text-destructive hover:bg-destructive/8 hover:text-destructive"
                  >
                    <Trash2 />
                    {t("deleteDeal")}
                  </Button>
                )}
                <div className="ml-auto flex gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    {t("cancel")}
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving || !title.trim() || !contactId || !stageId}
                  >
                    {saving && <Loader2 className="animate-spin" />}
                    {saving ? t("saving") : deal ? t("saveChanges") : t("createDeal")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
