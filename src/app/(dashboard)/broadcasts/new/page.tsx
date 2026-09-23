'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { MessageTemplate } from '@/types';
import { Step1ChooseTemplate } from '@/components/broadcasts/step1-choose-template';
import { Step2SelectAudience } from '@/components/broadcasts/step2-select-audience';
import { Step3Personalize } from '@/components/broadcasts/step3-personalize';
import { Step4ScheduleSend } from '@/components/broadcasts/step4-schedule-send';
import { useBroadcastSending } from '@/hooks/use-broadcast-sending';
import { Check } from 'lucide-react';
import { Page, PageBody, PageHeader } from '@/components/layout/page';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

const steps = [
  { label: 'template', key: 'template' },
  { label: 'audience', key: 'audience' },
  { label: 'personalize', key: 'personalize' },
  { label: 'send', key: 'send' },
] as const;

export default function NewBroadcastPage() {
  const router = useRouter();
  const t = useTranslations('Broadcasts.new');
  const { accountId } = useAuth();
  const { createAndSendBroadcast, isProcessing, progress } = useBroadcastSending();

  const [currentStep, setCurrentStep] = useState(0);
  const [template, setTemplate] = useState<MessageTemplate | null>(null);
  const [audience, setAudience] = useState<{
    type: 'all' | 'tags' | 'custom_field' | 'csv';
    tagIds?: string[];
    customField?: {
      fieldId: string;
      operator: 'is' | 'is_not' | 'contains';
      value: string;
    };
    csvContacts?: { phone: string; name?: string }[];
    excludeTagIds?: string[];
  }>({ type: 'all' });
  const [variables, setVariables] = useState<
    Record<string, { type: 'static' | 'field' | 'custom_field'; value: string }>
  >({});
  const [headerMediaUrl, setHeaderMediaUrl] = useState('');
  const [name, setName] = useState('');

  async function handleSend() {
    if (!template) return;

    try {
      const broadcastId = await createAndSendBroadcast({
        name,
        template,
        audience: {
          type: audience.type,
          tagIds: audience.tagIds,
          customField: audience.customField,
          csvContacts: audience.csvContacts,
          excludeTagIds: audience.excludeTagIds,
        },
        variables,
        headerMediaUrl,
      });
      router.push(`/broadcasts/${broadcastId}`);
    } catch (err) {
      // Previously swallowed with console.error — the wizard would
      // just no-op, leaving the user confused. Surface the reason.
      const message = err instanceof Error ? err.message : 'Broadcast failed';
      console.error('Broadcast failed:', err);
      toast.error(message);
    }
  }

  /**
   * Writes a draft broadcast row — no recipients, no sending. The user
   * can revisit it via the list page to finish the flow later. We
   * don't persist the in-progress audience/variable config here
   * because the current schema doesn't carry it past `audience_filter`
   * and `template_variables`; those are enough for the user to
   * recognize the draft but not to exactly round-trip into the wizard.
   * A full resume-draft UX is a future polish.
   */
  async function handleSaveDraft() {
    if (!template || !name.trim()) {
      toast.error(t('toastGiveName'));
      return;
    }
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      toast.error(t('toastNotSignedIn'));
      return;
    }
    if (!accountId) {
      toast.error(t('toastNotLinked'));
      return;
    }

    const { error } = await supabase.from('broadcasts').insert({
      user_id: user.id,
      account_id: accountId,
      name: name.trim(),
      template_name: template.name,
      template_language: template.language ?? 'en_US',
      template_variables: variables,
      audience_filter: {
        type: audience.type,
        tagIds: audience.tagIds,
      },
      status: 'draft',
      total_recipients: 0,
      sent_count: 0,
      delivered_count: 0,
      read_count: 0,
      replied_count: 0,
      failed_count: 0,
    });

    if (error) {
      toast.error(t('toastFailedDraft', { error: error.message }));
      return;
    }
    toast.success(t('toastDraftSaved'));
    router.push('/broadcasts');
  }

  return (
    <Page>
      <PageHeader
        back="/broadcasts"
        backLabel={t('back')}
        title={t('title')}
        description={t('subtitle')}
      />

      <PageBody>
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Step indicator */}
          <ol className="flex items-center gap-2" aria-label={t('stepsLabel')}>
            {steps.map((step, index) => {
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;

              return (
                <li key={step.key} className="flex flex-1 items-center gap-2">
                  <div
                    className="flex items-center gap-2"
                    aria-current={isActive ? 'step' : undefined}
                  >
                    <span
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-colors',
                        isCompleted
                          ? 'bg-primary text-primary-foreground'
                          : isActive
                            ? 'bg-foreground text-background'
                            : 'border border-border-strong text-muted-foreground',
                      )}
                    >
                      {isCompleted ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
                    </span>
                    <span
                      className={cn(
                        'hidden text-[13px] font-medium sm:block',
                        isActive ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {t(`steps.${step.label}`)}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        'h-px flex-1',
                        index < currentStep ? 'bg-primary/60' : 'bg-border',
                      )}
                    />
                  )}
                </li>
              );
            })}
          </ol>

          {/* Step Content */}
          <div className="relative rounded-lg border border-border bg-card p-5">
            <div
              className="transition-opacity duration-200"
              style={{
                opacity: isProcessing ? 0.6 : 1,
                pointerEvents: isProcessing ? 'none' : 'auto',
              }}
            >
              {currentStep === 0 && (
                <Step1ChooseTemplate
                  selectedTemplate={template}
                  onSelect={setTemplate}
                  onNext={() => setCurrentStep(1)}
                  onBack={() => router.push('/broadcasts')}
                />
              )}
              {currentStep === 1 && (
                <Step2SelectAudience
                  audience={audience}
                  onUpdate={setAudience}
                  onNext={() => setCurrentStep(2)}
                  onBack={() => setCurrentStep(0)}
                />
              )}
              {currentStep === 2 && template && (
                <Step3Personalize
                  template={template}
                  variables={variables}
                  onUpdate={setVariables}
                  headerMediaUrl={headerMediaUrl}
                  onHeaderMediaUrlChange={setHeaderMediaUrl}
                  onNext={() => setCurrentStep(3)}
                  onBack={() => setCurrentStep(1)}
                />
              )}
              {currentStep === 3 && template && (
                <Step4ScheduleSend
                  name={name}
                  onNameChange={setName}
                  template={template}
                  audience={audience}
                  onSend={handleSend}
                  onSaveDraft={handleSaveDraft}
                  onBack={() => setCurrentStep(2)}
                  isProcessing={isProcessing}
                  progress={progress}
                />
              )}
            </div>
          </div>
        </div>
      </PageBody>
    </Page>
  );
}
