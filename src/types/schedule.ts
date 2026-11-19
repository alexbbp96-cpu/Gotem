export type CategoryKey = 'operations' | 'focus' | 'sync' | 'rest' | 'transit';

export interface TimeBlock {
  id: string;
  title: string;
  /** Minutes from 00:00 (0 to 1439) */
  startMinutes: number;
  /** Minutes from 00:00 (1 to 1440). If < startMinutes, wraps past 24:00 */
  endMinutes: number;
  category: CategoryKey;
  owner?: string;
  notes: string;
}

export interface DialConfig {
  zeroPosition: 'top' | 'bottom';
  dialTheme: 'light' | 'obsidian';
  showSecondsHand: boolean;
  snapMinutes: 5 | 15 | 30;
  showLabelsOnRing: boolean;
}

export interface WorkbookSourceInfo {
  oneDriveUrl: string;
  fileName: string;
  sheetName: string;
  lastImportedAt: string | null;
  rowCount: number;
}

export interface CategoryMeta {
  key: CategoryKey;
  label: string;
  color: string;
  softBg: string;
  textColor: string;
}

export const CATEGORY_META: Record<CategoryKey, CategoryMeta> = {
  operations: {
    key: 'operations',
    label: 'Operations',
    color: '#1D4ED8',
    softBg: 'rgba(29, 78, 216, 0.12)',
    textColor: '#1E40AF',
  },
  focus: {
    key: 'focus',
    label: 'Deep Work',
    color: '#15803D',
    softBg: 'rgba(21, 128, 61, 0.12)',
    textColor: '#166534',
  },
  sync: {
    key: 'sync',
    label: 'Sync & Review',
    color: '#B45309',
    softBg: 'rgba(180, 83, 9, 0.12)',
    textColor: '#92400E',
  },
  transit: {
    key: 'transit',
    label: 'Dispatch',
    color: '#D9381E',
    softBg: 'rgba(217, 56, 30, 0.12)',
    textColor: '#B91C1C',
  },
  rest: {
    key: 'rest',
    label: 'Recovery',
    color: '#475569',
    softBg: 'rgba(71, 85, 105, 0.12)',
    textColor: '#334155',
  },
};
