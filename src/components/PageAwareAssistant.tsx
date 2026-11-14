import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Bot, MessageSquare, Send, Sparkles, X } from 'lucide-react';
import { REGION_DATASETS } from '../data/samples/asfVertexSamples.ts';
import { askPageAwareAssistant } from '../services/nisarApi.ts';
import type {
  AssistChatMessage,
  DatasetAspectId,
  LayerMode,
  PageViewMode,
  RegionId,
} from '../types/sar.ts';
import { formatPageContextLabel } from '../utils/globeMath.ts';

export interface H5AskAiContext {
  fileName: string;
  fileSizeMB: number;
  regionName?: string;
  hhGamma0MeanDb?: number;
  hhFloodMinDb?: number;
  hvGamma0MeanDb?: number;
  soilMoistureIndex?: number;
  losDisplacementCm?: number;
  coherenceMean?: number;
  headerDigest?: string;
}

export interface NisarAskAiEventDetail {
  question: string;
  h5Summary?: string;
  h5Context?: H5AskAiContext;
}

interface PageAwareAssistantProps {
  pageView: PageViewMode;
  activeRegionId: RegionId;
  activeAspect: DatasetAspectId | null;
  zoneName?: string;
  passDate?: string;
  layerMode: LayerMode;
  metricsSummary: string;
}

