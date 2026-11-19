import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, RotateCcw, Upload } from 'lucide-react';
import { BlockInspector } from './components/BlockInspector';
import { CircleTimeDial } from './components/CircleTimeDial';
import { ScheduleTable } from './components/ScheduleTable';
import { WidgetShowcaseView } from './components/WidgetShowcaseView';
import { WorkbookSyncPanel } from './components/WorkbookSyncPanel';
import {
  DEFAULT_SCHEDULE_BLOCKS,
  DEFAULT_WORKBOOK_INFO,
} from './data/defaultSchedule';
import {
  CATEGORY_META,
  CategoryKey,
  DialConfig,
  TimeBlock,
  WorkbookSourceInfo,
} from './types/schedule';
import {
  computeScheduledCoverage,
  formatDuration,
  formatMinutes,
  getDurationMinutes,
  isMinuteInBlock,
  MINUTES_IN_DAY,
} from './utils/timeMath';
import {
  computeAnchorIsoForTodayWeekday,
  DEFAULT_ANCHOR_DATE_ISO,
  getNineDayInfo,
  NINE_DAY_WEEK,
} from './utils/nineDayCalendar';

type ActiveTab = 'dial' | 'sheet' | 'sync' | 'widget';

const STORAGE_BLOCKS_KEY = '391k_circle_blocks_v1';
const STORAGE_CONFIG_KEY = '391k_circle_config_v1';
const STORAGE_SOURCE_KEY = '391k_circle_source_v1';
const STORAGE_ANCHOR_KEY = '391k_nine_day_anchor_v1';

const DEFAULT_DIAL_CONFIG: DialConfig = {
  zeroPosition: 'top',
  dialTheme: 'light',
  showSecondsHand: true,
  snapMinutes: 15,
  showLabelsOnRing: true,
};

