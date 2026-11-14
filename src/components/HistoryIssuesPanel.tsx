import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  Cpu,
  History,
  RefreshCw,
  Send,
  Sparkles,
} from 'lucide-react';
import { SMIAN_P5_VERIFIED_RECORDS } from '../data/samples/asfVertexSamples.ts';
import {
  askPageAwareAssistant,
  getLaptopDbUrl,
  LAPTOP_DB_EVENT_NAME,
  normalizeRegionMatch,
  probeLaptopH5Db,
  type LaptopDbProbeResult,
  type LiveLaptopGranuleRecord,
} from '../services/nisarApi.ts';
import type {
  AssistChatMessage,
  RegionDataset,
  StudyZone,
} from '../types/sar.ts';

interface HistoryIssuesPanelProps {
  region: RegionDataset;
  selectedZone: StudyZone | null;
  passIndex: number;
}

const QUICK_HISTORY_PROMPTS: Record<RegionDataset['id'], string[]> = {
  maharashtra_gcov: [
    'How does the Nov 11, 2026 .h5 scan compare to the 2019 & 2022 Gosikhurd floods?',
    'Are Wardha cotton fields showing 2023–2025 waterlogging risk right now?',
    'What recurring monsoon issues hit farmers around Bhandara and Wardha?',
  ],
  northeast_india_gcov: [
    'How does today’s .h5 scan compare to the 2020, 2022 & 2024 Assam floods?',
    'Why does radar spot Kaziranga floodwater when normal satellites see clouds?',
    'What recurring river erosion and wetland flood risks affect communities here?',
  ],
  japan_gunw: [
    'How does the Nov 5, 2026 .h5 scan compare to the Jan 1, 2024 Noto earthquake?',
    'Where did the ground shift most between Wajima, Suzu, and Nanao Bay?',
    'What does 81% reliability (γ = 0.81) mean for post-quake recovery?',
  ],
};

