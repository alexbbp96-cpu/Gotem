import * as XLSX from 'xlsx';
import { CategoryKey, TimeBlock } from '../types/schedule';
import { formatMinutes, parseFlexibleTime } from './timeMath';

export interface ParsedSheetPreview {
  fileName: string;
  sheetNames: string[];
  activeSheet: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

export interface ColumnMapping {
  titleCol: string;
  startCol: string;
  endCol: string;
  categoryCol: string;
  ownerCol: string;
  notesCol: string;
}

function normalizeCategory(val: unknown): CategoryKey {
  const s = String(val ?? '').trim().toLowerCase();
  if (!s) return 'operations';
  if (s.includes('focus') || s.includes('deep') || s.includes('build') || s.includes('work') || s.includes('prod')) {
    return 'focus';
  }
  if (s.includes('sync') || s.includes('meet') || s.includes('review') || s.includes('brief')) {
    return 'sync';
  }
  if (s.includes('rest') || s.includes('sleep') || s.includes('break') || s.includes('recov') || s.includes('off')) {
    return 'rest';
  }
  if (s.includes('disp') || s.includes('trans') || s.includes('ship') || s.includes('urgent') || s.includes('alert')) {
    return 'transit';
  }
  return 'operations';
}

export function autoDetectMapping(headers: string[]): ColumnMapping {
  const find = (patterns: RegExp[]): string => {
    for (const p of patterns) {
      const hit = headers.find((h) => p.test(h.trim()));
      if (hit) return hit;
    }
    return '';
  };

  const titleCol =
    find([/^(title|task|name|activity|event|block|item|subject|label)/i]) ||
    headers[0] ||
    '';
  const startCol =
    find([/^(start|from|begin|open|time\s*in|in)/i, /start/i]) ||
    headers[1] ||
    '';
  const endCol =
    find([/^(end|to|finish|close|until|time\s*out|out)/i, /end/i]) ||
    headers[2] ||
    '';
  const categoryCol = find([/^(cat|type|group|tag|phase|status|kind)/i]);
  const ownerCol = find([/^(owner|lead|person|team|assignee|who)/i]);
  const notesCol = find([/^(note|desc|detail|comment|remark)/i]);

  return {
    titleCol,
    startCol,
    endCol,
    categoryCol,
    ownerCol,
    notesCol,
  };
}

export async function parseSpreadsheetFile(
  file: File,
  requestedSheet?: string
): Promise<ParsedSheetPreview> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetNames = workbook.SheetNames;
  const activeSheet =
    requestedSheet && sheetNames.includes(requestedSheet)
      ? requestedSheet
      : sheetNames[0];

  const worksheet = workbook.Sheets[activeSheet];
  const rawJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
    raw: true,
  });

  const headers =
    rawJson.length > 0
      ? Object.keys(rawJson[0])
      : ((XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 })[0] ?? []).map(
          String
        ));

  return {
    fileName: file.name,
    sheetNames,
    activeSheet,
    headers,
    rows: rawJson,
  };
}

export function parsePastedTabularText(text: string): ParsedSheetPreview {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      fileName: 'Clipboard Paste',
      sheetNames: ['Pasted Rows'],
      activeSheet: 'Pasted Rows',
      headers: [],
      rows: [],
    };
  }

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const matrix = lines.map((line) => line.split(delimiter).map((c) => c.trim()));

  // Check if first row looks like headers or direct data
  const firstRowHasTime = matrix[0].some((cell) => parseFlexibleTime(cell) !== null);
  let headers: string[];
  let dataRows: string[][];

  if (firstRowHasTime) {
    headers = matrix[0].map((_, idx) => `Column ${idx + 1}`);
    dataRows = matrix;
  } else {
    headers = matrix[0].map((h, idx) => h || `Column ${idx + 1}`);
    dataRows = matrix.slice(1);
  }

  const rows: Record<string, unknown>[] = dataRows.map((cells) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? '';
    });
    return obj;
  });

  return {
    fileName: 'OneDrive / Excel Clipboard',
    sheetNames: ['Pasted Rows'],
    activeSheet: 'Pasted Rows',
    headers,
    rows,
  };
}

export function mapRowsToTimeBlocks(
  rows: Record<string, unknown>[],
  mapping: ColumnMapping
): { blocks: TimeBlock[]; skippedCount: number } {
  const blocks: TimeBlock[] = [];
  let skippedCount = 0;

  rows.forEach((row, index) => {
    const startVal = mapping.startCol ? row[mapping.startCol] : null;
    const endVal = mapping.endCol ? row[mapping.endCol] : null;
    const startMinutes = parseFlexibleTime(startVal);
    const endMinutes = parseFlexibleTime(endVal);

    if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) {
      skippedCount++;
      return;
    }

    const rawTitle = mapping.titleCol ? String(row[mapping.titleCol] ?? '').trim() : '';
    const title = rawTitle || `Block ${blocks.length + 1}`;
    const category = mapping.categoryCol
      ? normalizeCategory(row[mapping.categoryCol])
      : 'operations';
    const owner = mapping.ownerCol ? String(row[mapping.ownerCol] ?? '').trim() : '';
    const notes = mapping.notesCol ? String(row[mapping.notesCol] ?? '').trim() : '';

    blocks.push({
      id: `imp-${Date.now()}-${index}`,
      title,
      startMinutes: startMinutes === 1440 ? 0 : startMinutes,
      endMinutes,
      category,
      owner: owner || undefined,
      notes,
    });
  });

  return { blocks, skippedCount };
}

export function exportBlocksToXlsx(blocks: TimeBlock[], fileName = '391K-24h-schedule.xlsx') {
  const sheetRows = blocks.map((b) => ({
    Title: b.title,
    Start: formatMinutes(b.startMinutes, false),
    End: formatMinutes(b.endMinutes, true),
    Category: b.category,
    Owner: b.owner ?? '',
    Notes: b.notes,
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  worksheet['!cols'] = [
    { wch: 32 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
    { wch: 16 },
    { wch: 42 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '391K 00-24 Cycle');
  XLSX.writeFile(workbook, fileName);
}

export function exportBlocksToCsv(blocks: TimeBlock[], fileName = '391K-24h-schedule.csv') {
  const header = ['Title', 'Start', 'End', 'Category', 'Owner', 'Notes'];
  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const lines = [
    header.join(','),
    ...blocks.map((b) =>
      [
        escape(b.title),
        escape(formatMinutes(b.startMinutes, false)),
        escape(formatMinutes(b.endMinutes, true)),
        escape(b.category),
        escape(b.owner ?? ''),
        escape(b.notes),
      ].join(',')
    ),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
