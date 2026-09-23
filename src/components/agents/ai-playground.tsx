'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Bot, RotateCcw, Send, Loader2, UserCircle2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fieldClasses } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  /** assistant-only: the agent signalled a human handoff on this turn. */
  handoff?: boolean;
}

export function AiPlayground({ onGoToSetup }: { onGoToSetup?: () => void }) {
  const t = useTranslations('Agents.playground');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const next: Turn[] = [...turns, { role: 'user', content: text }];
    setTurns(next);
    setInput('');
    setSending(true);
    try {
      const res = await fetch('/api/ai/playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send only role+content — the server ignores anything else.
        body: JSON.stringify({
          messages: next.map((t) => ({ role: t.role, content: t.content })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'ai_not_configured') {
          toast.error(t('notConfigured'));
        } else {
          toast.error(data.error ?? t('noReply'));
        }
        // Roll the unsent user turn back so the transcript stays clean.
        setTurns(turns);
        setInput(text);
        return;
      }
      setTurns([
        ...next,
        {
          role: 'assistant',
          content:
            typeof data.reply === 'string' && data.reply.trim()
              ? data.reply
              : '',
          handoff: Boolean(data.handoff),
        },
      ]);
    } catch {
      toast.error(t('unreachable'));
      setTurns(turns);
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="flex h-[calc(100dvh-13rem)] min-h-[420px] flex-col overflow-hidden rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div className="min-w-0">
          <span className="block text-[13px] font-semibold text-foreground">{t('title')}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {t('subtitle')}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTurns([])}
          disabled={turns.length === 0 || sending}
        >
          <RotateCcw /> {t('reset')}
        </Button>
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-card-2 p-4">
        {turns.length === 0 && (
          <EmptyState
            icon={Bot}
            title={t('emptyTitle')}
            description={t('emptyDesc')}
            className="h-full"
            action={
              onGoToSetup ? (
                <Button variant="outline" size="sm" onClick={onGoToSetup}>
                  {t('goToSetup')} <ArrowRight />
                </Button>
              ) : undefined
            }
          />
        )}

        {turns.map((turn, i) => (
          <div
            key={i}
            className={cn(
              'flex gap-2',
              turn.role === 'user' ? 'justify-end' : 'justify-start',
            )}
          >
            {turn.role === 'assistant' && (
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                <Bot className="size-3.5" />
              </span>
            )}
            <div
              className={cn(
                'max-w-[80%] rounded-xl px-3 py-2 text-[13px] text-foreground',
                turn.role === 'user'
                  ? 'rounded-br-sm border border-primary/12 bg-bubble-out'
                  : 'rounded-bl-sm border border-border bg-card shadow-xs',
              )}
            >
              {turn.content && <p className="whitespace-pre-wrap">{turn.content}</p>}
              {turn.role === 'assistant' && turn.handoff && (
                <p
                  className={cn(
                    'flex items-center gap-1 text-xs text-warning',
                    turn.content && 'mt-1.5 border-t border-border/50 pt-1.5',
                  )}
                >
                  <UserCircle2 className="h-3.5 w-3.5" />
                  {t('handoff')}
                </p>
              )}
            </div>

          </div>
        ))}

        {sending && (
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> {t('thinking')}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="flex items-end gap-2 border-t border-border p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          rows={1}
          className={cn(fieldClasses, 'min-h-9 flex-1 resize-none px-3 py-2 text-base md:text-[13px]')}
        />
        <Button
          size="icon-lg"
          onClick={send}
          disabled={!input.trim() || sending}
          aria-label={t('send')}
        >
          {sending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Send />
          )}
        </Button>
      </div>
    </div>
  );
}
