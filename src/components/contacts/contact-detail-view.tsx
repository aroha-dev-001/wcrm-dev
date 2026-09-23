'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { addContactTag, deleteContactTag } from '@/lib/contacts/tag-api';
import { useAuth } from '@/hooks/use-auth';
import { formatCurrency } from '@/lib/currency';
import { toast } from 'sonner';
import type { Contact, Tag, ContactNote, CustomField, Deal, MessageTemplate } from '@/types';
import {
  TemplatePicker,
  type TemplateSendValues,
} from '@/components/inbox/template-picker';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Phone,
  Mail,
  Building2,
  Copy,
  Check,
  Loader2,
  Plus,
  Trash2,
  Save,
  LayoutTemplate,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { contactHandle } from '@/lib/whatsapp/wa-identity';
import { parseInternationalPhone } from '@/lib/whatsapp/phone-utils';

interface ContactDetailViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string | null;
  onUpdated: () => void;
}

export function ContactDetailView({
  open,
  onOpenChange,
  contactId,
  onUpdated,
}: ContactDetailViewProps) {
  const t = useTranslations('Contacts.detailView');
  const supabase = createClient();
  const { accountId, defaultCurrency } = useAuth();

  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Send template — lets the business initiate (or re-open) a conversation
  // with this contact by sending an approved template. The send route
  // find-or-creates the conversation, so no inbound message is required.
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState(false);

  // Details tab
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);

  // Tags tab
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [contactTagIds, setContactTagIds] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);

  // Notes tab
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Custom fields tab
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [savingCustom, setSavingCustom] = useState(false);
  const [loadingCustom, setLoadingCustom] = useState(false);

  // Deals tab
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);

  const fetchContact = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);

    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single();

    if (data) {
      setContact(data);
      setEditName(data.name ?? '');
      setEditPhone(data.phone);
      setEditEmail(data.email ?? '');
      setEditCompany(data.company ?? '');
    }
    setLoading(false);
  }, [contactId, supabase]);

  const fetchTags = useCallback(async () => {
    if (!contactId) return;

    const [tagsRes, contactTagsRes] = await Promise.all([
      supabase.from('tags').select('*').order('name'),
      supabase.from('contact_tags').select('tag_id').eq('contact_id', contactId),
    ]);

    if (tagsRes.data) setAllTags(tagsRes.data);
    if (contactTagsRes.data) {
      setContactTagIds(contactTagsRes.data.map((ct) => ct.tag_id));
    }
  }, [contactId, supabase]);

  const fetchNotes = useCallback(async () => {
    if (!contactId) return;
    setLoadingNotes(true);

    const { data } = await supabase
      .from('contact_notes')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });

    if (data) setNotes(data);
    setLoadingNotes(false);
  }, [contactId, supabase]);

  const fetchCustomFields = useCallback(async () => {
    if (!contactId) return;
    setLoadingCustom(true);

    const [fieldsRes, valuesRes] = await Promise.all([
      supabase.from('custom_fields').select('*').order('field_name'),
      supabase
        .from('contact_custom_values')
        .select('*')
        .eq('contact_id', contactId),
    ]);

    if (fieldsRes.data) setCustomFields(fieldsRes.data);
    if (valuesRes.data) {
      const map: Record<string, string> = {};
      valuesRes.data.forEach((v) => {
        map[v.custom_field_id] = v.value ?? '';
      });
      setCustomValues(map);
    }
    setLoadingCustom(false);
  }, [contactId, supabase]);

  const fetchDeals = useCallback(async () => {
    if (!contactId) return;
    setLoadingDeals(true);
    const { data } = await supabase
      .from('deals')
      .select('*, stage:pipeline_stages(*)')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    setDeals((data ?? []) as Deal[]);
    setLoadingDeals(false);
  }, [contactId, supabase]);

  useEffect(() => {
    if (open && contactId) {
      fetchContact();
      fetchTags();
      fetchNotes();
      fetchCustomFields();
      fetchDeals();
    }
  }, [open, contactId, fetchContact, fetchTags, fetchNotes, fetchCustomFields, fetchDeals]);

  async function copyPhone() {
    if (!contact) return;
    await navigator.clipboard.writeText(contactHandle(contact));
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  }

  async function saveDetails() {
    if (!contactId || !editPhone.trim()) {
      toast.error(t('toastPhoneRequired'));
      return;
    }

    // Same rule as the create form: a changed number must start with `+`
    // and a country code (issue #586). Unchanged numbers — including the
    // digits-only form the inbound webhook stores — are left alone so a
    // name/email edit is never blocked by the phone field.
    const phoneChanged = editPhone.trim() !== (contact?.phone ?? '');
    if (phoneChanged && !parseInternationalPhone(editPhone)) {
      toast.error(t('toastPhoneNeedsCountryCode'));
      return;
    }

    setSavingDetails(true);
    const { error } = await supabase
      .from('contacts')
      .update({
        name: editName.trim() || null,
        phone: editPhone.trim(),
        email: editEmail.trim() || null,
        company: editCompany.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId);

    if (error) {
      toast.error(t('toastUpdateFailed'));
    } else {
      toast.success(t('toastUpdated'));
      fetchContact();
      onUpdated();
    }
    setSavingDetails(false);
  }

  async function toggleTag(tagId: string) {
    if (!contactId) return;
    setSavingTags(true);

    const isSelected = contactTagIds.includes(tagId);

    try {
      if (isSelected) {
        await deleteContactTag(contactId, tagId);
        setContactTagIds((prev) => prev.filter((id) => id !== tagId));
      } else {
        await addContactTag(contactId, tagId);
        setContactTagIds((prev) => [...prev, tagId]);
      }
      onUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('toastUpdateFailed'));
    }
    setSavingTags(false);
  }

  async function addNote() {
    if (!contactId || !newNote.trim()) return;
    setSavingNote(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user || !accountId) {
      toast.error(t('toastNotAuthenticated'));
      setSavingNote(false);
      return;
    }

    const { error } = await supabase.from('contact_notes').insert({
      contact_id: contactId,
      account_id: accountId,
      user_id: user.id,
      note_text: newNote.trim(),
    });

    if (error) {
      toast.error(t('toastNoteAddFailed'));
    } else {
      setNewNote('');
      fetchNotes();
      toast.success(t('toastNoteAdded'));
    }
    setSavingNote(false);
  }

  async function deleteNote(noteId: string) {
    const { error } = await supabase
      .from('contact_notes')
      .delete()
      .eq('id', noteId);

    if (error) {
      toast.error(t('toastNoteDeleteFailed'));
    } else {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success(t('toastNoteDeleted'));
    }
  }

  async function saveCustomFields() {
    if (!contactId) return;
    setSavingCustom(true);

    try {
      // Delete existing values and re-insert
      await supabase
        .from('contact_custom_values')
        .delete()
        .eq('contact_id', contactId);

      const rows = Object.entries(customValues)
        .filter(([, val]) => val.trim())
        .map(([fieldId, val]) => ({
          contact_id: contactId,
          custom_field_id: fieldId,
          value: val.trim(),
        }));

      if (rows.length > 0) {
        const { error } = await supabase
          .from('contact_custom_values')
          .insert(rows);
        if (error) throw error;
      }

      toast.success(t('toastCustomFieldsSaved'));
    } catch {
      toast.error(t('toastCustomFieldsFailed'));
    }
    setSavingCustom(false);
  }

  async function handleSendTemplate(
    template: MessageTemplate,
    values: TemplateSendValues,
  ) {
    if (!contactId) return;
    setSendingTemplate(true);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // No conversation_id — the route find-or-creates one for this
          // contact, mirroring the inbox template-send payload otherwise.
          contact_id: contactId,
          message_type: 'template',
          template_name: template.name,
          template_language: template.language,
          template_message_params: {
            body: values.body,
            headerText: values.headerText,
            buttonParams: values.buttonParams,
          },
          template_params: values.body,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const reason = payload?.error || `HTTP ${res.status}`;
        toast.error(t('toastTemplateFailed', { reason }));
        return;
      }

      toast.success(t('toastTemplateSent', { name: template.name }));
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'network error';
      toast.error(`Failed to send template: ${reason}`);
    } finally {
      setSendingTemplate(false);
    }
  }

  function getInitials(name?: string | null) {
    // Letters/digits only, so "[Test] Maria Chen" reads "TM" — not "[M".
    const words = (name ?? '')
      .split(/\s+/)
      .map((w) => w.match(/[\p{L}\p{N}]/u)?.[0])
      .filter(Boolean) as string[];
    return words.length ? words.slice(0, 2).join('').toUpperCase() : '?';
  }

  const tabsGutter = 'px-5';

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-[560px]"
      >
        {loading || !contact ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            {/* Header */}
            <SheetHeader className="gap-3 border-b border-border px-5 pt-5 pb-4">
              <div className="flex items-start gap-3">
                <Avatar className="size-10">
                  <AvatarFallback className="bg-primary-soft text-sm text-primary">
                    {getInitials(contact.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate">
                    {contact.name || t('unnamed')}
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    {t('contactDetailsDesc')}
                  </SheetDescription>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <button
                      type="button"
                      onClick={copyPhone}
                      className="inline-flex cursor-pointer items-center gap-1 rounded font-mono transition-colors hover:text-foreground"
                    >
                      <Phone className="size-3" />
                      {contactHandle(contact)}
                      {copiedPhone ? (
                        <Check className="size-3 text-success" />
                      ) : (
                        <Copy className="size-3 opacity-60" />
                      )}
                    </button>
                    {contact.email && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <Mail className="size-3 shrink-0" />
                        <span className="truncate">{contact.email}</span>
                      </span>
                    )}
                    {contact.company && (
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="size-3" />
                        {contact.company}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTemplatePickerOpen(true)}
                  disabled={sendingTemplate}
                >
                  {sendingTemplate ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <LayoutTemplate />
                  )}
                  {t('sendTemplateBtn')}
                </Button>
              </div>
            </SheetHeader>

            {/* Tabs */}
            <Tabs defaultValue="details" className="min-h-0 flex-1 gap-0">
              <div className={tabsGutter}>
                <TabsList variant="line">
                  <TabsTrigger value="details">{t('tabs.details')}</TabsTrigger>
                  <TabsTrigger value="tags">
                    {t('tabs.tags')}
                    {contactTagIds.length > 0 && (
                      <span className="text-xs text-subtle-foreground tabular-nums">{contactTagIds.length}</span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="notes">
                    {t('tabs.notes')}
                    {notes.length > 0 && (
                      <span className="text-xs text-subtle-foreground tabular-nums">{notes.length}</span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="custom">{t('tabs.custom')}</TabsTrigger>
                  <TabsTrigger value="deals">
                    {t('tabs.deals')}
                    {deals.length > 0 && (
                      <span className="text-xs text-subtle-foreground tabular-nums">{deals.length}</span>
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Details Tab */}
              <TabsContent value="details" className="overflow-y-auto px-5 py-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="cd-name">{t('name')}</Label>
                    <Input id="cd-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cd-phone">
                      {t('phone')} <span className="text-destructive">*</span>
                    </Label>
                    <Input id="cd-phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cd-email">{t('email')}</Label>
                    <Input id="cd-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="cd-company">{t('company')}</Label>
                    <Input id="cd-company" value={editCompany} onChange={(e) => setEditCompany(e.target.value)} />
                  </div>
                </div>
                <div className="mt-5 flex justify-end">
                  <Button onClick={saveDetails} disabled={savingDetails}>
                    {savingDetails ? <Loader2 className="animate-spin" /> : <Save />}
                    {t('saveChangesBtn')}
                  </Button>
                </div>
              </TabsContent>

              {/* Tags Tab */}
              <TabsContent value="tags" className="overflow-y-auto px-5 py-4">
                <p className="mb-3 text-xs text-muted-foreground">
                  {t('tagsTab.clickTagDesc')}
                </p>
                {allTags.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">
                    {t('tagsTab.noTagsAvailable')}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {allTags.map((tag) => {
                      const selected = contactTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag.id)}
                          disabled={savingTags}
                          aria-pressed={selected}
                          className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors disabled:opacity-60 ${
                            selected
                              ? 'border-primary/30 bg-primary-soft text-foreground'
                              : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground'
                          }`}
                        >
                          <span className="size-2 rounded-full" style={{ backgroundColor: tag.color }} />
                          {tag.name}
                          {selected && <Check className="size-3 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* Notes Tab */}
              <TabsContent value="notes" className="flex min-h-0 flex-col px-5 py-4">
                <div className="mb-4 space-y-2">
                  <Textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder={t('notesTab.placeholder')}
                    className="min-h-[72px] resize-none"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={addNote}
                      disabled={!newNote.trim() || savingNote}
                    >
                      {savingNote ? <Loader2 className="animate-spin" /> : <Plus />}
                      {t('notesTab.save')}
                    </Button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                  {loadingNotes ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : notes.length === 0 ? (
                    <p className="py-8 text-center text-[13px] text-muted-foreground">
                      {t('notesTab.noNotes')}
                    </p>
                  ) : (
                    notes.map((note) => (
                      <div
                        key={note.id}
                        className="group rounded-md border border-border bg-card-2 px-3 py-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="flex-1 text-[13px] whitespace-pre-wrap text-foreground">
                            {note.note_text}
                          </p>
                          <button
                            type="button"
                            onClick={() => deleteNote(note.id)}
                            aria-label={t('notesTab.delete')}
                            className="shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                        <p className="mt-1.5 text-[11px] text-subtle-foreground tabular-nums">
                          {new Date(note.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* Custom Fields Tab */}
              <TabsContent value="custom" className="overflow-y-auto px-5 py-4">
                {loadingCustom ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : customFields.length === 0 ? (
                  <p className="py-8 text-center text-[13px] text-muted-foreground">
                    {t('noCustomFields')}
                  </p>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {customFields.map((field) => (
                        <div key={field.id} className="space-y-1.5">
                          <Label htmlFor={`cf-${field.id}`} className="capitalize">
                            {field.field_name}
                          </Label>
                          <Input
                            id={`cf-${field.id}`}
                            value={customValues[field.id] ?? ''}
                            onChange={(e) =>
                              setCustomValues((prev) => ({
                                ...prev,
                                [field.id]: e.target.value,
                              }))
                            }
                            placeholder={t('enterCustomField', { name: field.field_name })}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 flex justify-end">
                      <Button onClick={saveCustomFields} disabled={savingCustom}>
                        {savingCustom ? <Loader2 className="animate-spin" /> : <Save />}
                        {t('saveCustomFieldsBtn')}
                      </Button>
                    </div>
                  </>
                )}
              </TabsContent>

              {/* Deals Tab */}
              <TabsContent value="deals" className="overflow-y-auto px-5 py-4">
                {loadingDeals ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : deals.length === 0 ? (
                  <p className="py-8 text-center text-[13px] text-muted-foreground">{t('dealsTab.noDeals')}</p>
                ) : (
                  <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
                    {deals.map((deal) => (
                      <div key={deal.id} className="flex items-center gap-3 bg-card px-3 py-2.5">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: deal.stage?.color ?? 'var(--border-strong)' }}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-foreground">
                            {deal.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {deal.stage?.name}
                            {deal.status && deal.status !== 'open' && (
                              <span
                                className={
                                  deal.status === 'won'
                                    ? 'ml-1.5 text-success'
                                    : 'ml-1.5 text-destructive'
                                }
                              >
                                · {deal.status}
                              </span>
                            )}
                          </p>
                        </div>
                        <span className="shrink-0 text-[13px] font-medium text-foreground tabular-nums">
                          {formatCurrency(
                            deal.value ?? 0,
                            deal.currency || defaultCurrency,
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
    <TemplatePicker
      open={templatePickerOpen}
      onOpenChange={setTemplatePickerOpen}
      onSelect={handleSendTemplate}
    />
    </>
  );
}
