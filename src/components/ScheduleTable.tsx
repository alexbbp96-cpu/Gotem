import React, { useMemo, useState } from 'react';
import { Download, Search, Trash2 } from 'lucide-react';
import { CATEGORY_META, CategoryKey, TimeBlock } from '../types/schedule';
import { exportBlocksToCsv, exportBlocksToXlsx } from '../utils/excelWorkbook';
import {
  formatDuration,
  formatMinutes,
  getDurationMinutes,
} from '../utils/timeMath';

interface ScheduleTableProps {
  blocks: TimeBlock[];
  selectedBlockId: string | null;
  overlapIds: Set<string>;
  onSelectOnDial: (id: string) => void;
  onDeleteBlock: (id: string) => void;
  onOpenImport: () => void;
}

export const ScheduleTable: React.FC<ScheduleTableProps> = ({
  blocks,
  selectedBlockId,
  overlapIds,
  onSelectOnDial,
  onDeleteBlock,
  onOpenImport,
}) => {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryKey | 'all'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...blocks]
      .sort((a, b) => a.startMinutes - b.startMinutes)
      .filter((b) => {
        if (categoryFilter !== 'all' && b.category !== categoryFilter) return false;
        if (!q) return true;
        return (
          b.title.toLowerCase().includes(q) ||
          (b.owner ?? '').toLowerCase().includes(q) ||
          b.notes.toLowerCase().includes(q)
        );
      });
  }, [blocks, categoryFilter, query]);

  return (
    <div className="bg-white border border-[#E4E5E2] rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 sm:px-6 border-b border-[#ECEEE9] flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter schedule rows..."
              className="pl-8 pr-3 py-1.5 text-xs bg-[#FAFAF8] border border-[#E4E5E2] rounded-lg focus:outline-none focus:border-[#111315] w-56"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#F3F4F1] rounded-lg overflow-x-auto">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                categoryFilter === 'all'
                  ? 'bg-white text-[#111315] shadow-xs'
                  : 'text-[#64748B] hover:text-[#111315]'
              }`}
            >
              All ({blocks.length})
            </button>
            {(Object.keys(CATEGORY_META) as CategoryKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategoryFilter(key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  categoryFilter === key
                    ? 'bg-white text-[#111315] shadow-xs'
                    : 'text-[#64748B] hover:text-[#111315]'
                }`}
              >
                {CATEGORY_META[key].label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => exportBlocksToCsv(blocks)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#334155] bg-[#FAFAF8] border border-[#E4E5E2] hover:border-[#CBD5E1] rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => exportBlocksToXlsx(blocks)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#111315] hover:bg-[#272A2E] rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export .xlsx
          </button>
        </div>
      </div>

      {/* Data Table */}
      {filtered.length === 0 ? (
        <div className="py-14 px-6 text-center">
          <p className="text-sm font-medium text-[#111315]">
            {blocks.length === 0
              ? 'No 24-hour blocks scheduled yet'
              : 'No blocks match your current filter'}
          </p>
          <p className="text-xs text-[#64748B] mt-1">
            {blocks.length === 0
              ? 'Import rows from your OneDrive Excel workbook or drag directly on the 00–24 dial.'
              : 'Clear the search text or switch category filter.'}
          </p>
          {blocks.length === 0 && (
            <button
              type="button"
              onClick={onOpenImport}
              className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-[#111315] rounded-lg hover:bg-[#272A2E] transition-colors"
            >
              Import Excel Workbook
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#ECEEE9] bg-[#FAFAF8] text-[11px] font-semibold text-[#64748B]">
                <th className="py-2.5 pl-6 pr-3">Window (00–24)</th>
                <th className="py-2.5 px-3">Title</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Owner</th>
                <th className="py-2.5 px-3 text-right">Duration</th>
                <th className="py-2.5 pl-3 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECEEE9] text-sm">
              {filtered.map((block) => {
                const dur = getDurationMinutes(block.startMinutes, block.endMinutes);
                const meta = CATEGORY_META[block.category];
                const isSelected = block.id === selectedBlockId;
                const hasOverlap = overlapIds.has(block.id);

                return (
                  <tr
                    key={block.id}
                    onClick={() => onSelectOnDial(block.id)}
                    className={`h-11 cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#F3F4F1]' : 'hover:bg-[#FAFAF8]'
                    }`}
                  >
                    <td className="py-2 pl-6 pr-3 font-mono text-xs tabular-nums text-[#111315] whitespace-nowrap">
                      {formatMinutes(block.startMinutes)}–
                      {formatMinutes(block.endMinutes, true)}
                      {hasOverlap && (
                        <span className="ml-2 font-sans text-[11px] font-medium text-[#B45309]">
                          Overlap
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-medium text-[#111315] max-w-[260px] truncate">
                      {block.title}
                    </td>
                    <td className="py-2 px-3 text-xs text-[#475569] whitespace-nowrap">
                      <span
                        className="inline-block w-2 h-2 rounded-sm mr-2 align-middle"
                        style={{ backgroundColor: meta.color }}
                      />
                      {meta.label}
                    </td>
                    <td className="py-2 px-3 text-xs text-[#64748B] whitespace-nowrap">
                      {block.owner || '—'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-xs tabular-nums text-[#475569] whitespace-nowrap">
                      {formatDuration(dur)}
                    </td>
                    <td className="py-2 pl-3 pr-6 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteBlock(block.id);
                        }}
                        aria-label={`Delete ${block.title}`}
                        className="p-1.5 text-[#64748B] hover:text-[#DC2626] rounded-md hover:bg-[#FEF2F2] transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
