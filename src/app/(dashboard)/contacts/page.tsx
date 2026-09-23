'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { Contact, Tag, ContactTag } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Search,
  Plus,
  Upload,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Users,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  ListFilter,
  X,
  ArrowUpRight,
} from 'lucide-react';
import { Page, PageBody, PageHeader, PageToolbar } from '@/components/layout/page';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ContactForm } from '@/components/contacts/contact-form';
import { ContactDetailView } from '@/components/contacts/contact-detail-view';
import { ImportModal } from '@/components/contacts/import-modal';
import { CustomFieldsManager } from '@/components/contacts/custom-fields-manager';
import { useCan } from '@/hooks/use-can';
import { useAuth } from '@/hooks/use-auth';
import { GatedButton } from '@/components/ui/gated-button';
import { useTranslations } from 'next-intl';

import { initialOf } from '@/lib/utils';
const PAGE_SIZE = 25;

interface ContactWithTags extends Contact {
  tags?: Tag[];
}

// `useSearchParams` (deep links: ?contact=<id>, ?new=1, ?import=1)
// needs a Suspense boundary for the production build.
export default function ContactsPage() {
  return (
    <Suspense fallback={null}>
      <ContactsPageInner />
    </Suspense>
  );
}

function ContactsPageInner() {
  const t = useTranslations('Contacts.page');
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const canEdit = useCan('send-messages');
  const canEditSettings = useCan('edit-settings');
  const { accountRole } = useAuth();

  const [contacts, setContacts] = useState<ContactWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  // Tag filter — contacts shown must have ANY of these tags (OR).
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [editContactTags, setEditContactTags] = useState<ContactTag[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailContactId, setDetailContactId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk selection (page-scoped — only the loaded rows are selectable)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // All tags for display
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});

  // Guards against out-of-order fetch responses: each fetchContacts run
  // claims a sequence number and only the latest is allowed to commit its
  // results. Without this, rapidly toggling tag filters could let a slower
  // earlier request resolve last and render stale rows.
  const fetchSeq = useRef(0);

  const fetchTags = useCallback(async () => {
    const { data } = await supabase.from('tags').select('*');
    if (data) {
      const map: Record<string, Tag> = {};
      data.forEach((t) => (map[t.id] = t));
      setTagsMap(map);
      // Drop any filter selections whose tag no longer exists (e.g. a tag
      // deleted elsewhere) so it can't linger invisibly in the query.
      setSelectedTagIds((prev) => {
        const pruned = prev.filter((id) => map[id]);
        return pruned.length === prev.length ? prev : pruned;
      });
    }
  }, [supabase]);

  const fetchContacts = useCallback(async () => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    // The visible rows are about to change — drop any selection that
    // referred to the old page/search results so the bulk bar can't
    // act on rows the user can no longer see.
    setSelected(new Set());

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const term = search.trim();

    let contactRows: Contact[];
    let count: number;

    if (selectedTagIds.length > 0) {
      // Tag filter active — resolve it server-side (join + distinct +
      // windowed total count + pagination) so a tag covering many
      // contacts can't silently truncate the result or overflow an IN
      // clause. See migration 025_filter_contacts_by_tags.
      const { data, error } = await supabase.rpc('filter_contacts_by_tags', {
        p_tag_ids: selectedTagIds,
        p_search: term || null,
        p_limit: PAGE_SIZE,
        p_offset: from,
      });
      if (seq !== fetchSeq.current) return; // superseded by a newer fetch
      if (error) {
        toast.error(t('toastFailedLoad'));
        setLoading(false);
        return;
      }
      const rows = (data ?? []) as { contact: Contact; total_count: number }[];
      contactRows = rows.map((r) => r.contact);
      count = rows.length > 0 ? Number(rows[0].total_count) : 0;
    } else {
      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (term) {
        const like = `%${term}%`;
        query = query.or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like}`);
      }

      const { data, count: exactCount, error } = await query;
      if (seq !== fetchSeq.current) return; // superseded by a newer fetch
      if (error) {
        toast.error(t('toastFailedLoad'));
        setLoading(false);
        return;
      }
      contactRows = data ?? [];
      count = exactCount ?? 0;
    }

    setTotalCount(count);

    if (contactRows.length === 0) {
      setContacts([]);
      setLoading(false);
      return;
    }

    // Fetch tags for these contacts
    const contactIds = contactRows.map((c) => c.id);
    const { data: contactTags } = await supabase
      .from('contact_tags')
      .select('contact_id, tag_id')
      .in('contact_id', contactIds);
    if (seq !== fetchSeq.current) return; // superseded by a newer fetch

    const tagsByContact: Record<string, string[]> = {};
    contactTags?.forEach((ct) => {
      if (!tagsByContact[ct.contact_id]) tagsByContact[ct.contact_id] = [];
      tagsByContact[ct.contact_id].push(ct.tag_id);
    });

    const enriched: ContactWithTags[] = contactRows.map((c) => ({
      ...c,
      tags: (tagsByContact[c.id] ?? [])
        .map((tid) => tagsMap[tid])
        .filter(Boolean),
    }));

    setContacts(enriched);
    setLoading(false);
  }, [supabase, page, search, selectedTagIds, tagsMap, t]);

  // Load-once-on-mount-ish data fetches. Each setter inside runs
  // inside an async promise completion (Supabase await), not
  // synchronously in the effect body, so the cascade the lint rule
  // warns about doesn't apply here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTags();
  }, [fetchTags]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchContacts();
  }, [fetchContacts]);

  // Deep links from the command menu / inbox: open a contact, the add
  // form or the importer, then drop the param so a refresh or a later
  // close doesn't reopen it.
  const deepContactId = searchParams.get('contact');
  const deepNew = searchParams.get('new');
  const deepImport = searchParams.get('import');
  useEffect(() => {
    if (!deepContactId && !deepNew && !deepImport) return;
    // Create/import links wait until the role (and so `canEdit`) is known.
    if (!deepContactId && !accountRole) return;
    // Syncing one-shot URL intent into dialog state — the param is
    // consumed (removed) right below, so this can't cascade.
    if (deepContactId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDetailContactId(deepContactId);
      setDetailOpen(true);
    } else if (deepNew && canEdit) {
      setEditContact(null);
      setEditContactTags([]);
      setFormOpen(true);
    } else if (deepImport && canEdit) {
      setImportOpen(true);
    }
    router.replace('/contacts', { scroll: false });
  }, [deepContactId, deepNew, deepImport, canEdit, accountRole, router]);

  function openAddForm() {
    setEditContact(null);
    setEditContactTags([]);
    setFormOpen(true);
  }

  async function openEditForm(contact: Contact) {
    const { data } = await supabase
      .from('contact_tags')
      .select('*')
      .eq('contact_id', contact.id);
    setEditContact(contact);
    setEditContactTags(data ?? []);
    setFormOpen(true);
  }

  function openDetail(contactId: string) {
    setDetailContactId(contactId);
    setDetailOpen(true);
  }

  function confirmDelete(contact: Contact) {
    setDeleteTarget(contact);
    setDeleteConfirmOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      toast.error(t('toastFailedDelete'));
    } else {
      toast.success(t('toastDeleted'));
      fetchContacts();
    }

    setDeleting(false);
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
  }

  const allOnPageSelected =
    contacts.length > 0 && contacts.every((c) => selected.has(c.id));
  const someOnPageSelected = contacts.some((c) => selected.has(c.id));

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        contacts.forEach((c) => next.delete(c.id));
      } else {
        contacts.forEach((c) => next.add(c.id));
      }
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setDeleting(true);

    const { error } = await supabase.from('contacts').delete().in('id', ids);

    if (error) {
      toast.error(t('toastBulkFailedDelete'));
    } else {
      toast.success(t('toastBulkDeleted', { count: ids.length }));
      setSelected(new Set());
      fetchContacts();
    }

    setDeleting(false);
    setBulkDeleteOpen(false);
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasNext = page < totalPages - 1;
  const hasPrev = page > 0;

  // Tag filter helpers. Every change resets to page 0 — the result set
  // shrinks/grows so page N may no longer be valid (mirrors the search box).
  const allTags = Object.values(tagsMap).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const hasActiveFilters = search.trim().length > 0 || selectedTagIds.length > 0;

  function toggleTagFilter(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
    setPage(0);
  }

  function clearTagFilters() {
    setSelectedTagIds([]);
    setPage(0);
  }

  const rangeStart = totalCount === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, totalCount);

  return (
    <Page>
      <PageHeader
        title={t('title')}
        description={totalCount > 0 ? t('countLabel', { count: totalCount }) : t('subtitleZero')}
        actions={
          <>
            {canEditSettings && (
              <Button variant="ghost" onClick={() => setCustomFieldsOpen(true)}>
                <SlidersHorizontal />
                <span className="hidden sm:inline">{t('customFieldsBtn')}</span>
              </Button>
            )}
            <GatedButton
              variant="outline"
              canAct={canEdit}
              gateReason="add or import contacts"
              onClick={() => setImportOpen(true)}
            >
              <Upload />
              {t('importBtn')}
            </GatedButton>
            <GatedButton
              canAct={canEdit}
              gateReason="add or import contacts"
              onClick={openAddForm}
            >
              <Plus />
              {t('addContactBtn')}
            </GatedButton>
          </>
        }
      />

      <PageBody className="flex flex-col gap-3">
        {/* Toolbar — swaps to bulk actions while rows are selected */}
        {selected.size > 0 ? (
          <div className="flex h-8 items-center gap-2 rounded-md border border-primary/20 bg-primary-soft pr-1 pl-3">
            <p className="text-[13px] font-medium text-foreground tabular-nums">
              {t('selectedCount', { count: selected.size })}
            </p>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                {t('clearSelection')}
              </Button>
              <GatedButton
                variant="destructive-outline"
                size="sm"
                canAct={canEdit}
                gateReason="delete contacts"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 />
                {t('deleteSelected')}
              </GatedButton>
            </div>
          </div>
        ) : (
          <PageToolbar>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  // Reset pagination when the query changes — the result
                  // set shrinks/grows, page N may no longer be valid.
                  setPage(0);
                }}
                placeholder={t('searchPlaceholder')}
                aria-label={t('searchPlaceholder')}
                className="pl-8"
              />
            </div>

            <Popover>
              <PopoverTrigger render={<Button variant="outline" className="shrink-0" />}>
                <ListFilter />
                {t('tagsLabel')}
                {selectedTagIds.length > 0 && (
                  <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums">
                    {selectedTagIds.length}
                  </span>
                )}
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 gap-0 p-0">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('filterByTags')}
                  </span>
                  {selectedTagIds.length > 0 && (
                    <button
                      type="button"
                      onClick={clearTagFilters}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      {t('clearAll')}
                    </button>
                  )}
                </div>
                {allTags.length === 0 ? (
                  <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">
                    {t('noTagsYet')}
                  </p>
                ) : (
                  <div className="max-h-64 overflow-y-auto p-1">
                    {allTags.map((tag) => (
                      <label
                        key={tag.id}
                        className="flex h-8 cursor-pointer items-center gap-2.5 rounded-[5px] px-2 hover:bg-accent"
                      >
                        <Checkbox
                          checked={selectedTagIds.includes(tag.id)}
                          onCheckedChange={() => toggleTagFilter(tag.id)}
                          aria-label={`Filter by ${tag.name}`}
                        />
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="truncate text-[13px] text-popover-foreground">
                          {tag.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* Active tag-filter chips */}
            {selectedTagIds.map((id) => {
              const tag = tagsMap[id];
              if (!tag) return null;
              return (
                <span
                  key={id}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-card pr-1 pl-2 text-xs text-foreground"
                >
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => toggleTagFilter(id)}
                    aria-label={`Remove ${tag.name} filter`}
                    className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              );
            })}
            {selectedTagIds.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearTagFilters}>
                {t('clearAll')}
              </Button>
            )}
          </PageToolbar>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {loading ? (
            <Table>
              <TableBody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i} className="hover:bg-transparent">
                    <TableCell className="w-10"><Skeleton className="size-4" /></TableCell>
                    <TableCell><div className="flex items-center gap-2.5"><Skeleton className="size-6 rounded-full" /><Skeleton className="h-3 w-32" /></div></TableCell>
                    <TableCell><Skeleton className="h-3 w-24" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-3 w-36" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-3 w-20" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : contacts.length === 0 ? (
            <EmptyState
              icon={Users}
              title={hasActiveFilters ? t('noContactsMatch') : t('noContactsYet')}
              description={hasActiveFilters ? t('noContactsMatchHint') : t('noContactsYetHint')}
              action={
                hasActiveFilters ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      clearTagFilters();
                    }}
                  >
                    {t('clearAll')}
                  </Button>
                ) : (
                  <>
                    <GatedButton
                      variant="outline"
                      size="sm"
                      canAct={canEdit}
                      gateReason="add or import contacts"
                      onClick={() => setImportOpen(true)}
                    >
                      <Upload />
                      {t('importBtn')}
                    </GatedButton>
                    <GatedButton
                      size="sm"
                      canAct={canEdit}
                      gateReason="add or import contacts"
                      onClick={openAddForm}
                    >
                      <Plus />
                      {t('addFirstContact')}
                    </GatedButton>
                  </>
                )
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allOnPageSelected}
                      indeterminate={!allOnPageSelected && someOnPageSelected}
                      onCheckedChange={toggleSelectAll}
                      disabled={contacts.length === 0}
                      aria-label={t('selectAllOnPage')}
                    />
                  </TableHead>
                  <TableHead>{t('tableColumns.name')}</TableHead>
                  <TableHead>{t('tableColumns.phone')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('tableColumns.email')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('tableColumns.company')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('tableColumns.tags')}</TableHead>
                  <TableHead className="hidden text-right xl:table-cell">{t('tableColumns.createdAt')}</TableHead>
                  <TableHead className="w-12"><span className="sr-only">{t('moreActions')}</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => {
                  const isSelected = selected.has(contact.id);
                  const label = contact.name || contact.phone;
                  return (
                    <TableRow
                      key={contact.id}
                      aria-selected={isSelected}
                      className="group/row cursor-pointer"
                      onClick={() => openDetail(contact.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(contact.id)}
                          aria-label={`Select ${label}`}
                        />
                      </TableCell>
                      <TableCell className="max-w-64">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar className="size-6">
                            <AvatarFallback className="text-[10px]">
                              {initialOf(contact.name || contact.phone)}
                            </AvatarFallback>
                          </Avatar>
                          {contact.name ? (
                            <span className="truncate font-medium text-foreground">{contact.name}</span>
                          ) : (
                            <span className="truncate text-subtle-foreground italic">{t('unnamed')}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {contact.phone}
                      </TableCell>
                      <TableCell className="hidden max-w-56 truncate text-muted-foreground md:table-cell">
                        {contact.email || <span className="text-subtle-foreground">—</span>}
                      </TableCell>
                      <TableCell className="hidden max-w-44 truncate text-muted-foreground lg:table-cell">
                        {contact.company || <span className="text-subtle-foreground">—</span>}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex max-w-60 items-center gap-1 overflow-hidden">
                          {contact.tags && contact.tags.length > 0 ? (
                            contact.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag.id}
                                className="inline-flex h-5 shrink-0 items-center gap-1.5 rounded-[5px] border border-border bg-card px-1.5 text-[11px] font-medium text-foreground"
                              >
                                <span className="size-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                                {tag.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-subtle-foreground">—</span>
                          )}
                          {contact.tags && contact.tags.length > 3 && (
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              +{contact.tags.length - 3}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-right text-xs text-muted-foreground tabular-nums xl:table-cell">
                        {new Date(contact.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label={t('moreActions')}
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="opacity-60 group-hover/row:opacity-100 data-popup-open:opacity-100"
                              />
                            }
                          >
                            <MoreHorizontal />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => openDetail(contact.id)}>
                              <ArrowUpRight />
                              {t('openAction')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditForm(contact)}>
                              <Pencil />
                              {t('editAction')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => confirmDelete(contact)}
                            >
                              <Trash2 />
                              {t('deleteAction')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Pagination footer */}
          {!loading && totalCount > 0 && (
            <div className="flex items-center justify-between gap-3 border-t border-border bg-card-2 px-4 py-2 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {t('showingPagination', { start: rangeStart, end: rangeEnd, total: totalCount })}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <span className="px-2 tabular-nums">
                    {t('pageCount', { page: page + 1, total: totalPages })}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-xs"
                    disabled={!hasPrev}
                    onClick={() => setPage((p) => p - 1)}
                    aria-label={t('previousPage')}
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-xs"
                    disabled={!hasNext}
                    onClick={() => setPage((p) => p + 1)}
                    aria-label={t('nextPage')}
                  >
                    <ChevronRight />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </PageBody>

      {/* Contact Form Dialog */}
      <ContactForm
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={editContact}
        contactTags={editContactTags}
        onSaved={() => {
          fetchContacts();
          fetchTags();
        }}
        onViewExisting={(id) => {
          setFormOpen(false);
          openDetail(id);
        }}
      />

      {/* Contact Detail Sheet */}
      <ContactDetailView
        open={detailOpen}
        onOpenChange={setDetailOpen}
        contactId={detailContactId}
        onUpdated={fetchContacts}
      />

      {/* Import Modal */}
      <ImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={fetchContacts}
      />

      {/* Custom Fields Manager (admin+) */}
      {canEditSettings && (
        <CustomFieldsManager
          open={customFieldsOpen}
          onOpenChange={setCustomFieldsOpen}
        />
      )}

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('deleteContactTitle')}</DialogTitle>
            <DialogDescription>
              {t('deleteContactDesc', { name: deleteTarget?.name || deleteTarget?.phone || '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
            >
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              {t('deleteBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t('deleteBulkTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('deleteBulkDesc', { count: selected.size })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDeleteOpen(false)}
            >
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              {t('deleteBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
