'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Loader2, FileText, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

// Categories are labels, not states — keep them neutral.
const categoryColors: Record<string, string> = {
  Marketing: 'border-border bg-muted text-muted-foreground',
  Utility: 'border-border bg-muted text-muted-foreground',
  Authentication: 'border-border bg-muted text-muted-foreground',
};

interface Step1Props {
  selectedTemplate: MessageTemplate | null;
  onSelect: (template: MessageTemplate) => void;
  onNext: () => void;
  onBack: () => void;
}

export function Step1ChooseTemplate({ selectedTemplate, onSelect, onNext, onBack }: Step1Props) {
  const t = useTranslations('Broadcasts.wizard');
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const supabase = createClient();
        // Only APPROVED templates can be sent via Meta — anything else
        // would 400 at broadcast time. Hide them rather than letting
        // the user pick a template that will fail.
        const { data, error: fetchError } = await supabase
          .from('message_templates')
          .select('*')
          .eq('status', 'APPROVED')
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        setTemplates(data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('chooseTemplate.errorLoad'));
      } finally {
        setLoading(false);
      }
    }

    fetchTemplates();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[15px] font-semibold text-foreground">{t('chooseTemplate.title')}</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {t('chooseTemplate.subtitle')}
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-md border border-dashed border-border">
          <EmptyState
            size="sm"
            icon={FileText}
            title={t('chooseTemplate.noTemplates')}
            description={t('chooseTemplate.createFirst')}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => {
            const isSelected = selectedTemplate?.id === template.id;
            const catColor = categoryColors[template.category] ?? categoryColors.Utility;

            return (
              <button
                key={template.id}
                onClick={() => onSelect(template)}
                className={`flex cursor-pointer flex-col gap-2 rounded-md border p-3.5 text-left transition-colors ${
                  isSelected
                    ? 'border-primary/40 bg-primary-soft ring-1 ring-primary/20'
                    : 'border-border bg-card hover:border-border hover:bg-card'
                }`}
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-medium text-foreground">{template.name}</h3>
                  <span
                    className={`inline-flex h-5 shrink-0 items-center rounded-[4px] border px-1.5 text-[10px] font-medium ${catColor}`}
                  >
                    {template.category}
                  </span>
                </div>
                <p className="line-clamp-3 text-xs text-muted-foreground">{template.body_text}</p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{template.language ?? 'en_US'}</span>
                  {/* Status is omitted on purpose — every template
                      shown here is already filtered to APPROVED,
                      so the chip carried no information. */}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button variant="outline" onClick={onBack}>
          {t('back')}
        </Button>
        <Button
          onClick={onNext}
          disabled={!selectedTemplate}
        >
          {t('next')}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