export function PageAwareAssistant({
  pageView,
  activeRegionId,
  activeAspect,
  zoneName,
  passDate,
  layerMode,
  metricsSummary,
}: PageAwareAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<AssistChatMessage[]>([]);
  const [followUps, setFollowUps] = useState<string[]>([]);

  const isSendingRef = useRef(false);

  const contextLabel = formatPageContextLabel({
    currentView: pageView,
    regionId: pageView === 'REGION_2D_MAP' ? activeRegionId : undefined,
    activeAspect: activeAspect ?? undefined,
    zoneName: pageView === 'REGION_2D_MAP' ? zoneName : undefined,
  });

  const defaultPrompts =
    pageView === 'HOME_3D_GLOBE'
      ? [
          'Explain the .h5 satellite file in simple words',
          'Compare the 3 places',
          'How does radar see through clouds?',
        ]
      : [
          'Explain the .h5 satellite file in simple words',
          `Explain ${zoneName?.split(' ')[0] ?? 'this area'} in simple words`,
          'What should people watch out for?',
        ];

  const activeSuggestions = followUps.length > 0 ? followUps : defaultPrompts;

  const submitQuestion = async (
    questionText: string,
    overrideMetricsSummary?: string
  ) => {
    const trimmed = questionText.trim();
    if (!trimmed || isSendingRef.current) return;

    isSendingRef.current = true;
    const userMsg: AssistChatMessage = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    const combinedMetrics = overrideMetricsSummary
      ? pageView === 'REGION_2D_MAP' && metricsSummary
        ? `${metricsSummary} | ${overrideMetricsSummary}`
        : overrideMetricsSummary
      : pageView === 'REGION_2D_MAP'
        ? metricsSummary
        : undefined;

    try {
      const resp = await askPageAwareAssistant({
        currentView: pageView,
        regionId: pageView === 'REGION_2D_MAP' ? activeRegionId : undefined,
        activeAspect: activeAspect ?? undefined,
        zoneName: pageView === 'REGION_2D_MAP' ? zoneName : undefined,
        passDate,
        layerMode: pageView === 'REGION_2D_MAP' ? layerMode : undefined,
        metricsSummary: combinedMetrics,
        question: trimmed,
        language: 'en',
      });

      const assistantMsg: AssistChatMessage = {
        id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'assistant',
        text: resp.answer,
        source: resp.source,
        timestamp: resp.generatedAt,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setFollowUps(resp.suggestedFollowUps);
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  };

  const submitQuestionRef = useRef(submitQuestion);
  submitQuestionRef.current = submitQuestion;

  useEffect(() => {
    const handleAskAiEvent = (evt: Event) => {
      const customEvt = evt as CustomEvent<NisarAskAiEventDetail>;
      const detail = customEvt.detail;
      if (!detail?.question) return;

      setIsOpen(true);

      let h5Stats: string | undefined = detail.h5Summary?.trim() || undefined;
      if (!h5Stats && detail.h5Context) {
        const ctx = detail.h5Context;
        const sizeGb = (ctx.fileSizeMB / 1000).toFixed(2);
        const parts = [
          `.h5 File: ${ctx.fileName}`,
          `Size: ${ctx.fileSizeMB.toLocaleString('en-US')} MB (${sizeGb} GB)`,
          ctx.regionName ? `Place: ${ctx.regionName}` : null,
          typeof ctx.hhGamma0MeanDb === 'number'
            ? `hhGamma0MeanDb: ${ctx.hhGamma0MeanDb.toFixed(1)} dB`
            : null,
          typeof ctx.hhFloodMinDb === 'number'
            ? `hhFloodMinDb: ${ctx.hhFloodMinDb.toFixed(1)} dB`
            : null,
          typeof ctx.hvGamma0MeanDb === 'number'
            ? `hvGamma0MeanDb: ${ctx.hvGamma0MeanDb.toFixed(1)} dB`
            : null,
          typeof ctx.soilMoistureIndex === 'number'
            ? `soilMoistureIndex: ${ctx.soilMoistureIndex.toFixed(2)} (${Math.round(ctx.soilMoistureIndex * 100)}%)`
            : null,
          typeof ctx.losDisplacementCm === 'number'
            ? `losDisplacementCm: ${ctx.losDisplacementCm.toFixed(1)} cm`
            : null,
          typeof ctx.coherenceMean === 'number'
            ? `coherenceMean: ${ctx.coherenceMean.toFixed(2)} (${Math.round(ctx.coherenceMean * 100)}%)`
            : null,
          ctx.headerDigest ? `SHA-256: ${ctx.headerDigest}` : null,
        ].filter(Boolean);
        h5Stats = parts.join(', ');
      }

      void submitQuestionRef.current(detail.question, h5Stats);
    };

    window.addEventListener('nisar-ask-ai', handleAskAiEvent);
    return () => window.removeEventListener('nisar-ask-ai', handleAskAiEvent);
  }, []);

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submitQuestion(input);
  };

  const regionShort = REGION_DATASETS[activeRegionId].shortName.replace(/ \[.*\]$/, '');

  return (
    <div
      className="fixed bottom-4 right-4 z-[1200] flex flex-col items-end gap-2"
      aria-label="Radar Rhythm AI Guide"
    >
      {isOpen && (
        <section
          data-testid="page-aware-assistant-panel"
          aria-label="Context-aware AI guide chat"
          className="w-[calc(100vw-2rem)] sm:w-[370px] overflow-hidden rounded-2xl border border-survey-border-strong bg-survey-bg text-survey-ink flex flex-col max-h-[500px]"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 border-b border-[var(--rr-border)] bg-[var(--rr-surface)] px-4 py-3 text-[var(--rr-text)]">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-[var(--rr-accent)] shrink-0" aria-hidden="true" />
                <span className="text-xs font-semibold text-[var(--rr-text)]">
                  Radar Rhythm AI Guide
                </span>
              </div>
              <div
                data-testid="assistant-context-label"
                className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--rr-muted)]"
                title={contextLabel}
              >
                {contextLabel}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close AI Guide"
              className="p-1 text-[var(--rr-muted)] hover:text-[var(--rr-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)] shrink-0"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Live Context Strip */}
          <div className="border-b border-[var(--rr-border)] bg-[var(--rr-surface-2)] px-3.5 py-2 font-mono text-[10px] text-[var(--rr-muted)]">
            {pageView === 'HOME_3D_GLOBE'
              ? 'Viewing: 3D Earth Home · 3 active places'
              : `Viewing: ${metricsSummary}`}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 min-h-[160px] max-h-[250px]">
            {messages.length === 0 ? (
              <div className="rounded-xl border border-[var(--rr-border)] bg-[var(--rr-surface)] p-3 text-xs text-[var(--rr-muted)] leading-relaxed">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--rr-accent)] mb-1">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Ready to Help</span>
                </div>
                {pageView === 'HOME_3D_GLOBE'
                  ? 'Ask me what each glowing spot on Earth shows, or click any place to open its 2D satellite and radar map.'
                  : `I can see you are exploring ${regionShort}. Ask what the map colors, satellite view, or numbers mean.`}
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-xl p-3 text-xs leading-relaxed border ${
                    m.role === 'user'
                      ? 'ml-6 border-survey-basalt bg-survey-basalt text-survey-basalt-text'
                      : 'mr-4 border-survey-border bg-survey-surface text-survey-ink'
                  }`}
                >
                  <p>{m.text}</p>
                  {m.source && (
                    <div className="mt-1 font-mono text-[10px] opacity-75">
                      {m.source === 'GEMINI_4_HYDROGEN'
                        ? 'AI Answer'
                        : 'Built-In Guide'}
                    </div>
                  )}
                </div>
              ))
            )}
            {isSending && (
              <div className="h-12 rounded-xl skeleton-shimmer border border-[var(--rr-border)]" aria-busy="true" />
            )}
          </div>

          {/* Quick Suggested Questions */}
          <div className="border-t border-[var(--rr-border)] bg-[var(--rr-surface)] px-3 py-2.5 flex flex-wrap gap-1.5">
            {activeSuggestions.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void submitQuestion(prompt)}
                className="rounded-full border border-[var(--rr-border)] bg-[var(--rr-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--rr-text)] hover:border-[var(--rr-accent)] hover:text-[var(--rr-accent)] transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Question Input */}
          <form
            onSubmit={handleFormSubmit}
            className="flex border-t border-[var(--rr-border)] bg-[var(--rr-bg)]"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                pageView === 'HOME_3D_GLOBE'
                  ? 'Ask about 3D Earth...'
                  : `Ask about ${regionShort}...`
              }
              aria-label="Ask Radar Rhythm AI Guide"
              className="flex-1 bg-transparent px-3.5 py-2.5 text-xs text-[var(--rr-text)] placeholder:text-[var(--rr-muted)] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || isSending}
              aria-label="Send question"
              className="border-s border-survey-border bg-survey-basalt px-4 text-survey-basalt-text hover:opacity-90 disabled:opacity-50 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-survey-basalt"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </form>
        </section>
      )}

      {/* Docked Bottom-Right Launcher */}
      <button
        type="button"
        data-testid="assistant-launcher-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="inline-flex items-center gap-2 rounded-full border border-survey-border-strong bg-survey-basalt px-4 py-2.5 text-survey-basalt-text hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-survey-basalt"
      >
        <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="text-xs font-semibold whitespace-nowrap">
          {isOpen
            ? 'Close Guide'
            : pageView === 'HOME_3D_GLOBE'
              ? 'AI Guide · 3D Earth'
              : `AI Guide · ${regionShort}`}
        </span>
      </button>
    </div>
  );
}
