'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Loader2,
  RefreshCw,
  AlertCircle,
  X,
  Pencil,
  RotateCcw,
  Send,
  Upload,
  FileText,
  Sparkles,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  uploadAccountMedia,
  MEDIA_MAX_BYTES_BY_KIND,
} from '@/lib/storage/upload-media';
import {
  MEDIA_HEADER_SPECS,
  isMediaHeaderKind,
  type MediaHeaderKind,
} from '@/lib/whatsapp/media-header-types';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';

import { SettingsPanelHead } from './settings-panel-head';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  MessageTemplate,
  TemplateButton,
  TemplateSampleValues,
} from '@/types';
import { templateStatusConfig } from '@/lib/template-status';
import {
  extractVariableIndices,
  TEMPLATE_LIMITS,
} from '@/lib/whatsapp/template-validators';
import {
  fillPlaceholders,
  humanizeTemplateName,
  nextVariableNumber,
  renumberVariables,
  TEMPLATE_EXAMPLES,
  TEMPLATE_LANGUAGES,
  toTemplateName,
  VARIABLE_PRESETS,
  type TemplateExample,
  type VariablePresetKey,
} from '@/lib/whatsapp/template-friendly';

const CATEGORIES = ['Marketing', 'Utility', 'Authentication'] as const;
type HeaderFormat = 'none' | 'text' | 'image' | 'video' | 'document';
const HEADER_FORMATS: HeaderFormat[] = ['none', 'text', 'image', 'video', 'document'];

// Categories are labels, not states — keep them neutral.
const categoryColors: Record<string, string> = {
  Marketing: 'border-border bg-muted text-muted-foreground',
  Utility: 'border-border bg-muted text-muted-foreground',
  Authentication: 'border-border bg-muted text-muted-foreground',
};

interface TemplateFormData {
  name: string;
  category: MessageTemplate['category'];
  language: string;
  header_format: HeaderFormat;
  header_content: string;
  header_media_url: string;
  header_sample: string;
  body_text: string;
  body_samples: string[];
  /** Plain-language name per {{n}} ("Customer name"), keyed by n.
   *  Editor-only — Meta stores just the number and the example. */
  var_labels: Record<number, string>;
  footer_text: string;
  buttons: TemplateButton[];
}

const emptyForm: TemplateFormData = {
  name: '',
  category: 'Marketing',
  language: 'en',
  header_format: 'none',
  header_content: '',
  header_media_url: '',
  header_sample: '',
  body_text: '',
  body_samples: [],
  var_labels: {},
  footer_text: '',
  buttons: [],
};

// Explicit key maps (not `t(\`category${x}\`)`) so the catalogue scanner
// can see every key.
const CATEGORY_LABEL_KEY = {
  Marketing: 'categoryMarketing',
  Utility: 'categoryUtility',
  Authentication: 'categoryAuthentication',
} as const;
const CATEGORY_HINT_KEY = {
  Marketing: 'categoryMarketingHint',
  Utility: 'categoryUtilityHint',
  Authentication: 'categoryAuthenticationHint',
} as const;
const VARIABLE_LABEL_KEY: Record<VariablePresetKey, 'varName' | 'varProduct' | 'varOrder' | 'varDate' | 'varAmount' | 'varOther'> = {
  name: 'varName',
  product: 'varProduct',
  order: 'varOrder',
  date: 'varDate',
  amount: 'varAmount',
  other: 'varOther',
};

