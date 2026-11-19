import { TimeBlock, WorkbookSourceInfo } from '../types/schedule';

export const USER_ONEDRIVE_WORKBOOK_URL =
  'https://1drv.ms/x/c/d219be52c585ab2a/IQCGg2N4nb8hR4sRfUp20ZJfAbiYKGq42M1wI1IGuerq-uo?e=4%3aFr10hj&sharingv2=true&fromShare=true&at=9';

export const DEFAULT_WORKBOOK_INFO: WorkbookSourceInfo = {
  oneDriveUrl: USER_ONEDRIVE_WORKBOOK_URL,
  fileName: '391K-24h-Cycle.xlsx',
  sheetName: 'Daily Cycle (00–24)',
  lastImportedAt: null,
  rowCount: 7,
};

export const DEFAULT_SCHEDULE_BLOCKS: TimeBlock[] = [
  {
    id: 'blk-01',
    title: 'Overnight Recovery & Quiet Hours',
    startMinutes: 0,
    endMinutes: 360, // 00:00 - 06:00
    category: 'rest',
    owner: '391K Core',
    notes: 'Automated overnight monitoring window with zero active dispatch.',
  },
  {
    id: 'blk-02',
    title: 'Morning Briefing & Sheet Check',
    startMinutes: 390, // 06:30
    endMinutes: 480, // 08:00
    category: 'sync',
    owner: 'Shift Lead',
    notes: 'Verify workbook targets, open queue items, and daily priorities.',
  },
  {
    id: 'blk-03',
    title: 'Primary Production Window',
    startMinutes: 480, // 08:00
    endMinutes: 750, // 12:30
    category: 'focus',
    owner: 'Studio Team',
    notes: 'Core execution block across primary 391K deliverables.',
  },
  {
    id: 'blk-04',
    title: 'Midday Reset & Transit',
    startMinutes: 750, // 12:30
    endMinutes: 810, // 13:30
    category: 'rest',
    owner: 'All',
    notes: 'Scheduled midday break and logistics handoff.',
  },
  {
    id: 'blk-05',
    title: 'Client Operations & Dispatch',
    startMinutes: 810, // 13:30
    endMinutes: 1020, // 17:00
    category: 'operations',
    owner: 'Operations',
    notes: 'Active fulfillment, outbound communications, and live updates.',
  },
  {
    id: 'blk-06',
    title: 'Late Dispatch & Closing Sync',
    startMinutes: 1050, // 17:30
    endMinutes: 1170, // 19:30
    category: 'transit',
    owner: 'Dispatch',
    notes: 'Final outbound batch and end-of-day workbook reconciliation.',
  },
  {
    id: 'blk-07',
    title: 'Evening Standby Cycle',
    startMinutes: 1200, // 20:00
    endMinutes: 1380, // 23:00
    category: 'operations',
    owner: 'Night Desk',
    notes: 'Low-volume evening coverage before midnight cycle reset.',
  },
];
