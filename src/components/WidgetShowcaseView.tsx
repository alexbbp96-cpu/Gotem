import React, { useRef, useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { CATEGORY_META, DialConfig, TimeBlock } from '../types/schedule';
import {
  formatDuration,
  formatMinutes,
  getDurationMinutes,
  isMinuteInBlock,
} from '../utils/timeMath';
import { CircleTimeDial } from './CircleTimeDial';
import { NineDayInfo } from '../utils/nineDayCalendar';

interface WidgetShowcaseViewProps {
  blocks: TimeBlock[];
  dialConfig: DialConfig;
  onChangeDialConfig: (next: Partial<DialConfig>) => void;
  currentMinutes: number;
  currentSeconds: number;
  currentDate: Date;
  nineDayInfo: NineDayInfo;
  anchorIso: string;
  isLiveMode: boolean;
}

export const WidgetShowcaseView: React.FC<WidgetShowcaseViewProps> = ({
  blocks,
  dialConfig,
  onChangeDialConfig,
  currentMinutes,
  currentSeconds,
  currentDate,
  nineDayInfo,
  anchorIso,
  isLiveMode,
}) => {
  const widgetSvgRef = useRef<SVGSVGElement | null>(null);
  const [widgetSize, setWidgetSize] = useState<'compact' | 'standard'>('standard');
  const [copiedType, setCopiedType] = useState<'json' | 'html' | null>(null);

  const activeBlock = blocks.find((b) => isMinuteInBlock(currentMinutes, b)) ?? null;

  const handleDownloadSvg = () => {
    const svgEl = widgetSvgRef.current;
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgEl);
    if (!source.includes('xmlns="http://www.w3.org/2000/svg"')) {
      source = source.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '391K-circle-time-00-24.svg';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyJson = async () => {
    const payload = JSON.stringify(
      {
        brand: '391K',
        scale: '00-24',
        dialConfig,
        blocks: blocks.map((b) => ({
          title: b.title,
          start: formatMinutes(b.startMinutes),
          end: formatMinutes(b.endMinutes, true),
          category: b.category,
          owner: b.owner,
        })),
      },
      null,
      2
    );
    await navigator.clipboard.writeText(payload);
    setCopiedType('json');
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleCopyEmbed = async () => {
    const snippet = `<iframe src="${window.location.origin}/?widget=1&theme=${dialConfig.dialTheme}&zero=${dialConfig.zeroPosition}&anchor=${anchorIso}" width="${
      widgetSize === 'compact' ? 360 : 480
    }" height="${
      widgetSize === 'compact' ? 420 : 540
    }" style="border:1px solid #E4E5E2;border-radius:16px;" title="391K 00-24 Circle Time Widget"></iframe>`;
    await navigator.clipboard.writeText(snippet);
    setCopiedType('html');
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Standalone Widget Frame Preview */}
      <div className="lg:col-span-7 flex flex-col items-center justify-center bg-[#ECEEE9]/70 border border-[#E4E5E2] rounded-xl p-6 sm:p-10">
        <div
          className={`w-full transition-all duration-200 rounded-2xl border p-5 ${
            dialConfig.dialTheme === 'obsidian'
              ? 'bg-[#0C0E12] border-[#282E38] text-[#F8FAFC]'
              : 'bg-white border-[#E4E5E2] text-[#111315]'
          } ${widgetSize === 'compact' ? 'max-w-[340px]' : 'max-w-[460px]'}`}
        >
          <div className="flex items-baseline justify-between mb-3">
            <span className="font-display font-bold tracking-tight text-base">
              391K
            </span>
            <span
              className={`text-xs font-mono tabular-nums ${
                dialConfig.dialTheme === 'obsidian'
                  ? 'text-[#94A3B8]'
                  : 'text-[#64748B]'
              }`}
            >
              {`${nineDayInfo.shortName} · ${nineDayInfo.dayOfMonth} ${nineDayInfo.monthShort} ${nineDayInfo.year}`}
            </span>
          </div>

          <CircleTimeDial
            blocks={blocks}
            selectedBlockId={null}
            onSelectBlock={() => {}}
            onUpdateBlockTime={() => {}}
            onCreateBlockFromArc={() => {}}
            dialConfig={dialConfig}
            currentMinutes={currentMinutes}
            currentSeconds={currentSeconds}
            currentDate={currentDate}
            nineDayInfo={nineDayInfo}
            isLiveMode={isLiveMode}
            compact
            svgRefExternal={widgetSvgRef}
          />

          <div
            className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
              dialConfig.dialTheme === 'obsidian'
                ? 'border-[#1F242D] text-[#94A3B8]'
                : 'border-[#ECEEE9] text-[#64748B]'
            }`}
          >
            <span className="truncate pr-3">
              {activeBlock ? (
                <>
                  <span
                    className="inline-block w-2 h-2 rounded-sm mr-1.5 align-middle"
                    style={{
                      backgroundColor: CATEGORY_META[activeBlock.category].color,
                    }}
                  />
                  <span
                    className={
                      dialConfig.dialTheme === 'obsidian'
                        ? 'text-[#F8FAFC] font-medium'
                        : 'text-[#111315] font-medium'
                    }
                  >
                    {activeBlock.title}
                  </span>
                </>
              ) : (
                'Unscheduled window'
              )}
            </span>
            <span className="font-mono tabular-nums shrink-0">
              {activeBlock
                ? formatDuration(
                    getDurationMinutes(
                      activeBlock.startMinutes,
                      activeBlock.endMinutes
                    )
                  )
                : `${blocks.length} blocks`}
            </span>
          </div>
        </div>
      </div>

      {/* Widget Configuration & Export Controls */}
      <div className="lg:col-span-5 bg-white border border-[#E4E5E2] rounded-xl p-6 flex flex-col gap-5">
        <div>
          <p className="text-xs font-medium text-[#64748B]">Standalone Widget</p>
          <h2 className="text-lg font-semibold text-[#111315] font-display mt-0.5">
            391K Circle Widget Export
          </h2>
          <p className="text-sm text-[#475569] mt-1.5 leading-relaxed">
            Configure the standalone 00–24 widget finish, orientation, and size, or
            export a vector SVG snapshot of the current dial.
          </p>
        </div>

        <div className="space-y-4 border-t border-[#ECEEE9] pt-4">
          <div>
            <label className="block text-xs font-medium text-[#475569] mb-1.5">
              Dial Finish
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#F3F4F1] rounded-lg">
              <button
                type="button"
                onClick={() => onChangeDialConfig({ dialTheme: 'light' })}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                  dialConfig.dialTheme === 'light'
                    ? 'bg-white text-[#111315] shadow-xs'
                    : 'text-[#64748B] hover:text-[#111315]'
                }`}
              >
                Porcelain Light
              </button>
              <button
                type="button"
                onClick={() => onChangeDialConfig({ dialTheme: 'obsidian' })}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                  dialConfig.dialTheme === 'obsidian'
                    ? 'bg-white text-[#111315] shadow-xs'
                    : 'text-[#64748B] hover:text-[#111315]'
                }`}
              >
                Obsidian Dark
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#475569] mb-1.5">
              00:00 Midnight Position
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#F3F4F1] rounded-lg">
              <button
                type="button"
                onClick={() => onChangeDialConfig({ zeroPosition: 'top' })}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                  dialConfig.zeroPosition === 'top'
                    ? 'bg-white text-[#111315] shadow-xs'
                    : 'text-[#64748B] hover:text-[#111315]'
                }`}
              >
                00 at Top (12h)
              </button>
              <button
                type="button"
                onClick={() => onChangeDialConfig({ zeroPosition: 'bottom' })}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                  dialConfig.zeroPosition === 'bottom'
                    ? 'bg-white text-[#111315] shadow-xs'
                    : 'text-[#64748B] hover:text-[#111315]'
                }`}
              >
                00 at Bottom (Solar)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#475569] mb-1.5">
              Widget Card Footprint
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#F3F4F1] rounded-lg">
              <button
                type="button"
                onClick={() => setWidgetSize('compact')}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                  widgetSize === 'compact'
                    ? 'bg-white text-[#111315] shadow-xs'
                    : 'text-[#64748B] hover:text-[#111315]'
                }`}
              >
                Compact (340px)
              </button>
              <button
                type="button"
                onClick={() => setWidgetSize('standard')}
                className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                  widgetSize === 'standard'
                    ? 'bg-white text-[#111315] shadow-xs'
                    : 'text-[#64748B] hover:text-[#111315]'
                }`}
              >
                Standard (460px)
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-[#ECEEE9] pt-4 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleDownloadSvg}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#111315] hover:bg-[#272A2E] rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download 391K Dial (.svg)
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleCopyEmbed}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-[#334155] bg-[#FAFAF8] border border-[#E4E5E2] hover:border-[#CBD5E1] rounded-lg transition-colors"
            >
              {copiedType === 'html' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#15803D]" />
                  Copied Embed
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Embed Code
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleCopyJson}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-[#334155] bg-[#FAFAF8] border border-[#E4E5E2] hover:border-[#CBD5E1] rounded-lg transition-colors"
            >
              {copiedType === 'json' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#15803D]" />
                  Copied JSON
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Schedule JSON
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