function loadInitial<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const isStandaloneWidget = searchParams.get('widget') === '1';

  const [activeTab, setActiveTab] = useState<ActiveTab>('dial');
  const [blocks, setBlocks] = useState<TimeBlock[]>(() =>
    loadInitial(STORAGE_BLOCKS_KEY, DEFAULT_SCHEDULE_BLOCKS)
  );
  const [dialConfig, setDialConfig] = useState<DialConfig>(() => {
    const base = loadInitial(STORAGE_CONFIG_KEY, DEFAULT_DIAL_CONFIG);
    if (isStandaloneWidget) {
      const themeParam = searchParams.get('theme');
      const zeroParam = searchParams.get('zero');
      return {
        ...base,
        dialTheme:
          themeParam === 'obsidian' || themeParam === 'light'
            ? themeParam
            : base.dialTheme,
        zeroPosition:
          zeroParam === 'bottom' || zeroParam === 'top'
            ? zeroParam
            : base.zeroPosition,
      };
    }
    return base;
  });
  const [sourceInfo, setSourceInfo] = useState<WorkbookSourceInfo>(() =>
    loadInitial(STORAGE_SOURCE_KEY, DEFAULT_WORKBOOK_INFO)
  );
  const [anchorIso, setAnchorIso] = useState<string>(() => {
    const paramAnchor = searchParams.get('anchor');
    if (isStandaloneWidget && paramAnchor && /^\d{4}-\d{2}-\d{2}$/.test(paramAnchor)) {
      return paramAnchor;
    }
    return loadInitial(STORAGE_ANCHOR_KEY, DEFAULT_ANCHOR_DATE_ISO);
  });

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [scrubMinutes, setScrubMinutes] = useState(
    () => new Date().getHours() * 60 + new Date().getMinutes()
  );

  const dialSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_BLOCKS_KEY, JSON.stringify(blocks));
    } catch {
      // Ignore storage quota errors
    }
  }, [blocks]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(dialConfig));
    } catch {
      // Ignore storage quota errors
    }
  }, [dialConfig]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SOURCE_KEY, JSON.stringify(sourceInfo));
    } catch {
      // Ignore storage quota errors
    }
  }, [sourceInfo]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ANCHOR_KEY, JSON.stringify(anchorIso));
    } catch {
      // Ignore storage quota errors
    }
  }, [anchorIso]);

  const nineDayInfo = useMemo(() => getNineDayInfo(now, anchorIso), [now, anchorIso]);

  const liveMinutes = now.getHours() * 60 + now.getMinutes();
  const liveSeconds = now.getSeconds();
  const displayMinutes = isLiveMode ? liveMinutes : scrubMinutes;
  const displaySeconds = isLiveMode ? liveSeconds : 0;

  const coverage = useMemo(() => computeScheduledCoverage(blocks), [blocks]);

  const categoryBreakdown = useMemo(() => {
    const sums: Record<CategoryKey, number> = {
      operations: 0,
      focus: 0,
      sync: 0,
      transit: 0,
      rest: 0,
    };
    for (const b of blocks) {
      sums[b.category] += getDurationMinutes(b.startMinutes, b.endMinutes);
    }
    return sums;
  }, [blocks]);

  const selectedBlock = useMemo(
    () => blocks.find((b) => b.id === selectedBlockId) ?? null,
    [blocks, selectedBlockId]
  );

  const handleUpdateBlockTime = (
    id: string,
    startMinutes: number,
    endMinutes: number
  ) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, startMinutes, endMinutes } : b
      )
    );
  };

  const handleCreateBlockFromArc = (startMinutes: number, endMinutes: number) => {
    const newId = `blk-${Date.now()}`;
    const newBlock: TimeBlock = {
      id: newId,
      title: `Window ${formatMinutes(startMinutes)}`,
      startMinutes,
      endMinutes,
      category: 'operations',
      notes: '',
    };
    setBlocks((prev) => [...prev, newBlock]);
    setSelectedBlockId(newId);
  };

  const handleAddBlock = (payload: Omit<TimeBlock, 'id'>) => {
    const newId = `blk-${Date.now()}`;
    setBlocks((prev) => [...prev, { ...payload, id: newId }]);
    setSelectedBlockId(newId);
  };

  const handleUpdateBlock = (updated: TimeBlock) => {
    setBlocks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  };

  const handleDeleteBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (selectedBlockId === id) {
      setSelectedBlockId(null);
    }
  };

  const handleApplyImportedBlocks = (
    imported: TimeBlock[],
    mode: 'replace' | 'merge',
    meta: { fileName: string; sheetName: string; rowCount: number }
  ) => {
    setBlocks((prev) => (mode === 'replace' ? imported : [...prev, ...imported]));
    setSelectedBlockId(null);
    setSourceInfo((prev) => ({
      ...prev,
      fileName: meta.fileName,
      sheetName: meta.sheetName,
      rowCount: mode === 'replace' ? meta.rowCount : prev.rowCount + meta.rowCount,
      lastImportedAt: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    }));
  };

  const handleResetDefault = () => {
    setBlocks(DEFAULT_SCHEDULE_BLOCKS);
    setSourceInfo(DEFAULT_WORKBOOK_INFO);
    setSelectedBlockId(null);
  };

  // Standalone Widget Mode (?widget=1)
  if (isStandaloneWidget) {
    const activeBlock = blocks.find((b) => isMinuteInBlock(liveMinutes, b)) ?? null;
    const isObsidian = dialConfig.dialTheme === 'obsidian';

    return (
      <div
        className={`min-h-screen flex items-center justify-center p-4 ${
          isObsidian ? 'bg-[#0C0E12] text-[#F8FAFC]' : 'bg-[#F6F6F4] text-[#111315]'
        }`}
      >
        <div
          className={`w-full max-w-[440px] rounded-2xl border p-5 ${
            isObsidian
              ? 'bg-[#12151A] border-[#282E38]'
              : 'bg-white border-[#E4E5E2]'
          }`}
        >
          <div className="flex items-baseline justify-between mb-2">
            <span className="font-display font-bold text-base tracking-tight">
              391K
            </span>
            <span className="text-xs font-mono tabular-nums opacity-60">
              {`${nineDayInfo.weekdayName} · ${nineDayInfo.dayOfMonth} ${nineDayInfo.monthShort} ${nineDayInfo.year}`}
            </span>
          </div>
          <CircleTimeDial
            blocks={blocks}
            selectedBlockId={null}
            onSelectBlock={() => {}}
            onUpdateBlockTime={() => {}}
            onCreateBlockFromArc={() => {}}
            dialConfig={dialConfig}
            currentMinutes={liveMinutes}
            currentSeconds={liveSeconds}
            currentDate={now}
            nineDayInfo={nineDayInfo}
            isLiveMode
            compact
          />
          <div
            className={`mt-3 pt-3 border-t flex items-center justify-between text-xs ${
              isObsidian
                ? 'border-[#1F242D] text-[#94A3B8]'
                : 'border-[#ECEEE9] text-[#64748B]'
            }`}
          >
            <span className="truncate pr-2">
              {activeBlock ? activeBlock.title : 'Unscheduled window'}
            </span>
            <span className="font-mono tabular-nums shrink-0">
              {formatMinutes(liveMinutes)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F6F4] text-[#111315]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="bg-white border-b border-[#E4E5E2] sticky top-0 z-30">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element Brand Wordmark */}
          <a
            href="#dial"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('dial');
            }}
            className="font-display text-xl font-bold tracking-tight text-[#111315] whitespace-nowrap shrink-0"
          >
            391K
          </a>

          {/* Zone 2: 4 Clean Single-Line Navigation Links */}
          <nav
            aria-label="Primary"
            className="flex items-center gap-5 sm:gap-7 overflow-x-auto"
          >
            {(
              [
                { id: 'dial', label: 'Circle Widget' },
                { id: 'sheet', label: 'Schedule Sheet' },
                { id: 'sync', label: 'OneDrive Sync' },
                { id: 'widget', label: 'Embed Widget' },
              ] as const
            ).map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`relative py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-[#111315]'
                      : 'text-[#64748B] hover:text-[#111315]'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute inset-x-0 -bottom-[13px] h-[2px] bg-[#111315]" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('sync')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#111315] hover:bg-[#272A2E] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              Import Excel
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1320px] w-full mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-6">
        {/* Concise Context Bar */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E4E5E2] pb-5">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#111315] [text-wrap:balance]">
              {activeTab === 'dial' && '00–24 Circle Time Widget'}
              {activeTab === 'sheet' && '24-Hour Schedule Sheet'}
              {activeTab === 'sync' && 'OneDrive Workbook Sync'}
              {activeTab === 'widget' && 'Standalone 391K Widget'}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] mt-1.5 font-mono tabular-nums">
              <span className="font-sans font-medium text-[#111315]">
                {nineDayInfo.weekdayName} · {nineDayInfo.dayOfMonth}{' '}
                {nineDayInfo.monthShort} · {nineDayInfo.year}
              </span>
              <span aria-hidden="true">·</span>
              <span>Day {nineDayInfo.dayOfWeekIndex}/9</span>
              <span aria-hidden="true">·</span>
              <span>{blocks.length} blocks</span>
              <span aria-hidden="true">·</span>
              <span>
                {formatDuration(coverage.totalMinutes)} / 24h allocated
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-sans">{sourceInfo.fileName}</span>
            </div>
          </div>

          <a
            href={sourceInfo.oneDriveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#334155] hover:text-[#111315] underline underline-offset-4 whitespace-nowrap shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open OneDrive Workbook
          </a>
        </div>

        {/* 9-Day Week Bar (1–7 + 8. Treesday, 9. Sarsday) */}
        {activeTab === 'dial' && (
          <div className="bg-white border border-[#E4E5E2] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-[#64748B] shrink-0">
              <span className="font-medium text-[#111315]">9-Day Week</span>
              <span aria-hidden="true">·</span>
              <span>Click a day to align today</span>
            </div>
            <div className="flex items-center gap-1 p-1 bg-[#F3F4F1] rounded-lg overflow-x-auto max-w-full">
              {NINE_DAY_WEEK.map((day) => {
                const isToday = nineDayInfo.dayOfWeekIndex === day.index;
                return (
                  <button
                    key={day.index}
                    type="button"
                    onClick={() =>
                      setAnchorIso(computeAnchorIsoForTodayWeekday(now, day.index))
                    }
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 font-mono tabular-nums ${
                      isToday
                        ? 'bg-[#111315] text-white'
                        : 'text-[#475569] hover:text-[#111315] hover:bg-white/60'
                    }`}
                  >
                    {`${day.index}. ${day.name}`}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 1: Circle Time Dial + Inspector */}
        {activeTab === 'dial' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Dominant Visual Anchor: 00-24 Circle Time Widget */}
            <section className="lg:col-span-7 bg-white border border-[#E4E5E2] rounded-xl p-5 sm:p-7 flex flex-col gap-5">
              {/* Dial Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 p-1 bg-[#F3F4F1] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setIsLiveMode(true)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      isLiveMode
                        ? 'bg-white text-[#111315] shadow-xs'
                        : 'text-[#64748B] hover:text-[#111315]'
                    }`}
                  >
                    Live Time
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsLiveMode(false);
                      setScrubMinutes(liveMinutes);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      !isLiveMode
                        ? 'bg-white text-[#111315] shadow-xs'
                        : 'text-[#64748B] hover:text-[#111315]'
                    }`}
                  >
                    Scrub 00–24
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 p-1 bg-[#F3F4F1] rounded-lg">
                    <button
                      type="button"
                      onClick={() =>
                        setDialConfig((c) => ({ ...c, dialTheme: 'light' }))
                      }
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        dialConfig.dialTheme === 'light'
                          ? 'bg-white text-[#111315] shadow-xs'
                          : 'text-[#64748B] hover:text-[#111315]'
                      }`}
                    >
                      Light Dial
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDialConfig((c) => ({ ...c, dialTheme: 'obsidian' }))
                      }
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        dialConfig.dialTheme === 'obsidian'
                          ? 'bg-white text-[#111315] shadow-xs'
                          : 'text-[#64748B] hover:text-[#111315]'
                      }`}
                    >
                      Obsidian
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setDialConfig((c) => ({
                        ...c,
                        zeroPosition: c.zeroPosition === 'top' ? 'bottom' : 'top',
                      }))
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#334155] bg-[#FAFAF8] border border-[#E4E5E2] hover:border-[#CBD5E1] rounded-lg transition-colors whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {dialConfig.zeroPosition === 'top' ? '00 at Top' : '00 at Bottom'}
                  </button>
                </div>
              </div>

              {/* Scrubber Slider when in Scrub Mode */}
              {!isLiveMode && (
                <div className="px-4 py-3 bg-[#FAFAF8] border border-[#E4E5E2] rounded-lg flex items-center gap-4">
                  <span className="text-xs font-medium text-[#475569] whitespace-nowrap">
                    Inspect Hour
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={MINUTES_IN_DAY - 1}
                    step={dialConfig.snapMinutes}
                    value={scrubMinutes}
                    onChange={(e) => setScrubMinutes(Number(e.target.value))}
                    className="flex-1 accent-[#D9381E]"
                    aria-label="Scrub 00 to 24 hour time"
                  />
                  <span className="text-xs font-mono tabular-nums font-semibold text-[#111315] w-12 text-right">
                    {formatMinutes(scrubMinutes)}
                  </span>
                </div>
              )}

              {/* The 00-24 Circle Time Dial */}
              <div className="w-full max-w-[540px] mx-auto">
                <CircleTimeDial
                  blocks={blocks}
                  selectedBlockId={selectedBlockId}
                  onSelectBlock={setSelectedBlockId}
                  onUpdateBlockTime={handleUpdateBlockTime}
                  onCreateBlockFromArc={handleCreateBlockFromArc}
                  dialConfig={dialConfig}
                  currentMinutes={displayMinutes}
                  currentSeconds={displaySeconds}
                  currentDate={now}
                  nineDayInfo={nineDayInfo}
                  isLiveMode={isLiveMode}
                  onScrubMinutes={(m) => {
                    setIsLiveMode(false);
                    setScrubMinutes(m);
                  }}
                  svgRefExternal={dialSvgRef}
                />
              </div>

              {/* Bottom Dial Hint & Snap Control */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#ECEEE9] text-xs text-[#64748B]">
                <span>
                  Click any arc to edit, drag handle dots to resize, or drag on empty
                  ring track to draw a block.
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span>Snap:</span>
                  {([5, 15, 30] as const).map((step) => (
                    <button
                      key={step}
                      type="button"
                      onClick={() =>
                        setDialConfig((c) => ({ ...c, snapMinutes: step }))
                      }
                      className={`px-2 py-0.5 rounded font-mono tabular-nums transition-colors ${
                        dialConfig.snapMinutes === step
                          ? 'bg-[#111315] text-white'
                          : 'bg-[#F3F4F1] text-[#475569] hover:text-[#111315]'
                      }`}
                    >
                      {step}m
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Right Column: Inspector + 24h Allocation Breakdown */}
            <aside className="lg:col-span-5 flex flex-col gap-6">
              <BlockInspector
                blocks={blocks}
                selectedBlock={selectedBlock}
                currentMinutes={displayMinutes}
                overlapIds={coverage.overlapIds}
                onSelectBlock={setSelectedBlockId}
                onUpdateBlock={handleUpdateBlock}
                onDeleteBlock={handleDeleteBlock}
                onAddBlock={handleAddBlock}
              />

              {/* 24-Hour Allocation Summary */}
              <div className="bg-white border border-[#E4E5E2] rounded-xl p-6 flex flex-col gap-4">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold text-[#111315] font-display">
                    24-Hour Allocation
                  </h3>
                  <span className="text-xs font-mono tabular-nums text-[#64748B]">
                    {Math.round((coverage.totalMinutes / MINUTES_IN_DAY) * 100)}% of
                    24h
                  </span>
                </div>

                {/* Stacked Proportional Bar */}
                <div className="h-2.5 w-full rounded-full bg-[#F3F4F1] overflow-hidden flex">
                  {(Object.keys(CATEGORY_META) as CategoryKey[]).map((key) => {
                    const mins = categoryBreakdown[key];
                    if (mins <= 0) return null;
                    const pct = Math.min(100, (mins / MINUTES_IN_DAY) * 100);
                    return (
                      <div
                        key={key}
                        style={{
                          width: `${pct}%`,
                          backgroundColor: CATEGORY_META[key].color,
                        }}
                        title={`${CATEGORY_META[key].label}: ${formatDuration(mins)}`}
                      />
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  {(Object.keys(CATEGORY_META) as CategoryKey[]).map((key) => {
                    const mins = categoryBreakdown[key];
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between py-1 border-b border-[#F3F4F1]"
                      >
                        <span className="flex items-center gap-2 text-[#475569]">
                          <span
                            className="w-2 h-2 rounded-sm shrink-0"
                            style={{ backgroundColor: CATEGORY_META[key].color }}
                          />
                          {CATEGORY_META[key].label}
                        </span>
                        <span className="font-mono tabular-nums text-[#111315]">
                          {formatDuration(mins)}
                        </span>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between py-1 border-b border-[#F3F4F1]">
                    <span className="text-[#64748B]">Unallocated</span>
                    <span className="font-mono tabular-nums text-[#64748B]">
                      {formatDuration(
                        Math.max(0, MINUTES_IN_DAY - coverage.totalMinutes)
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Tab 2: Schedule Sheet */}
        {activeTab === 'sheet' && (
          <ScheduleTable
            blocks={blocks}
            selectedBlockId={selectedBlockId}
            overlapIds={coverage.overlapIds}
            onSelectOnDial={(id) => {
              setSelectedBlockId(id);
              setActiveTab('dial');
            }}
            onDeleteBlock={handleDeleteBlock}
            onOpenImport={() => setActiveTab('sync')}
          />
        )}

        {/* Tab 3: OneDrive Sync & Excel Importer */}
        {activeTab === 'sync' && (
          <WorkbookSyncPanel
            sourceInfo={sourceInfo}
            onUpdateSourceUrl={(url) =>
              setSourceInfo((prev) => ({ ...prev, oneDriveUrl: url }))
            }
            onApplyImportedBlocks={handleApplyImportedBlocks}
            onResetDefault={handleResetDefault}
          />
        )}

        {/* Tab 4: Standalone Widget Showcase & Export */}
        {activeTab === 'widget' && (
          <WidgetShowcaseView
            blocks={blocks}
            dialConfig={dialConfig}
            onChangeDialConfig={(next) =>
              setDialConfig((prev) => ({ ...prev, ...next }))
            }
            currentMinutes={displayMinutes}
            currentSeconds={displaySeconds}
            currentDate={now}
            nineDayInfo={nineDayInfo}
            anchorIso={anchorIso}
            isLiveMode={isLiveMode}
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-[#E4E5E2] bg-white mt-auto">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-[#64748B]">
          <span>391K · 00–24 Circle Time Widget</span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('sheet')}
              className="hover:text-[#111315] transition-colors"
            >
              Schedule Sheet
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sync')}
              className="hover:text-[#111315] transition-colors"
            >
              OneDrive Import
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('widget')}
              className="hover:text-[#111315] transition-colors"
            >
              Export SVG
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
