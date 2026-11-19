import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { CATEGORY_META, CategoryKey, TimeBlock } from '../types/schedule';
import {
  formatDuration,
  formatMinutes,
  getDurationMinutes,
  isMinuteInBlock,
  MINUTES_IN_DAY,
  parseFlexibleTime,
} from '../utils/timeMath';

interface BlockInspectorProps {
  blocks: TimeBlock[];
  selectedBlock: TimeBlock | null;
  currentMinutes: number;
  overlapIds: Set<string>;
  onSelectBlock: (id: string | null) => void;
  onUpdateBlock: (updated: TimeBlock) => void;
  onDeleteBlock: (id: string) => void;
  onAddBlock: (newBlock: Omit<TimeBlock, 'id'>) => void;
}

const CATEGORIES: CategoryKey[] = ['operations', 'focus', 'sync', 'transit', 'rest'];

export const BlockInspector: React.FC<BlockInspectorProps> = ({
  blocks,
  selectedBlock,
  currentMinutes,
  overlapIds,
  onSelectBlock,
  onUpdateBlock,
  onDeleteBlock,
  onAddBlock,
}) => {
  const [title, setTitle] = useState('');
  const [startStr, setStartStr] = useState('09:00');
  const [endStr, setEndStr] = useState('11:00');
  const [category, setCategory] = useState<CategoryKey>('focus');
  const [owner, setOwner] = useState('');
  const [notes, setNotes] = useState('');
  const [timeError, setTimeError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedBlock) {
      setTitle(selectedBlock.title);
      setStartStr(formatMinutes(selectedBlock.startMinutes, false));
      setEndStr(formatMinutes(selectedBlock.endMinutes, true));
      setCategory(selectedBlock.category);
      setOwner(selectedBlock.owner ?? '');
      setNotes(selectedBlock.notes);
      setTimeError(null);
    } else {
      setTitle('');
      setStartStr('09:00');
      setEndStr('10:30');
      setCategory('operations');
      setOwner('');
      setNotes('');
      setTimeError(null);
    }
  }, [selectedBlock]);

  const handleSaveSelected = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBlock) return;
    const s = parseFlexibleTime(startStr);
    const en = parseFlexibleTime(endStr);
    if (s === null || en === null || s === en) {
      setTimeError('Enter valid 24h times (e.g. 08:30 and 17:00).');
      return;
    }
    setTimeError(null);
    onUpdateBlock({
      ...selectedBlock,
      title: title.trim() || 'Untitled Block',
      startMinutes: s === MINUTES_IN_DAY ? 0 : s,
      endMinutes: en,
      category,
      owner: owner.trim() || undefined,
      notes: notes.trim(),
    });
  };

  const handleCreateNew = (e: React.FormEvent) => {
    e.preventDefault();
    const s = parseFlexibleTime(startStr);
    const en = parseFlexibleTime(endStr);
    if (s === null || en === null || s === en) {
      setTimeError('Enter valid 24h times (e.g. 14:00 and 16:00).');
      return;
    }
    setTimeError(null);
    onAddBlock({
      title: title.trim() || 'Scheduled Block',
      startMinutes: s === MINUTES_IN_DAY ? 0 : s,
      endMinutes: en,
      category,
      owner: owner.trim() || undefined,
      notes: notes.trim(),
    });
    setTitle('');
    setNotes('');
  };

  const activeNow = blocks.filter((b) => isMinuteInBlock(currentMinutes, b));
  const sortedBlocks = [...blocks].sort((a, b) => a.startMinutes - b.startMinutes);
  const nextUpcoming =
    sortedBlocks.find((b) => b.startMinutes > currentMinutes) ?? sortedBlocks[0] ?? null;

  if (selectedBlock) {
    const dur = getDurationMinutes(selectedBlock.startMinutes, selectedBlock.endMinutes);
    const hasOverlap = overlapIds.has(selectedBlock.id);

    return (
      <div className="bg-white border border-[#E4E5E2] rounded-xl p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4 border-b border-[#ECEEE9] pb-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#64748B]">Selected Time Block</p>
            <h2 className="text-lg font-semibold text-[#111315] truncate mt-0.5 font-display">
              {selectedBlock.title}
            </h2>
            <div className="flex items-center gap-2 text-xs text-[#64748B] mt-1 font-mono tabular-nums">
              <span>
                {formatMinutes(selectedBlock.startMinutes)}–
                {formatMinutes(selectedBlock.endMinutes, true)}
              </span>
              <span aria-hidden="true">·</span>
              <span>{formatDuration(dur)}</span>
              {hasOverlap && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#B45309] font-sans font-medium">
                    Overlaps another block
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectBlock(null)}
            className="text-xs font-medium text-[#475569] hover:text-[#111315] px-2.5 py-1.5 rounded-md border border-[#E4E5E2] hover:bg-[#F6F6F4] transition-colors whitespace-nowrap shrink-0"
          >
            Done
          </button>
        </div>

        <form onSubmit={handleSaveSelected} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-[#475569] mb-1.5">
              Block Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Morning Production"
              className="w-full px-3 py-2 text-sm bg-[#FAFAF8] border border-[#E4E5E2] rounded-lg focus:outline-none focus:border-[#111315] text-[#111315]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1.5">
                Start (00:00–23:59)
              </label>
              <input
                type="text"
                value={startStr}
                onChange={(e) => setStartStr(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#FAFAF8] border border-[#E4E5E2] rounded-lg focus:outline-none focus:border-[#111315] text-[#111315]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1.5">
                End (00:01–24:00)
              </label>
              <input
                type="text"
                value={endStr}
                onChange={(e) => setEndStr(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#FAFAF8] border border-[#E4E5E2] rounded-lg focus:outline-none focus:border-[#111315] text-[#111315]"
              />
            </div>
          </div>

          {timeError && (
            <p className="text-xs font-medium text-[#DC2626]">{timeError}</p>
          )}

          <div>
            <label className="block text-xs font-medium text-[#475569] mb-1.5">
              Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {CATEGORIES.map((cat) => {
                const meta = CATEGORY_META[cat];
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-2.5 py-2 text-xs font-medium rounded-lg border text-left transition-colors flex items-center gap-2 whitespace-nowrap ${
                      active
                        ? 'bg-[#111315] text-white border-[#111315]'
                        : 'bg-[#FAFAF8] text-[#334155] border-[#E4E5E2] hover:border-[#CBD5E1]'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: meta.color }}
                    />
                    <span className="truncate">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#475569] mb-1.5">
              Owner / Team
            </label>
            <input
              type="text"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="Optional owner"
              className="w-full px-3 py-2 text-sm bg-[#FAFAF8] border border-[#E4E5E2] rounded-lg focus:outline-none focus:border-[#111315] text-[#111315]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#475569] mb-1.5">
              Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Operational details or spreadsheet notes"
              className="w-full px-3 py-2 text-sm bg-[#FAFAF8] border border-[#E4E5E2] rounded-lg focus:outline-none focus:border-[#111315] text-[#111315] resize-none"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#ECEEE9]">
            <button
              type="button"
              onClick={() => onDeleteBlock(selectedBlock.id)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg transition-colors whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Block
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-[#111315] hover:bg-[#272A2E] rounded-lg transition-colors whitespace-nowrap"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E4E5E2] rounded-xl p-6 flex flex-col gap-6">
      {/* Current Cycle Snapshot */}
      <div className="border-b border-[#ECEEE9] pb-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-base font-semibold text-[#111315] font-display">
            Cycle Overview
          </h2>
          <span className="text-xs font-mono tabular-nums text-[#64748B]">
            {formatMinutes(currentMinutes)} / 24:00
          </span>
        </div>

        <div className="mt-3 space-y-2.5">
          {activeNow.length > 0 ? (
            activeNow.map((blk) => (
              <button
                key={blk.id}
                type="button"
                onClick={() => onSelectBlock(blk.id)}
                className="w-full text-left p-3 rounded-lg bg-[#FAFAF8] border border-[#E4E5E2] hover:border-[#94A3B8] transition-colors flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-[#64748B]">
                    <span
                      className="w-2 h-2 rounded-sm shrink-0"
                      style={{ backgroundColor: CATEGORY_META[blk.category].color }}
                    />
                    <span>Active now</span>
                    <span aria-hidden="true">·</span>
                    <span>{CATEGORY_META[blk.category].label}</span>
                  </div>
                  <p className="text-sm font-semibold text-[#111315] truncate mt-0.5">
                    {blk.title}
                  </p>
                </div>
                <span className="text-xs font-mono tabular-nums text-[#475569] shrink-0">
                  {formatMinutes(blk.startMinutes)}–{formatMinutes(blk.endMinutes, true)}
                </span>
              </button>
            ))
          ) : (
            <div className="p-3 rounded-lg bg-[#FAFAF8] border border-[#E4E5E2] text-xs text-[#64748B]">
              No block active at {formatMinutes(currentMinutes)}. Drag directly on the
              00–24 ring or use the form below to schedule this window.
            </div>
          )}

          {nextUpcoming && !activeNow.some((a) => a.id === nextUpcoming.id) && (
            <div className="flex items-center justify-between text-xs text-[#64748B] pt-1">
              <span>
                Next:{' '}
                <button
                  type="button"
                  onClick={() => onSelectBlock(nextUpcoming.id)}
                  className="font-medium text-[#111315] hover:underline"
                >
                  {nextUpcoming.title}
                </button>
              </span>
              <span className="font-mono tabular-nums">
                {formatMinutes(nextUpcoming.startMinutes)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Add Block Form */}
      <form onSubmit={handleCreateNew} className="flex flex-col gap-3.5">
        <h3 className="text-sm font-semibold text-[#111315] font-display">
          Add 24h Block
        </h3>
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Block title (e.g. Nightly Audit)"
            className="w-full px-3 py-2 text-sm bg-[#FAFAF8] border border-[#E4E5E2] rounded-lg focus:outline-none focus:border-[#111315] text-[#111315]"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-[#64748B] mb-1">
              Start
            </label>
            <input
              type="text"
              value={startStr}
              onChange={(e) => setStartStr(e.target.value)}
              className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-[#FAFAF8] border border-[#E4E5E2] rounded-lg focus:outline-none focus:border-[#111315]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#64748B] mb-1">
              End
            </label>
            <input
              type="text"
              value={endStr}
              onChange={(e) => setEndStr(e.target.value)}
              className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-[#FAFAF8] border border-[#E4E5E2] rounded-lg focus:outline-none focus:border-[#111315]"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const active = category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  active
                    ? 'bg-[#111315] text-white border-[#111315]'
                    : 'bg-[#FAFAF8] text-[#475569] border-[#E4E5E2] hover:text-[#111315]'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{ backgroundColor: meta.color }}
                />
                {meta.label}
              </button>
            );
          })}
        </div>

        {timeError && (
          <p className="text-xs font-medium text-[#DC2626]">{timeError}</p>
        )}

        <button
          type="submit"
          className="mt-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#111315] hover:bg-[#272A2E] rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          Add to 00–24 Circle
        </button>
      </form>
    </div>
  );
};
