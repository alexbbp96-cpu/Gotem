import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  ClipboardPaste,
  ExternalLink,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import { TimeBlock, WorkbookSourceInfo } from '../types/schedule';
import {
  autoDetectMapping,
  ColumnMapping,
  mapRowsToTimeBlocks,
  ParsedSheetPreview,
  parsePastedTabularText,
  parseSpreadsheetFile,
} from '../utils/excelWorkbook';
import { formatDuration, formatMinutes, getDurationMinutes } from '../utils/timeMath';

interface WorkbookSyncPanelProps {
  sourceInfo: WorkbookSourceInfo;
  onUpdateSourceUrl: (url: string) => void;
  onApplyImportedBlocks: (
    blocks: TimeBlock[],
    mode: 'replace' | 'merge',
    meta: { fileName: string; sheetName: string; rowCount: number }
  ) => void;
  onResetDefault: () => void;
}

export const WorkbookSyncPanel: React.FC<WorkbookSyncPanelProps> = ({
  sourceInfo,
  onUpdateSourceUrl,
  onApplyImportedBlocks,
  onResetDefault,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [urlDraft, setUrlDraft] = useState(sourceInfo.oneDriveUrl);
  const [urlSaved, setUrlSaved] = useState(false);

  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
  const [pasteText, setPasteText] = useState('');
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedSheetPreview | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({
    titleCol: '',
    startCol: '',
    endCol: '',
    categoryCol: '',
    ownerCol: '',
    notesCol: '',
  });
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSourceUrl(urlDraft.trim());
    setUrlSaved(true);
    setTimeout(() => setUrlSaved(false), 2000);
  };

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    setImportError(null);
    setImportSuccess(null);
    try {
      const parsed = await parseSpreadsheetFile(file);
      setActiveFile(file);
      setPreview(parsed);
      setMapping(autoDetectMapping(parsed.headers));
    } catch {
      setImportError(
        'Could not read this file. Upload a valid .xlsx, .xls, or .csv workbook.'
      );
    }
  };

  const handleSheetSwitch = async (sheetName: string) => {
    if (!activeFile) return;
    const parsed = await parseSpreadsheetFile(activeFile, sheetName);
    setPreview(parsed);
    setMapping(autoDetectMapping(parsed.headers));
  };

  const handleParsePaste = () => {
    setImportError(null);
    setImportSuccess(null);
    if (!pasteText.trim()) {
      setImportError('Paste rows copied from OneDrive Excel or Google Sheets first.');
      return;
    }
    const parsed = parsePastedTabularText(pasteText);
    if (parsed.rows.length === 0) {
      setImportError('No data rows detected in the pasted text.');
      return;
    }
    setActiveFile(null);
    setPreview(parsed);
    setMapping(autoDetectMapping(parsed.headers));
  };

  const mappedResult = useMemo(() => {
    if (!preview) return { blocks: [], skippedCount: 0 };
    return mapRowsToTimeBlocks(preview.rows, mapping);
  }, [preview, mapping]);

  const handleApply = (mode: 'replace' | 'merge') => {
    if (!preview || mappedResult.blocks.length === 0) {
      setImportError(
        'No valid 00–24 time rows mapped yet. Check your Start and End column selections.'
      );
      return;
    }
    onApplyImportedBlocks(mappedResult.blocks, mode, {
      fileName: preview.fileName,
      sheetName: preview.activeSheet,
      rowCount: mappedResult.blocks.length,
    });
    setImportSuccess(
      `${mappedResult.blocks.length} time block${
        mappedResult.blocks.length === 1 ? '' : 's'
      } ${mode === 'replace' ? 'loaded onto' : 'added to'} the 391K 00–24 dial.`
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Linked OneDrive Workbook & Instructions */}
      <div className="lg:col-span-5 bg-white border border-[#E4E5E2] rounded-xl p-6 flex flex-col gap-5">
        <div>
          <p className="text-xs font-medium text-[#64748B]">Workbook Source</p>
          <h2 className="text-lg font-semibold text-[#111315] font-display mt-0.5">
            OneDrive Excel Connection
          </h2>
          <p className="text-sm text-[#475569] mt-2 leading-relaxed">
            Your OneDrive spreadsheet requires an authenticated Microsoft browser
            session, so direct background fetching is blocked by Microsoft. Open
            your sheet below to copy rows directly or download a copy as{' '}
            <span className="font-mono text-xs text-[#111315]">.xlsx</span>.
          </p>
        </div>

        <form onSubmit={handleSaveUrl} className="flex flex-col gap-2.5">
          <label className="text-xs font-medium text-[#475569]">
            OneDrive Workbook URL
          </label>
          <input
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            className="w-full px-3 py-2 text-xs font-mono bg-[#FAFAF8] border border-[#E4E5E2] rounded-lg focus:outline-none focus:border-[#111315] text-[#111315]"
          />
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <a
              href={sourceInfo.oneDriveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#111315] hover:bg-[#272A2E] rounded-lg transition-colors whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in OneDrive
            </a>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#334155] bg-[#FAFAF8] border border-[#E4E5E2] hover:border-[#CBD5E1] rounded-lg transition-colors whitespace-nowrap"
            >
              {urlSaved ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#15803D]" />
                  Saved
                </>
              ) : (
                'Save Link'
              )}
            </button>
          </div>
        </form>

        <div className="border-t border-[#ECEEE9] pt-4 text-xs text-[#64748B] space-y-2">
          <div className="flex items-center justify-between">
            <span>Active workbook</span>
            <span className="font-mono text-[#111315]">{sourceInfo.fileName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Sheet tab</span>
            <span className="font-mono text-[#111315]">{sourceInfo.sheetName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Last sync</span>
            <span className="font-mono text-[#111315]">
              {sourceInfo.lastImportedAt ?? 'Default 391K cycle'}
            </span>
          </div>
        </div>

        <div className="border-t border-[#ECEEE9] pt-4 flex items-center justify-between">
          <span className="text-xs text-[#64748B]">Restore built-in 24h cycle</span>
          <button
            type="button"
            onClick={onResetDefault}
            className="text-xs font-medium text-[#475569] hover:text-[#111315] underline underline-offset-2"
          >
            Reset Sample Data
          </button>
        </div>
      </div>

      {/* Right: Upload .xlsx/.csv or Paste Rows from OneDrive */}
      <div className="lg:col-span-7 bg-white border border-[#E4E5E2] rounded-xl p-6 flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ECEEE9] pb-4">
          <div>
            <h3 className="text-base font-semibold text-[#111315] font-display">
              Import Schedule Data
            </h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              Supports Excel time fractions, 00:00–24:00 strings, and decimal hours.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-[#F3F4F1] rounded-lg">
            <button
              type="button"
              onClick={() => setInputMode('file')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                inputMode === 'file'
                  ? 'bg-white text-[#111315] shadow-xs'
                  : 'text-[#64748B] hover:text-[#111315]'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Upload .xlsx / .csv
            </button>
            <button
              type="button"
              onClick={() => setInputMode('paste')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                inputMode === 'paste'
                  ? 'bg-white text-[#111315] shadow-xs'
                  : 'text-[#64748B] hover:text-[#111315]'
              }`}
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              Paste from Excel
            </button>
          </div>
        </div>

        {inputMode === 'file' ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFileChange(e.dataTransfer.files?.[0]);
            }}
            className="border border-dashed border-[#CBD5E1] rounded-xl bg-[#FAFAF8] p-7 text-center flex flex-col items-center gap-3"
          >
            <Upload className="w-6 h-6 text-[#475569]" />
            <div>
              <p className="text-sm font-medium text-[#111315]">
                Drop your .xlsx, .xls, or .csv file here
              </p>
              <p className="text-xs text-[#64748B] mt-1">
                In OneDrive Excel, choose File → Save As → Download a Copy.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => handleFileChange(e.target.files?.[0])}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#111315] hover:bg-[#272A2E] rounded-lg transition-colors"
            >
              Select Workbook File
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <textarea
              rows={5}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={
                'Paste cells directly from OneDrive Excel (Cmd/Ctrl+C → Cmd/Ctrl+V), e.g.:\nTitle\tStart\tEnd\tCategory\nMorning Sync\t08:00\t09:30\tSync\nDeep Production\t09:30\t13:00\tFocus'
              }
              className="w-full p-3 text-xs font-mono bg-[#FAFAF8] border border-[#E4E5E2] rounded-lg focus:outline-none focus:border-[#111315] text-[#111315]"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleParsePaste}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#111315] hover:bg-[#272A2E] rounded-lg transition-colors"
              >
                Parse Pasted Rows
              </button>
            </div>
          </div>
        )}

        {importError && (
          <p className="text-xs font-medium text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2">
            {importError}
          </p>
        )}

        {importSuccess && (
          <p className="text-xs font-medium text-[#166534] bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg px-3 py-2">
            {importSuccess}
          </p>
        )}

        {/* Column Mapping & Preview */}
        {preview && (
          <div className="border-t border-[#ECEEE9] pt-5 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-[#475569]">
                <span className="font-semibold text-[#111315]">{preview.fileName}</span>
                <span className="mx-2" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono tabular-nums">
                  {preview.rows.length} raw rows
                </span>
              </div>
              {preview.sheetNames.length > 1 && (
                <select
                  value={preview.activeSheet}
                  onChange={(e) => handleSheetSwitch(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-[#FAFAF8] border border-[#E4E5E2] rounded-lg"
                >
                  {preview.sheetNames.map((name) => (
                    <option key={name} value={name}>
                      Sheet: {name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(
                [
                  { key: 'titleCol', label: 'Title Column' },
                  { key: 'startCol', label: 'Start Time' },
                  { key: 'endCol', label: 'End Time' },
                  { key: 'categoryCol', label: 'Category (opt)' },
                  { key: 'ownerCol', label: 'Owner (opt)' },
                  { key: 'notesCol', label: 'Notes (opt)' },
                ] as const
              ).map((field) => (
                <div key={field.key}>
                  <label className="block text-[11px] font-medium text-[#64748B] mb-1">
                    {field.label}
                  </label>
                  <select
                    value={mapping[field.key]}
                    onChange={(e) =>
                      setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 text-xs bg-[#FAFAF8] border border-[#E4E5E2] rounded-lg"
                  >
                    <option value="">— None —</option>
                    {preview.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Preview Table */}
            <div className="border border-[#E4E5E2] rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-[#FAFAF8] border-b border-[#ECEEE9] flex items-center justify-between text-xs">
                <span className="font-medium text-[#111315]">
                  Mapped 00–24 Preview ({mappedResult.blocks.length} valid)
                </span>
                {mappedResult.skippedCount > 0 && (
                  <span className="text-[#B45309]">
                    {mappedResult.skippedCount} skipped (missing start/end)
                  </span>
                )}
              </div>
              <div className="max-h-44 overflow-y-auto divide-y divide-[#ECEEE9]">
                {mappedResult.blocks.slice(0, 8).map((b) => (
                  <div
                    key={b.id}
                    className="px-3 py-2 flex items-center justify-between text-xs gap-4"
                  >
                    <span className="font-medium text-[#111315] truncate">
                      {b.title}
                    </span>
                    <span className="font-mono tabular-nums text-[#475569] shrink-0">
                      {formatMinutes(b.startMinutes)}–{formatMinutes(b.endMinutes, true)}{' '}
                      ({formatDuration(getDurationMinutes(b.startMinutes, b.endMinutes))})
                    </span>
                  </div>
                ))}
                {mappedResult.blocks.length === 0 && (
                  <p className="p-4 text-xs text-[#64748B] text-center">
                    No valid time rows matched yet. Adjust Start Time and End Time
                    columns above.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => handleApply('merge')}
                disabled={mappedResult.blocks.length === 0}
                className="px-3.5 py-2 text-xs font-medium text-[#111315] bg-[#FAFAF8] border border-[#E4E5E2] hover:border-[#CBD5E1] rounded-lg disabled:opacity-40 transition-colors"
              >
                Append to Existing
              </button>
              <button
                type="button"
                onClick={() => handleApply('replace')}
                disabled={mappedResult.blocks.length === 0}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#111315] hover:bg-[#272A2E] rounded-lg disabled:opacity-40 transition-colors"
              >
                Replace 391K Dial Schedule
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
