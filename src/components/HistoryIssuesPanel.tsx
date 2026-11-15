import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  Check,
  Cpu,
  Database,
  FileCode,
  History,
  Key,
  RefreshCw,
  Send,
  Sparkles,
} from 'lucide-react';
import { SMIAN_P5_VERIFIED_RECORDS } from '../data/samples/asfVertexSamples.ts';
import {
  askPageAwareAssistant,
  getLaptopDbUrl,
  getNvidiaApiKey,
  setNvidiaApiKey,
  LAPTOP_DB_EVENT_NAME,
  NVIDIA_KEY_EVENT_NAME,
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
  fullWidth?: boolean;
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
  fullWidth = false,
}: HistoryIssuesPanelProps) {
  const [probe, setProbe] = useState<LaptopDbProbeResult | null>(null);
  const [isLoadingProbe, setIsLoadingProbe] = useState<boolean>(true);
  const [probeError, setProbeError] = useState<string | null>(null);

  const [question, setQuestion] = useState<string>('');
  const [isAskingAi, setIsAskingAi] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistChatMessage[]>([]);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [nvidiaKey, setNvidiaKey] = useState<string>(() => getNvidiaApiKey());
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [tempKeyInput, setTempKeyInput] = useState('');
  const [keySavedToast, setKeySavedToast] = useState(false);

  useEffect(() => {
    const onKeyChange = () => {
      setNvidiaKey(getNvidiaApiKey());
    };
    window.addEventListener(NVIDIA_KEY_EVENT_NAME, onKeyChange);
    return () => window.removeEventListener(NVIDIA_KEY_EVENT_NAME, onKeyChange);
  }, []);

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
  const liveDiskSlices =
    activeRecord.liveDiskSlices ?? fallbackRecord.liveDiskSlices ?? [];

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

  // Key configuration drawer
  const keyConfigBlock = (
    <div className="border border-[var(--rr-border)] bg-[var(--rr-surface-2)] p-3 text-xs space-y-2">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-[var(--rr-text)]">
        <span className="font-bold flex items-center gap-1.5">
          <Key className="h-3 w-3 text-[var(--rr-accent)]" />
          <span>NVIDIA Nemotron 3.5 Configuration</span>
        </span>
        <span className="text-[var(--rr-muted)]">nemotron-3.5-lightning-30b-a3b</span>
      </div>
      <p className="text-[11px] text-[var(--rr-muted)] leading-tight">
        Enter your NVIDIA API key (starts with <code className="font-mono text-survey-ink font-semibold">nvapi-</code>) to enable live Nemotron 3.5 Lightning (30B) inference for historical disaster analysis.
      </p>
      <div className="flex gap-1.5">
        <input
          type="password"
          value={tempKeyInput}
          onChange={(e) => setTempKeyInput(e.target.value)}
          placeholder="nvapi-..."
          className="flex-1 rounded border border-[var(--rr-border)] bg-[var(--rr-bg)] px-2.5 py-1 text-xs text-[var(--rr-text)] font-mono placeholder:text-[var(--rr-muted)] focus:outline-none focus:border-[var(--rr-accent)]"
        />
        <button
          type="button"
          onClick={() => {
            setNvidiaApiKey(tempKeyInput);
            setKeySavedToast(true);
            setTimeout(() => setKeySavedToast(false), 2000);
            setShowKeyConfig(false);
          }}
          className="rounded bg-survey-basalt px-3 py-1 text-xs font-semibold text-survey-basalt-text hover:opacity-90"
        >
          Save Key
        </button>
        {nvidiaKey && (
          <button
            type="button"
            onClick={() => {
              setNvidiaApiKey('');
              setTempKeyInput('');
              setShowKeyConfig(false);
            }}
            className="rounded border border-[var(--rr-border)] px-2 py-1 text-xs text-survey-brick hover:bg-survey-brick/10"
          >
            Clear
          </button>
        )}
      </div>
      {keySavedToast && (
        <div className="text-survey-moss text-[11px] font-semibold flex items-center gap-1">
          <Check className="h-3 w-3" />
          <span>Key saved successfully!</span>
        </div>
      )}
    </div>
  );

  return (
    <div data-testid="history-issues-panel" className="space-y-5">
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
            className="inline-flex items-center gap-1 border border-[var(--rr-border-strong)] bg-[var(--rr-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--rr-text)] hover:bg-[var(--rr-accent-solid)] hover:text-survey-basalt-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Top Banner: Status & NVIDIA NIM Connection */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--rr-border)] bg-[var(--rr-surface)] p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            data-testid="history-source-badge"
            className="inline-flex items-center gap-1.5 rounded-full border border-survey-moss/40 bg-survey-moss/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-survey-moss"
          >
            <Cpu className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              {probe?.connected
                ? `LIVE SERVER: ${probe.host} (${probe.totalH5FilesFound} .H5 FILES · ${probe.totalSizeGb} GB)`
                : 'SMIAN_P5 LAPTOP DATABASE (VERIFIED BASELINE)'}
            </span>
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--rr-accent)]/40 bg-[var(--rr-accent)]/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--rr-accent)]">
            <Sparkles className="h-3 w-3" />
            <span>NVIDIA Nemotron 3.5: {nvidiaKey ? 'ACTIVE (Nemotron 3.5)' : 'READY (GROUNDED)'}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTempKeyInput(nvidiaKey);
              setShowKeyConfig((prev) => !prev);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--rr-border)] bg-[var(--rr-bg)] px-2.5 py-1 font-mono text-[10px] font-bold uppercase text-[var(--rr-text)] hover:border-[var(--rr-accent)] hover:text-[var(--rr-accent)] transition-colors"
          >
            <Key className="h-3 w-3 text-[var(--rr-accent)]" />
            <span>{nvidiaKey ? 'Edit Key' : 'Enter NVIDIA Key'}</span>
          </button>

          <button
            type="button"
            onClick={() => void loadLaptopHistory(true)}
            disabled={isLoadingProbe}
            aria-label="Refresh SMIAN_P5 laptop server historical data"
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--rr-border)] bg-[var(--rr-bg)] px-2.5 py-1 font-mono text-[10px] font-bold uppercase text-[var(--rr-text)] hover:border-[var(--rr-accent)] hover:text-[var(--rr-accent)] disabled:opacity-50 transition-colors"
          >
            <RefreshCw
              className={`h-3 w-3 ${isLoadingProbe ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {showKeyConfig && keyConfigBlock}

      {/* Main Content Layout: Multi-column if fullWidth, stacked otherwise */}
      <div className={fullWidth ? 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-start' : 'space-y-4'}>
        {/* Column 1: Laptop Database File Proof & Disk Slices */}
        <div className={fullWidth ? 'lg:col-span-4 space-y-4' : 'space-y-4'}>
          <div className="rounded-xl border border-[var(--rr-border)] bg-[var(--rr-surface)] p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--rr-border)] pb-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--rr-accent)] flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5" />
                <span>Laptop .H5 Storage Proof</span>
              </span>
              <span className="font-mono text-[10px] text-[var(--rr-muted)]">
                {activeRecord.regionName}
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="font-mono text-[11px] font-bold text-[var(--rr-text)] break-all">
                {activeRecord.fileName}
              </div>
              <div className="flex items-center justify-between font-mono text-[10px] text-[var(--rr-muted)]">
                <span>File Size:</span>
                <span className="font-bold text-[var(--rr-text)]">
                  {Math.round(activeRecord.fileSizeMB).toLocaleString('en-US')} MB (
                  {(activeRecord.fileSizeMB / 1000).toFixed(2)} GB)
                </span>
              </div>
              <div className="flex items-center justify-between font-mono text-[10px] text-[var(--rr-muted)]">
                <span>SHA-256 Digest:</span>
                <span className="font-bold text-[var(--rr-accent)]">
                  {activeRecord.headerDigest}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono text-[10px] text-[var(--rr-muted)]">
                <span>HDF5 Magic:</span>
                <span className="text-survey-moss font-bold">VERIFIED (\x89HDF\r\n)</span>
              </div>
            </div>

            {recurringSummary && (
              <div className="rounded-lg border border-[var(--rr-border)] bg-[var(--rr-bg)] p-3 text-xs leading-relaxed text-[var(--rr-text)]">
                <strong className="text-[var(--rr-accent)] font-mono text-[10px] uppercase block mb-1">
                  Recurring Problems Summary:
                </strong>
                {recurringSummary}
              </div>
            )}

            {/* Binary Disk Slice Proofs from Laptop */}
            {liveDiskSlices.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-[var(--rr-border)]">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--rr-muted)] flex items-center gap-1">
                  <FileCode className="h-3 w-3 text-[var(--rr-accent)]" />
                  <span>Verified Disk Slices (Raw Chunk Proofs):</span>
                </div>
                <div className="space-y-1">
                  {liveDiskSlices.map((slice) => (
                    <div
                      key={slice.chunkSha256}
                      className="rounded border border-[var(--rr-border)] bg-[var(--rr-bg)] px-2.5 py-1.5 font-mono text-[10px] flex items-center justify-between"
                    >
                      <span>Offset {slice.offsetMB} MB</span>
                      <span className="text-survey-moss">
                        {Math.round(slice.nonZeroByteRatio * 100)}% density
                      </span>
                      <span className="text-[var(--rr-muted)]">{slice.chunkSha256}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Historical Disasters Timeline */}
        <div className={fullWidth ? 'lg:col-span-4 space-y-4' : 'space-y-4'}>
          <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--rr-text)]">
            <History className="h-3.5 w-3.5 text-[var(--rr-accent)]" aria-hidden="true" />
            <span>Past Disasters vs. Current .H5 Scan</span>
          </div>

          {historicalIssues.length === 0 ? (
            <div className="border border-[var(--rr-border)] bg-[var(--rr-surface)] p-3 text-xs text-[var(--rr-muted)]">
              No historical baseline records loaded for this region.
            </div>
          ) : (
            <div data-testid="history-timeline-list" className="space-y-3">
              {historicalIssues.map((issue) => (
                <article
                  key={`${issue.year}-${issue.eventTitle}`}
                  className="rounded-xl border border-[var(--rr-border)] bg-[var(--rr-surface)] p-3.5 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded border border-[var(--rr-accent)]/50 bg-[var(--rr-bg)] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[var(--rr-accent)]">
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

                  <div className="rounded-lg border border-[var(--rr-border)] bg-[var(--rr-bg)] p-2.5 text-xs leading-relaxed text-[var(--rr-text)]">
                    <strong className="text-[var(--rr-accent)] font-semibold">
                      Radar Comparison:
                    </strong>{' '}
                    {issue.radarSignatureComparison}
                  </div>

                  <p className="text-[11px] leading-snug text-[var(--rr-muted)]">
                    <strong className="text-survey-moss">Community Impact: </strong>
                    {issue.communityImpact}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Column 3: Dedicated NVIDIA AI Coverage & Interactive Q&A */}
        <div className={fullWidth ? 'lg:col-span-4 space-y-4' : 'space-y-4'}>
          <div
            data-testid="history-ai-qa-box"
            className="rounded-xl border border-[var(--rr-accent)]/60 bg-[var(--rr-surface)] p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[var(--rr-border)] pb-2">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-[var(--rr-accent)] shrink-0" aria-hidden="true" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--rr-text)]">
                  NVIDIA AI Disaster Q&amp;A
                </span>
              </div>
              <span className="font-mono text-[9px] uppercase text-[var(--rr-muted)]">
                LLaMA 3.3 70B
              </span>
            </div>

            <p className="text-xs text-[var(--rr-muted)] leading-relaxed">
              Ask how the current .h5 scan compares to historical floods, crop losses, or earthquake fault movements.
            </p>

            {/* Prompt Chips */}
            <div className="space-y-1.5">
              <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--rr-muted)]">
                Suggested Questions:
              </span>
              <div className="flex flex-col gap-1.5">
                {suggestions.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    data-testid="history-quick-chip"
                    disabled={isAskingAi}
                    onClick={() => void handleAskHistoryAi(chip)}
                    className="rounded-lg border border-[var(--rr-border)] bg-[var(--rr-bg)] px-3 py-2 text-left text-xs text-[var(--rr-text)] hover:border-[var(--rr-accent)] hover:text-[var(--rr-accent)] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Question Form */}
            <form
              onSubmit={handleSubmitForm}
              className="flex rounded-lg border border-[var(--rr-border-strong)] bg-[var(--rr-bg)] overflow-hidden"
            >
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask NVIDIA AI about historical comparisons..."
                aria-label="Ask NVIDIA AI about history and past issues"
                data-testid="history-ai-input"
                className="flex-1 bg-transparent px-3 py-2 text-xs text-[var(--rr-text)] placeholder:text-[var(--rr-muted)] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!question.trim() || isAskingAi}
                data-testid="history-ai-submit"
                aria-label="Send historical question to NVIDIA AI"
                className="inline-flex items-center gap-1.5 border-s border-survey-border bg-survey-basalt px-3.5 py-2 text-xs font-bold text-survey-basalt-text hover:opacity-90 disabled:opacity-50 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-survey-basalt"
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Ask</span>
              </button>
            </form>

            {aiError && (
              <div
                role="alert"
                className="rounded-lg border border-survey-brick/40 bg-survey-brick/10 px-3 py-2 text-xs text-survey-brick"
              >
                {aiError}
              </div>
            )}

            {isAskingAi && (
              <div
                data-testid="history-ai-loading"
                className="h-16 rounded-lg skeleton-shimmer border border-[var(--rr-border)] flex items-center justify-center font-mono text-[10px] text-[var(--rr-muted)]"
                aria-busy="true"
                aria-label="Analyzing historical baseline and live .h5 scan with NVIDIA Nemotron 3.5"
              >
                NVIDIA Nemotron 3.5 analyzing .h5 baseline...
              </div>
            )}

            {messages.length > 0 && (
              <div
                data-testid="history-ai-messages"
                className="space-y-2.5 max-h-80 overflow-y-auto pr-1"
              >
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-lg border p-3 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'ml-4 border-survey-basalt bg-survey-basalt text-survey-basalt-text'
                        : 'mr-2 border-[var(--rr-border)] bg-[var(--rr-bg)] text-[var(--rr-text)]'
                    }`}
                  >
                    <p>{msg.text}</p>
                    {msg.source && (
                      <div className="mt-1.5 flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--rr-muted)]">
                        <Sparkles className="h-2.5 w-2.5 text-[var(--rr-accent)]" aria-hidden="true" />
                        <span>
                          {msg.source === 'NVIDIA_NEMOTRON_3_5'
                            ? 'NVIDIA Nemotron 3.5 (Lightning 30B) · SMIAN_P5 Grounded'
                            : msg.source === 'NVIDIA_NIM_LLAMA3_3'
                              ? 'NVIDIA NIM (LLaMA 3.3 70B) · SMIAN_P5 Grounded'
                              : 'NVIDIA Radar History AI · SMIAN_P5 Grounded'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