function languageLabel(code: string): string {
  return TEMPLATE_LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

/** Named languages, plus the current code if it isn't one of them (a
 *  template synced from Meta can use any code). */
function languageOptions(current: string) {
  return TEMPLATE_LANGUAGES.some((l) => l.code === current) || !current
    ? TEMPLATE_LANGUAGES
    : [{ code: current, label: current }, ...TEMPLATE_LANGUAGES];
}

function emptyButton(type: TemplateButton['type']): TemplateButton {
  switch (type) {
    case 'QUICK_REPLY':
      return { type: 'QUICK_REPLY', text: '' };
    case 'URL':
      return { type: 'URL', text: '', url: '' };
    case 'PHONE_NUMBER':
      return { type: 'PHONE_NUMBER', text: '', phone_number: '' };
    case 'COPY_CODE':
      return { type: 'COPY_CODE', text: '', example: '' };
  }
}

export function TemplateManager() {
  const t = useTranslations('Settings.templates');
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();

  const headerLabel = (type: HeaderFormat) =>
    type === 'none'
      ? t('headerNone')
      : type === 'text'
        ? t('headerText')
        : type === 'image'
          ? t('headerImage')
          : type === 'video'
            ? t('headerVideo')
            : t('headerDocument');
  const buttonTypeLabel = (type: TemplateButton['type']) =>
    type === 'URL'
      ? t('btnUrl')
      : type === 'PHONE_NUMBER'
        ? t('btnPhone')
        : type === 'COPY_CODE'
          ? t('btnCopyCode')
          : t('btnQuickReply');

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState<TemplateFormData>(emptyForm);
  // Non-null when the dialog is editing an existing row — switches the
  // submit handler from POST /submit to PATCH /[id] and changes the
  // dialog title + CTA. Set to the template id to pre-fill from a row.
  const [editingId, setEditingId] = useState<string | null>(null);
  // Non-null when the dialog is submitting a DRAFT row (never sent to
  // Meta, or a submit that failed). It goes through POST /submit like
  // a new template; this id lets us clean up the old row if the user
  // renamed it before submitting.
  const [draftId, setDraftId] = useState<string | null>(null);
  // Meta name of the template being edited. The name field shows a
  // humanised label and is locked while editing, so the PATCH must use
  // the stored name verbatim rather than re-deriving it from the label.
  const [editingName, setEditingName] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Template selected for the confirm-delete dialog. The destructive
  // action goes through this two-step so a slip on the trash icon
  // doesn't take the template off Meta as well as locally.
  const [templateToDelete, setTemplateToDelete] =
    useState<MessageTemplate | null>(null);
  // Header-media upload (image #230; video/document #562). Uploads to the
  // account-scoped chat-media bucket and stores the public URL in
  // header_media_url; the submit route turns that into a Meta
  // Resumable-Upload handle.
  const [uploadingHeader, setUploadingHeader] = useState(false);
  const headerFileRef = useRef<HTMLInputElement>(null);

  // Body variable indices — `[1, 2, 3]` for "{{1}} {{2}} {{3}}". We
  // re-run the extractor on every render to keep the sample-value rows
  // in sync with what the user typed.
  const bodyVarCount = useMemo(
    () => extractVariableIndices(form.body_text).length,
    [form.body_text],
  );
  const bodyIndices = useMemo(
    () => extractVariableIndices(form.body_text),
    [form.body_text],
  );
  const headerVarCount = useMemo(
    () =>
      form.header_format === 'text'
        ? extractVariableIndices(form.header_content).length
        : 0,
    [form.header_format, form.header_content],
  );

  // Resize body_samples so it always has exactly bodyVarCount entries.
  // (We mutate via setForm in an effect so React owns the state.)
  useEffect(() => {
    setForm((prev) => {
      if (prev.body_samples.length === bodyVarCount) return prev;
      const next = prev.body_samples.slice(0, bodyVarCount);
      while (next.length < bodyVarCount) next.push('');
      return { ...prev, body_samples: next };
    });
  }, [bodyVarCount]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    fetchTemplates(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  async function fetchTemplates(userId: string) {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
      toast.error(t('toastLoadFailed'));
    } finally {
      setLoading(false);
    }
  }

  function buildSubmitPayload() {
    const sample_values: TemplateSampleValues = {};
    if (form.body_samples.some((v) => v.trim())) {
      sample_values.body = form.body_samples.map((v) => v.trim());
    }
    if (form.header_format === 'text' && form.header_sample.trim()) {
      sample_values.header = [form.header_sample.trim()];
    }

    return {
      name: editingName ?? toTemplateName(form.name),
      category: form.category,
      language: form.language.trim() || 'en',
      header_type: form.header_format === 'none' ? undefined : form.header_format,
      header_content:
        form.header_format === 'text' ? form.header_content.trim() : undefined,
      header_media_url:
        form.header_format !== 'none' && form.header_format !== 'text'
          ? form.header_media_url.trim() || undefined
          : undefined,
      // Renumber so a detail deleted mid-body ("{{1}} … {{3}}") still
      // submits as the contiguous {{1}}, {{2}} Meta requires. Samples
      // are aligned to the sorted numbers, so they stay valid as-is.
      body_text: renumberVariables(form.body_text.trim()),
      footer_text: form.footer_text.trim() || undefined,
      buttons: form.buttons.length > 0 ? form.buttons : undefined,
      sample_values:
        Object.keys(sample_values).length > 0 ? sample_values : undefined,
    };
  }

  function formFromTemplate(template: MessageTemplate): TemplateFormData {
    return {
      name: humanizeTemplateName(template.name),
      category: template.category,
      language: template.language || 'en_US',
      header_format: (template.header_type ?? 'none') as HeaderFormat,
      header_content: template.header_content ?? '',
      header_media_url: template.header_media_url ?? '',
      header_sample: template.sample_values?.header?.[0] ?? '',
      body_text: template.body_text,
      body_samples: template.sample_values?.body ?? [],
      var_labels: {},
      footer_text: template.footer_text ?? '',
      buttons: template.buttons ?? [],
    };
  }

  function openEdit(template: MessageTemplate) {
    setEditingId(template.id);
    setEditingName(template.name);
    setDraftId(null);
    setForm(formFromTemplate(template));
    setDialogOpen(true);
  }

  function openSubmitDraft(template: MessageTemplate) {
    setEditingId(null);
    setEditingName(null);
    setDraftId(template.id);
    setForm(formFromTemplate(template));
    setDialogOpen(true);
  }

  function openCreate() {
    setEditingId(null);
    setEditingName(null);
    setDraftId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function applyExample(example: TemplateExample) {
    setForm((prev) => ({
      ...emptyForm,
      language: prev.language,
      name: example.title,
      category: example.category,
      body_text: example.body,
      body_samples: [...example.samples],
      var_labels: Object.fromEntries(
        example.details.map((key, i) => [i + 1, t(VARIABLE_LABEL_KEY[key])]),
      ),
      footer_text: example.footer ?? '',
      buttons: (example.quickReplies ?? []).map((text) => ({
        type: 'QUICK_REPLY' as const,
        text,
      })),
    }));
  }

  // Insert the next {{n}} at the cursor, pre-filling its example so
  // Meta's review has a sample without the user thinking about it.
  function insertVariable(preset: VariablePresetKey) {
    const spec = VARIABLE_PRESETS.find((p) => p.key === preset)!;
    const n = nextVariableNumber(form.body_text);
    const token = `{{${n}}}`;
    const el = bodyRef.current;
    const start = el?.selectionStart ?? form.body_text.length;
    const end = el?.selectionEnd ?? form.body_text.length;
    const body = form.body_text.slice(0, start) + token + form.body_text.slice(end);
    if (body.length > TEMPLATE_LIMITS.bodyMaxLength) return;
    // n is above every existing number, so its sample sorts last.
    const samples = form.body_samples.slice(0, bodyIndices.length);
    setForm({
      ...form,
      body_text: body,
      body_samples: [...samples, spec.example],
      var_labels: { ...form.var_labels, [n]: t(VARIABLE_LABEL_KEY[preset]) },
    });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function handleSubmit() {
    // AUTHENTICATION is blocked by the persistent banner + disabled
    // submit button; this is a defensive second line of defense.
    if (form.category === 'Authentication') return;
    if (!editingName && !toTemplateName(form.name)) {
      toast.error(t('nameRequired'));
      return;
    }
    try {
      setSubmitting(true);
      const isEdit = editingId !== null;
      const url = isEdit
        ? `/api/whatsapp/templates/${editingId}`
        : '/api/whatsapp/templates/submit';
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSubmitPayload()),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data?.error || t(isEdit ? 'editFailedHttp' : 'submitFailedHttp', { status: res.status }),
        );
      }
      // The submit upserts on (user_id, name, language), so a draft
      // that was renamed lands in a new row. Drop the old local-only
      // draft so it doesn't linger next to the submitted one.
      if (draftId && data.template?.id && data.template.id !== draftId) {
        await fetch(`/api/whatsapp/templates/${draftId}`, { method: 'DELETE' });
      }
      // Refresh first, then close — re-opening the dialog
      // immediately should not show a stale list.
      if (user) await fetchTemplates(user.id);
      toast.success(
        data.dry_run
          ? isEdit
            ? t('toastSaveEditDry')
            : t('toastSaveNewDry')
          : isEdit
            ? t('toastSubmitEditSuccess')
            : t('toastSubmitNewSuccess'),
      );
      setDialogOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      setEditingName(null);
      setDraftId(null);
    } catch (err) {
      console.error('Submit error:', err);
      toast.error(err instanceof Error ? err.message : t('toastSubmitFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSyncFromMeta() {
    if (!user) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/whatsapp/templates/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Sync failed (HTTP ${res.status})`);
      }
      toast.success(
        t('toastSyncCount', { total: data.total }) +
          (data.inserted || data.updated
            ? t('toastSyncDetails', { inserted: data.inserted, updated: data.updated })
            : ''),
      );
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        const preview = data.errors.slice(0, 3).map(
          (e: { name: string; language: string; message: string }) =>
            `${e.name} (${e.language})`,
        );
        const suffix =
          data.errors.length > 3 ? `, +${data.errors.length - 3} more` : '';
        toast.error(t('toastSyncFailed', { preview: preview.join(', ') + suffix }));
      }
      if (data.truncated) {
        // Use error (not warning) so the message survives long
        // enough to read — sonner's `warning` auto-dismisses on
        // the same short timer as `success`.
        toast.error(
          t('toastSyncTruncated'),
          { duration: 10000 },
        );
      }
      await fetchTemplates(user.id);
    } catch (err) {
      console.error('Template sync error:', err);
      toast.error(err instanceof Error ? err.message : t('toastSyncError'));
    } finally {
      setSyncing(false);
    }
  }

  async function confirmDelete() {
    const target = templateToDelete;
    if (!target || deletingId) return;
    setDeletingId(target.id);
    try {
      // Route handler scopes the Meta delete via hsm_id (so sibling
      // language variants survive) and falls through to remove the
      // local row. Local-only rows skip the Meta call.
      const res = await fetch(`/api/whatsapp/templates/${target.id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Delete failed (HTTP ${res.status})`);
      }
      toast.success(t('toastDeleteSuccess'));
      setTemplates((prev) => prev.filter((t) => t.id !== target.id));
      setTemplateToDelete(null);
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(err instanceof Error ? err.message : t('toastDeleteError'));
    } finally {
      setDeletingId(null);
    }
  }

  // The patch type unions every field across button variants. The
  // conditional rendering below ensures only fields valid for the
  // current button's `type` reach this function, so the runtime
  // assertion + per-type spread preserves discriminated-union
  // invariants without forcing every call site to thread the type
  // through generics (which TS can't infer from a partial literal).
  type ButtonPatch = {
    text?: string;
    url?: string;
    phone_number?: string;
    example?: string;
  };
  function updateButton(index: number, patch: ButtonPatch) {
    setForm((prev) => {
      const current = prev.buttons[index];
      if (!current) return prev;
      const next = [...prev.buttons];
      // Per-variant spread keeps the discriminant pinned. Switch
      // exhaustiveness is enforced by TypeScript.
      switch (current.type) {
        case 'QUICK_REPLY':
          next[index] = {
            ...current,
            ...(patch.text !== undefined && { text: patch.text }),
          };
          break;
        case 'URL':
          next[index] = {
            ...current,
            ...(patch.text !== undefined && { text: patch.text }),
            ...(patch.url !== undefined && { url: patch.url }),
            ...(patch.example !== undefined && { example: patch.example }),
          };
          break;
        case 'PHONE_NUMBER':
          next[index] = {
            ...current,
            ...(patch.text !== undefined && { text: patch.text }),
            ...(patch.phone_number !== undefined && {
              phone_number: patch.phone_number,
            }),
          };
          break;
        case 'COPY_CODE':
          next[index] = {
            ...current,
            ...(patch.text !== undefined && { text: patch.text }),
            ...(patch.example !== undefined && { example: patch.example }),
          };
          break;
      }
      return { ...prev, buttons: next };
    });
  }

  function changeButtonType(index: number, type: TemplateButton['type']) {
    setForm((prev) => {
      const next = [...prev.buttons];
      next[index] = emptyButton(type);
      return { ...prev, buttons: next };
    });
  }

  function removeButton(index: number) {
    setForm((prev) => ({
      ...prev,
      buttons: prev.buttons.filter((_, i) => i !== index),
    }));
  }

  function addButton() {
    if (form.buttons.length >= TEMPLATE_LIMITS.maxButtonsTotal) return;
    setForm((prev) => ({
      ...prev,
      buttons: [...prev.buttons, emptyButton('QUICK_REPLY')],
    }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const headerNeedsMedia =
    form.header_format !== 'none' && form.header_format !== 'text';
  const headerMediaKind: MediaHeaderKind | null = isMediaHeaderKind(
    form.header_format,
  )
    ? form.header_format
    : null;

  // Per-kind copy for the file picker. Kept as explicit key maps (not
  // `t(\`upload${kind}\`)`) so the catalogue scanner can see every key.
  const uploadLabelKey = {
    image: 'uploadImage',
    video: 'uploadVideo',
    document: 'uploadDocument',
  } as const;
  const uploadHintKey = {
    image: 'uploadHint',
    video: 'uploadHintVideo',
    document: 'uploadHintDocument',
  } as const;
  const invalidTypeKey = {
    image: 'toastInvalidImage',
    video: 'toastInvalidVideo',
    document: 'toastInvalidDocument',
  } as const;

  async function handleHeaderMediaFile(file: File, kind: MediaHeaderKind) {
    if (!MEDIA_HEADER_SPECS[kind].mimeTypes.includes(file.type)) {
      toast.error(t(invalidTypeKey[kind]));
      return;
    }
    // The upload lands in the chat-media bucket, whose 16 MB ceiling is
    // below Meta's 100 MB document cap — so this is the bucket-side
    // limit, not Meta's. A larger document can still be pasted as a link.
    const maxBytes = MEDIA_MAX_BYTES_BY_KIND[kind];
    if (file.size > maxBytes) {
      toast.error(
        t('toastMediaTooLarge', {
          size: (file.size / 1024 / 1024).toFixed(1),
          max: Math.round(maxBytes / 1024 / 1024),
        }),
      );
      return;
    }
    setUploadingHeader(true);
    try {
      const { publicUrl } = await uploadAccountMedia('chat-media', file);
      setForm((f) => ({ ...f, header_media_url: publicUrl }));
      toast.success(t('toastUploadSuccess'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('toastUploadFailed'));
    } finally {
      setUploadingHeader(false);
    }
  }

  return (
    <section className="space-y-4">
      <SettingsPanelHead
        title={t('title')}
        description={t('description')}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSyncFromMeta}
              disabled={syncing}
              title={t('syncTitle')}
            >
              <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? t('syncing') : t('syncFromMeta')}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              {t('newTemplate')}
            </Button>
          </div>
        }
      />

      {templates.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icon={FileText}
            title={t('noTemplates')}
            description={t('createFirst')}
          />
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {templates.map((template) => {
            const statusKey = template.status || 'DRAFT';
            const status = templateStatusConfig[statusKey];
            return (
              <li key={template.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        className="text-[13px] font-medium text-foreground"
                        title={template.name}
                      >
                        {humanizeTemplateName(template.name)}
                      </h3>
                      <Badge className={status.classes}>
                        {status.label}
                      </Badge>
                      <Badge className={categoryColors[template.category] || ''}>
                        {template.category}
                      </Badge>
                      {template.language && (
                        <span className="text-[11px] text-muted-foreground">
                          {template.language}
                        </span>
                      )}
                      {template.quality_score && (
                        <span
                          className={`text-[10px] uppercase font-medium ${
                            template.quality_score === 'GREEN'
                              ? 'text-success'
                              : template.quality_score === 'YELLOW'
                                ? 'text-warning'
                                : 'text-destructive'
                          }`}
                          title={t('qualityScoreTitle')}
                        >
                          {template.quality_score}
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-2 text-[13px] text-muted-foreground">
                      {template.body_text}
                    </p>
                    {template.footer_text && (
                      <p className="text-xs text-muted-foreground italic">
                        {template.footer_text}
                      </p>
                    )}
                    {(template.rejection_reason || template.submission_error) && (
                      <div className="flex items-start gap-1.5 rounded-md border border-destructive/25 bg-destructive/8 px-2 py-1.5 text-xs text-destructive">
                        <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
                        <span>
                          {template.rejection_reason || template.submission_error}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {statusKey === 'DRAFT' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openSubmitDraft(template)}
                        title={t('submitDraftTitle')}
                        aria-label={t('submitDraftLabel')}
                      >
                        <Send className="size-3.5" />
                        {t('submitDraft')}
                      </Button>
                    )}
                    {statusKey === 'APPROVED' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(template)}
                        title={t('editTitle')}
                        aria-label={t('editLabel')}
                      >
                        <Pencil className="size-3.5" />
                        {t('edit')}
                      </Button>
                    )}
                    {(statusKey === 'REJECTED' || statusKey === 'PAUSED') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(template)}
                        title={t('resubmitTitle')}
                        aria-label={t('resubmitLabel')}
                      >
                        <RotateCcw className="size-3.5" />
                        {t('resubmit')}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setTemplateToDelete(template)}
                      disabled={deletingId === template.id}
                      aria-label={
                        template.meta_template_id
                          ? t('deleteMetaLocallyAria')
                          : t('deleteLocallyAria')
                      }
                      title={
                        template.meta_template_id
                          ? t('deleteMetaLocallyTitle')
                          : t('deleteLocallyTitle')
                      }
                      className="text-muted-foreground hover:bg-destructive/8 hover:text-destructive"
                    >
                      {deletingId === template.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                  </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingId(null);
            setEditingName(null);
            setDraftId(null);
            setForm(emptyForm);
          }
        }}
      >
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t('dialogEditTitle') : t('dialogNewTitle')}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? t('dialogEditDesc')
                : t('dialogNewDesc')}
            </DialogDescription>
          </DialogHeader>

          {form.category === 'Authentication' && (
            <div className="flex items-start gap-2 rounded border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              <AlertCircle className="size-4 mt-0.5 shrink-0" />
              <p>{t.rich('authWarning', { bold: (chunks) => <strong>{chunks}</strong> })}</p>
            </div>
          )}

          {!editingId && !draftId && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Sparkles className="size-3.5" />
                {t('startFromExample')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_EXAMPLES.map((example) => (
                  <button
                    key={example.title}
                    type="button"
                    onClick={() => applyExample(example)}
                    className="cursor-pointer rounded-full border border-border bg-card px-2.5 py-1 text-xs text-foreground transition-colors hover:border-border-strong hover:bg-card-2"
                  >
                    {example.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-6 py-2 md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="min-w-0 space-y-4">
            <div className="space-y-2">
              <Label>{t('templateName')}</Label>
              <Input
                placeholder={t('namePlaceholder')}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                disabled={editingId !== null}
                className="disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <p className="text-[11px] text-muted-foreground">
                {editingId
                  ? t('nameFixed')
                  : toTemplateName(form.name)
                    ? t('nameSavedAs', { name: toTemplateName(form.name) })
                    : t('nameHint')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('category')}</Label>
                <Select
                  value={form.category}
                  onValueChange={(val) =>
                    setForm({
                      ...form,
                      category: val as MessageTemplate['category'],
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(v: string) => t(CATEGORY_LABEL_KEY[v as MessageTemplate['category']] ?? 'categoryMarketing')}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem
                        key={cat}
                        value={cat}
                        className="text-popover-foreground focus:bg-muted focus:text-popover-foreground"
                      >
                        <span className="flex flex-col">
                          <span>{t(CATEGORY_LABEL_KEY[cat])}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {t(CATEGORY_HINT_KEY[cat])}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('language')}</Label>
                <Select
                  value={form.language}
                  onValueChange={(val) => val && setForm({ ...form, language: val })}
                  disabled={editingId !== null}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(v: string) => languageLabel(v)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {languageOptions(form.language).map((lang) => (
                      <SelectItem
                        key={lang.code}
                        value={lang.code}
                        className="text-popover-foreground focus:bg-muted focus:text-popover-foreground"
                      >
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {editingId ? t('langFixed') : t('langHintFriendly')}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('header')}</Label>
              <Select
                value={form.header_format}
                onValueChange={(val) =>
                  // Preserve header_content, header_media_url, and
                  // header_sample across format switches. The submit
                  // payload builder only reads the field that matches
                  // the active format, so an orphan value on a hidden
                  // field is harmless — and keeping it lets the user
                  // switch formats to compare without losing typing.
                  setForm({
                    ...form,
                    header_format: (val || 'none') as HeaderFormat,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(v: string) => headerLabel(v as HeaderFormat)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {HEADER_FORMATS.map((type) => (
                    <SelectItem
                      key={type}
                      value={type}
                      className="text-popover-foreground focus:bg-muted focus:text-popover-foreground"
                    >
                      {headerLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {form.header_format === 'text' && (
                <div className="space-y-2 mt-2">
                  <Input
                    id="template-header-text"
                    aria-label={t('headerTextLabel')}
                    placeholder={t.raw('headerTextPlaceholder')}
                    value={form.header_content}
                    onChange={(e) =>
                      setForm({ ...form, header_content: e.target.value })
                    }
                    maxLength={TEMPLATE_LIMITS.headerTextMaxLength}
                  />
                  {headerVarCount > 0 && (
                    <Input
                      id="template-header-sample"
                      aria-label={t('headerSampleAria')}
                      placeholder={t.raw('headerSamplePlaceholder')}
                      value={form.header_sample}
                      onChange={(e) =>
                        setForm({ ...form, header_sample: e.target.value })
                      }
                    />
                  )}
                </div>
              )}

              {headerNeedsMedia && (
                <div className="space-y-2 mt-2">
                  {headerMediaKind && (
                    <div className="flex items-center gap-2">
                      <input
                        ref={headerFileRef}
                        type="file"
                        accept={MEDIA_HEADER_SPECS[headerMediaKind].mimeTypes.join(',')}
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleHeaderMediaFile(f, headerMediaKind);
                          e.target.value = '';
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingHeader}
                        onClick={() => headerFileRef.current?.click()}
                      >
                        {uploadingHeader ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        {t(uploadLabelKey[headerMediaKind])}
                      </Button>
                      <span className="text-[11px] text-muted-foreground">
                        {t(uploadHintKey[headerMediaKind])}
                      </span>
                    </div>
                  )}
                  <Input
                    placeholder={t('mediaUrlPlaceholder', { format: form.header_format })}
                    value={form.header_media_url}
                    onChange={(e) =>
                      setForm({ ...form, header_media_url: e.target.value })
                    }
                  />
                  {form.header_format === 'image' && form.header_media_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.header_media_url}
                      alt="Header sample"
                      className="max-h-28 rounded-md border border-border object-contain"
                    />
                  )}
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {form.header_format === 'image'
                      ? t('imageHint')
                      : t('mediaHint')}
                    {form.header_format === 'video' &&
                      t('videoHint')}
                    {form.header_format === 'document' &&
                      t('documentHint')}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('bodyText')}</Label>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">{t('addDetail')}</span>
                {VARIABLE_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => insertVariable(preset.key)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-foreground transition-colors hover:border-border-strong hover:bg-card-2"
                  >
                    <Plus className="size-3" />
                    {t(VARIABLE_LABEL_KEY[preset.key])}
                  </button>
                ))}
              </div>
              <Textarea
                ref={bodyRef}
                placeholder={t.raw('bodyPlaceholderFriendly')}
                value={form.body_text}
                onChange={(e) =>
                  setForm({ ...form, body_text: e.target.value })
                }
                rows={4}
                maxLength={TEMPLATE_LIMITS.bodyMaxLength}
                className="resize-none"
              />
              <p className="text-[11px] text-muted-foreground">
                {t('bodyHintFriendly')}
              </p>

              {bodyVarCount > 0 && (
                <div className="space-y-1.5 pt-1">
                  <Label className="text-[11px]">
                    {t('sampleValuesFriendly')}
                  </Label>
                  {form.body_samples.map((val, i) => {
                    const inputId = `template-body-sample-${i}`;
                    const n = bodyIndices[i] ?? i + 1;
                    const label = form.var_labels[n] ?? t('detailN', { n: i + 1 });
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-32 shrink-0 truncate text-[11px] text-muted-foreground" title={`{{${n}}}`}>
                          {label}
                        </span>
                        <Input
                          id={inputId}
                          aria-label={t('sampleAria', { var: label })}
                          placeholder={t('samplePlaceholderFriendly')}
                          value={val}
                          onChange={(e) => {
                            const next = [...form.body_samples];
                            next[i] = e.target.value;
                            setForm({ ...form, body_samples: next });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('footer')}</Label>
              <Input
                placeholder={t('footerPlaceholder')}
                value={form.footer_text}
                onChange={(e) =>
                  setForm({ ...form, footer_text: e.target.value })
                }
                maxLength={TEMPLATE_LIMITS.footerMaxLength}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('buttons')}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addButton}
                  disabled={form.buttons.length >= TEMPLATE_LIMITS.maxButtonsTotal}
                  className="h-7 text-xs"
                >
                  <Plus className="size-3" />
                  {t('addButton')}
                </Button>
              </div>
              {form.buttons.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  {t('buttonsLimit', { max: TEMPLATE_LIMITS.maxButtonsTotal })}
                </p>
              ) : (
                <div className="space-y-2">
                  {form.buttons.map((btn, i) => (
                    <div
                      key={i}
                      className="space-y-2 rounded border border-border bg-muted/50 p-2"
                    >
                      <div className="flex items-center gap-2">
                        <Select
                          value={btn.type}
                          onValueChange={(val) => {
                            // Same null guard as the Header Select
                            // (per PR 148): @base-ui Select fires
                            // onValueChange(null) on deselect.
                            if (!val) return;
                            changeButtonType(i, val as TemplateButton['type']);
                          }}
                        >
                          <SelectTrigger className="w-44 h-8 text-xs">
                            <SelectValue>
                              {(v: string) => buttonTypeLabel(v as TemplateButton['type'])}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              value="QUICK_REPLY"
                              className="text-popover-foreground focus:bg-muted focus:text-popover-foreground"
                            >
                              {t('btnQuickReply')}
                            </SelectItem>
                            <SelectItem
                              value="URL"
                              className="text-popover-foreground focus:bg-muted focus:text-popover-foreground"
                            >
                              {t('btnUrl')}
                            </SelectItem>
                            <SelectItem
                              value="PHONE_NUMBER"
                              className="text-popover-foreground focus:bg-muted focus:text-popover-foreground"
                            >
                              {t('btnPhone')}
                            </SelectItem>
                            <SelectItem
                              value="COPY_CODE"
                              className="text-popover-foreground focus:bg-muted focus:text-popover-foreground"
                            >
                              {t('btnCopyCode')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder={t('btnLabelPlaceholder')}
                          value={btn.text}
                          maxLength={TEMPLATE_LIMITS.buttonTextMaxLength}
                          onChange={(e) =>
                            updateButton(i, { text: e.target.value })
                          }
                          className="flex-1 h-8 text-xs"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeButton(i)}
                          className="hover:text-destructive hover:bg-destructive/10 size-7"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                      {btn.type === 'URL' && (
                        <div className="space-y-1 pl-1">
                          <Input
                            placeholder={t.raw('urlPlaceholder')}
                            value={btn.url}
                            onChange={(e) =>
                              updateButton(i, { url: e.target.value })
                            }
                            className="h-8 text-xs"
                          />
                          {extractVariableIndices(btn.url).length > 0 && (
                            <Input
                              placeholder={t.raw('urlSamplePlaceholder')}
                              value={btn.example ?? ''}
                              onChange={(e) =>
                                updateButton(i, { example: e.target.value })
                              }
                              className="h-8 text-xs"
                            />
                          )}
                        </div>
                      )}
                      {btn.type === 'PHONE_NUMBER' && (
                        <Input
                          placeholder={t('phonePlaceholder')}
                          value={btn.phone_number}
                          onChange={(e) =>
                            updateButton(i, { phone_number: e.target.value })
                          }
                          className="h-8 text-xs"
                        />
                      )}
                      {btn.type === 'COPY_CODE' && (
                        <Input
                          placeholder={t('codePlaceholder')}
                          value={btn.example}
                          onChange={(e) =>
                            updateButton(i, { example: e.target.value })
                          }
                          className="h-8 text-xs"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
            <div className="self-start md:sticky md:top-0">
              <TemplatePreview
                form={form}
                previewLabel={t('preview')}
                previewHint={t('previewHint')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || form.category === 'Authentication'}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {editingId ? t('saving') : t('submitting')}
                </>
              ) : editingId ? (
                t('saveResubmit')
              ) : (
                t('submitApproval')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm-delete dialog. Surfacing the meta_template_id case
          separately so users understand a real Meta delete is happening,
          not just a local cleanup. */}
      <Dialog
        open={templateToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setTemplateToDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('deleteDialogTitle')}</DialogTitle>
            <DialogDescription>
              {templateToDelete?.meta_template_id
                ? t('deleteMetaDesc', { name: templateToDelete.name })
                : t('deleteLocalDesc', { name: templateToDelete?.name || '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTemplateToDelete(null)}
              disabled={deletingId !== null}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deletingId !== null}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {deletingId !== null ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t('deleting')}
                </>
              ) : (
                t('delete')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/**
 * What the customer will see: the message as a WhatsApp bubble with
 * every {{n}} filled from its example and *bold* / _italic_ rendered.
 */
function TemplatePreview({
  form,
  previewLabel,
  previewHint,
}: {
  form: TemplateFormData;
  previewLabel: string;
  previewHint: string;
}) {
  const body = fillPlaceholders(form.body_text, form.body_samples);
  const header =
    form.header_format === 'text'
      ? fillPlaceholders(form.header_content, [form.header_sample])
      : '';
  const buttons = form.buttons.filter((b) => b.text.trim());
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{previewLabel}</p>
      <div className="rounded-lg border border-border bg-muted p-3">
        <div className="rounded-lg rounded-tl-none bg-card px-3 py-2 text-[13px] text-foreground shadow-xs">
          {form.header_format !== 'none' && form.header_format !== 'text' && (
            <div className="mb-2 flex h-24 items-center justify-center overflow-hidden rounded-md bg-muted text-[11px] text-muted-foreground uppercase">
              {form.header_format === 'image' && form.header_media_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.header_media_url} alt="" className="h-full w-full object-cover" />
              ) : (
                form.header_format
              )}
            </div>
          )}
          {header && <p className="mb-1 font-semibold">{header}</p>}
          <p className="break-words whitespace-pre-wrap">
            {body.trim() ? <WhatsAppText text={body} /> : <span className="text-muted-foreground">…</span>}
          </p>
          {form.footer_text.trim() && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">{form.footer_text}</p>
          )}
          <p className="mt-1 text-right text-[10px] text-muted-foreground tabular-nums">12:00</p>
        </div>
        {buttons.length > 0 && (
          <div className="mt-1 space-y-1">
            {buttons.map((b, i) => (
              <div
                key={i}
                className="rounded-lg bg-card px-3 py-1.5 text-center text-[13px] font-medium text-primary shadow-xs"
              >
                {b.text}
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{previewHint}</p>
    </div>
  );
}

/** Renders WhatsApp's *bold*, _italic_ and ~strike~ markers. */
function WhatsAppText({ text }: { text: string }) {
  const parts = text.split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
          return <strong key={i}>{part.slice(1, -1)}</strong>;
        }
        if (part.length > 2 && part.startsWith('_') && part.endsWith('_')) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        if (part.length > 2 && part.startsWith('~') && part.endsWith('~')) {
          return <s key={i}>{part.slice(1, -1)}</s>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
