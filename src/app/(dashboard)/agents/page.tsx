'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Page, PageBody, PageHeader } from '@/components/layout/page';
import { LoadingState } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AiPlayground } from '@/components/agents/ai-playground';
import { AiUsageCard } from '@/components/agents/ai-usage';
import { AiConfig } from '@/components/settings/ai-config';
import { useAuth } from '@/hooks/use-auth';
import { canEditSettings } from '@/lib/auth/roles';

type Tab = 'playground' | 'setup' | 'usage';

export default function AgentsPage() {
  const t = useTranslations('Agents');
  const { accountRole } = useAuth();
  const canViewUsage = accountRole ? canEditSettings(accountRole) : false;
  const [tab, setTab] = useState<Tab>('playground');
  const [decided, setDecided] = useState(false);

  // Land first-time users on Setup, returning users on the Playground.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/ai/config');
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setTab(data?.configured ? 'playground' : 'setup');
      } catch {
        if (!cancelled) setTab('setup');
      } finally {
        if (!cancelled) setDecided(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Page>
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        className="flex flex-1 flex-col gap-0"
      >
        <PageHeader title={t('title')} description={t('description')}>
          {decided ? (
            <TabsList variant="line" className="-mb-px border-b-0">
              <TabsTrigger value="playground">{t('tabPlayground')}</TabsTrigger>
              <TabsTrigger value="setup">{t('tabSetup')}</TabsTrigger>
              {canViewUsage && (
                <TabsTrigger value="usage">{t('tabUsage')}</TabsTrigger>
              )}
            </TabsList>
          ) : null}
        </PageHeader>

        <PageBody>
          {!decided ? (
            <LoadingState />
          ) : (
            <>
              <TabsContent value="playground">
                <AiPlayground onGoToSetup={() => setTab('setup')} />
              </TabsContent>

              <TabsContent value="setup" className="max-w-3xl">
                <AiConfig />
              </TabsContent>

              {canViewUsage && (
                <TabsContent value="usage" className="max-w-4xl">
                  <AiUsageCard />
                </TabsContent>
              )}
            </>
          )}
        </PageBody>
      </Tabs>
    </Page>
  );
}