export function HistoryIssuesPanel({
  region,
  selectedZone,
  passIndex,
}: HistoryIssuesPanelProps) {
  const [probe, setProbe] = useState<LaptopDbProbeResult | null>(null);
  const [isLoadingProbe, setIsLoadingProbe] = useState<boolean>(true);
  const [probeError, setProbeError] = useState<string | null>(null);

  const [question, setQuestion] = useState<string>('');
  const [isAskingAi, setIsAskingAi] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistChatMessage[]>([]);
  const [followUps, setFollowUps] = useState<string[]>([]);

  const loadLaptopHistory = useCallback(async (forceRefresh = false) => {
    setIsLoadingProbe(true);
    setProbeError(null);
    try {
      const result = await probeLaptopH5Db(getLaptopDbUrl(), forceRefresh);
      setProbe(result);
    } catch (err) {
      setProbeError(
        err instanceof Error ? err.message : 'Unable to reach SMIAN_P5 laptop server.'
      );
    } finally {
      setIsLoadingProbe(false);
    }
  }, []);

  useEffect(() => {
    void loadLaptopHistory(false);
    const onDbUrlChanged = () => {
      void loadLaptopHistory(true);
    };
    window.addEventListener(LAPTOP_DB_EVENT_NAME, onDbUrlChanged);
    return () => window.removeEventListener(LAPTOP_DB_EVENT_NAME, onDbUrlChanged);
  }, [loadLaptopHistory]);

  const activeZone = selectedZone ?? region.zones[0];
  const activePass = activeZone.passes[passIndex] ?? activeZone.passes[0];

  const liveRecord: LiveLaptopGranuleRecord | undefined =
    probe?.connected && probe.granules.length > 0
      ? probe.granules.find((g) => normalizeRegionMatch(g.regionId, region.id))
      : undefined;

  const fallbackRecord: LiveLaptopGranuleRecord =
    SMIAN_P5_VERIFIED_RECORDS.find((r) =>
      normalizeRegionMatch(r.regionId, region.id)
    ) ?? SMIAN_P5_VERIFIED_RECORDS[1];

  const activeRecord = liveRecord ?? fallbackRecord;
  const historicalIssues =
    activeRecord.historicalIssues ?? fallbackRecord.historicalIssues ?? [];
  const recurringSummary =
    activeRecord.recurringProblemsSummary ??
    fallbackRecord.recurringProblemsSummary ??
    '';

  const buildGroundedHistoryContext = (): string => {
    const sizeGb = (activeRecord.fileSizeMB / 1000).toFixed(2);
    const metricBits = [
      `Data Source: ${probe?.connected ? `LIVE ${probe.host}` : 'VERIFIED SMIAN_P5 BASELINE'}`,
      `File: ${activeRecord.fileName} (${Math.round(activeRecord.fileSizeMB).toLocaleString('en-US')} MB / ${sizeGb} GB)`,
      `HH Mean: ${activeRecord.hhGamma0MeanDb?.toFixed(1) ?? 'N/A'} dB`,
      `HH Flood Min: ${activeRecord.hhFloodMinDb?.toFixed(1) ?? 'N/A'} dB`,
      `HV Mean: ${activeRecord.hvGamma0MeanDb?.toFixed(1) ?? 'N/A'} dB`,
      typeof activeRecord.soilMoistureIndex === 'number'
        ? `Soil Wetness: ${Math.round(activeRecord.soilMoistureIndex * 100)}%`
        : null,
      typeof activeRecord.losDisplacementCm === 'number'
        ? `Ground Shift: ${activeRecord.losDisplacementCm.toFixed(1)} cm`
        : null,
      typeof activeRecord.coherenceMean === 'number'
        ? `Reliability: ${Math.round(activeRecord.coherenceMean * 100)}% (γ=${activeRecord.coherenceMean.toFixed(2)})`
        : null,
      recurringSummary ? `Recurring Problems: ${recurringSummary}` : null,
      historicalIssues.length > 0
        ? `Historical Baseline: ${historicalIssues
            .map(
              (h) =>
                `[${h.year}] ${h.eventTitle} — ${h.whatHappened} Comparison: ${h.radarSignatureComparison}`
            )
            .join(' ; ')}`
        : null,
    ].filter(Boolean);

    return metricBits.join(' | ');
  };

  const handleAskHistoryAi = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isAskingAi) return;

    const userMsg: AssistChatMessage = {
      id: `hist-u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion('');
    setIsAskingAi(true);
    setAiError(null);

    try {
      const resp = await askPageAwareAssistant({
        currentView: 'REGION_2D_MAP',
        regionId: region.id,
        activeAspect: 'history_issues',
        zoneName: activeZone.name,
        passDate: activePass.acquisitionDate,
        metricsSummary: buildGroundedHistoryContext(),
        question: trimmed,
        language: 'en',
      });

      const assistantMsg: AssistChatMessage = {
        id: `hist-a-${Date.now()}`,
        role: 'assistant',
        text: resp.answer,
        source: resp.source,
        timestamp: resp.generatedAt,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setFollowUps(resp.suggestedFollowUps);
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : 'Unable to reach AI assistant right now.'
      );
    } finally {
      setIsAskingAi(false);
    }
  };

  const handleSubmitForm = (e: FormEvent) => {
    e.preventDefault();
    void handleAskHistoryAi(question);
  };

  const suggestions =
    followUps.length > 0 ? followUps : QUICK_HISTORY_PROMPTS[region.id];

  if (isLoadingProbe && !probe) {
    return (
      <div
        data-testid="history-issues-loading"
        className="space-y-3"
        aria-busy="true"
        aria-label="Loading laptop server historical data"
      >
        <div className="h-20 skeleton-shimmer border border-[var(--rr-border)]" />
        <div className="h-32 skeleton-shimmer border border-[var(--rr-border)]" />
      </div>
    );
  }

  return (
    <div data-testid="history-issues-panel" className="space-y-4">
      {probeError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 border border-[var(--rr-warn-border)] bg-[var(--rr-warn-bg)] px-3 py-2 text-xs text-[var(--rr-warn-text)]"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{probeError} — showing verified local baseline.</span>
          </div>
          <button
            type="button"
            onClick={() => void loadLaptopHistory(true)}
            className="inline-flex items-center gap-1 border border-[var(--rr-border-strong)] bg-[var(--rr-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--rr-text)] hover:bg-[var(--rr-accent-solid)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Laptop Server Data Source Badge + Active .h5 Summary */}
      <div className="border border-[var(--rr-success-border)] bg-[var(--rr-surface)] p-3.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            data-testid="history-source-badge"
            className="inline-flex items-center gap-1.5 border border-[var(--rr-success-border)] bg-[var(--rr-success-bg)] px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--rr-success-text)]"
          >
            <Cpu className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              DATA SOURCE: SMIAN_P5 LAPTOP SERVER (.H5 + HISTORICAL BASELINE)
            </span>
          </span>

          <button
            type="button"
            onClick={() => void loadLaptopHistory(true)}
            disabled={isLoadingProbe}
            aria-label="Refresh SMIAN_P5 laptop server historical data"
            className="inline-flex items-center gap-1 border border-[var(--rr-border)] bg-[var(--rr-bg)] px-2 py-1 font-mono text-[10px] font-bold uppercase text-[var(--rr-text)] hover:border-[var(--rr-accent)] hover:text-[var(--rr-accent)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
          >
            <RefreshCw
              className={`h-3 w-3 ${isLoadingProbe ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{probe?.connected ? 'Live Sync' : 'Verified Cache'}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--rr-border)] pt-2 text-[11px]">
          <span
            data-testid="history-h5-filename"
            className="font-mono text-[10px] font-bold text-[var(--rr-accent)] break-all"
          >
            {activeRecord.fileName}
          </span>
          <span
            data-testid="history-h5-size"
            className="font-mono text-[11px] font-bold text-[var(--rr-text)] tabular-nums shrink-0"
          >
            {Math.round(activeRecord.fileSizeMB).toLocaleString('en-US')} MB (
            {(activeRecord.fileSizeMB / 1000).toFixed(2)} GB)
          </span>
        </div>

        {recurringSummary && (
          <p
            data-testid="history-recurring-summary"
            className="border-l-2 border-[var(--rr-accent)] bg-[var(--rr-bg)] px-2.5 py-2 text-xs leading-relaxed text-[var(--rr-text)]"
          >
            <strong className="text-[var(--rr-accent)]">Recurring Pattern: </strong>
            {recurringSummary}
          </p>
        )}
      </div>

      {/* Past Issues vs. Current Nov 2026 .h5 Scan Timeline */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--rr-text)]">
          <History className="h-3.5 w-3.5 text-[var(--rr-accent)]" aria-hidden="true" />
          <span>Past Issues vs. Current Nov 2026 .h5 Scan Timeline</span>
        </div>

        {historicalIssues.length === 0 ? (
          <div className="border border-[var(--rr-border)] bg-[var(--rr-surface)] p-3 text-xs text-[var(--rr-muted)]">
            No historical baseline records loaded for this region.
          </div>
        ) : (
          <div data-testid="history-timeline-list" className="space-y-2.5">
            {historicalIssues.map((issue) => (
              <article
                key={`${issue.year}-${issue.eventTitle}`}
                className="border border-[var(--rr-border)] bg-[var(--rr-surface)] p-3 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 border border-[var(--rr-accent)]/50 bg-[var(--rr-bg)] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[var(--rr-accent)]">
                    <CalendarClock className="h-3 w-3" aria-hidden="true" />
                    <span>{issue.year}</span>
                  </span>
                  <span className="font-mono text-[10px] uppercase text-[var(--rr-muted)]">
                    {region.shortName}
                  </span>
                </div>

                <h3 className="text-xs sm:text-sm font-bold text-[var(--rr-text)]">
                  {issue.eventTitle}
                </h3>

                <p className="text-xs leading-relaxed text-[var(--rr-muted)]">
                  <strong className="text-[var(--rr-text)]">What happened: </strong>
                  {issue.whatHappened}
                </p>

                <p className="border border-[var(--rr-border)] bg-[var(--rr-bg)] p-2 text-xs leading-relaxed text-[var(--rr-text)]">
                  <strong className="text-[var(--rr-accent)]">
                    Vs. Nov 2026 .h5 Scan:{' '}
                  </strong>
                  {issue.radarSignatureComparison}
                </p>

                <p className="text-[11px] leading-snug text-[var(--rr-muted)]">
                  <strong className="text-[var(--rr-success-text)]">
                    Why it matters:{' '}
                  </strong>
                  {issue.communityImpact}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Dedicated Inline AI Q&A Form Grounded in Laptop Server Data */}
      <div
        data-testid="history-ai-qa-box"
        className="border border-[var(--rr-accent)]/70 bg-[var(--rr-surface)] p-3.5 space-y-3"
      >
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-[var(--rr-accent)] shrink-0" aria-hidden="true" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--rr-text)]">
            Ask AI About History &amp; Past Issues (Grounded in Laptop Server Data)
          </span>
        </div>

        {/* 3 Quick-Question Chips */}
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((chip) => (
            <button
              key={chip}
              type="button"
              data-testid="history-quick-chip"
              disabled={isAskingAi}
              onClick={() => void handleAskHistoryAi(chip)}
              className="border border-[var(--rr-border)] bg-[var(--rr-bg)] px-2.5 py-1.5 text-left text-[11px] font-semibold text-[var(--rr-text)] hover:border-[var(--rr-accent)] hover:text-[var(--rr-accent)] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Question Form */}
        <form
          onSubmit={handleSubmitForm}
          className="flex border border-[var(--rr-border-strong)] bg-[var(--rr-bg)]"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask how today's .h5 scan compares to past disasters..."
            aria-label="Ask AI about history and past issues"
            data-testid="history-ai-input"
            className="flex-1 bg-transparent px-3 py-2 text-xs text-[var(--rr-text)] placeholder:text-[var(--rr-muted)] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!question.trim() || isAskingAi}
            data-testid="history-ai-submit"
            aria-label="Send historical question to AI"
            className="inline-flex items-center gap-1.5 border-l border-[var(--rr-border)] bg-[var(--rr-accent-solid)] px-3 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Ask</span>
          </button>
        </form>

        {aiError && (
          <div
            role="alert"
            className="border border-[var(--rr-danger-border)] bg-[var(--rr-danger-bg)] px-3 py-2 text-xs text-[var(--rr-danger-text)]"
          >
            {aiError}
          </div>
        )}

        {isAskingAi && (
          <div
            data-testid="history-ai-loading"
            className="h-14 skeleton-shimmer border border-[var(--rr-border)]"
            aria-busy="true"
            aria-label="Analyzing historical baseline and live .h5 scan"
          />
        )}

        {messages.length > 0 && (
          <div
            data-testid="history-ai-messages"
            className="space-y-2 max-h-72 overflow-y-auto pr-1"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`border p-2.5 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'ml-6 border-[var(--rr-accent-solid)] bg-[var(--rr-accent-solid)] text-white'
                    : 'mr-2 border-[var(--rr-border)] bg-[var(--rr-bg)] text-[var(--rr-text)]'
                }`}
              >
                <p>{msg.text}</p>
                {msg.source && (
                  <div className="mt-1 flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--rr-muted)]">
                    <Sparkles className="h-2.5 w-2.5 text-[var(--rr-accent)]" aria-hidden="true" />
                    <span>
                      {msg.source === 'GEMINI_4_HYDROGEN'
                        ? 'AI Answer · SMIAN_P5 Grounded'
                        : 'Built-In Historical Guide · SMIAN_P5 Grounded'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
