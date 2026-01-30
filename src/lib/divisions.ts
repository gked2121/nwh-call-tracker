// Division configuration for NWH Call Tracker

export type Division = 'all' | 'nh-sales' | 'service-repair' | 'road-ready';

export interface DivisionInfo {
  id: Division;
  name: string;
  shortName: string;
  color: string;
  bgColor: string;
}

export const DIVISIONS: Record<Division, DivisionInfo> = {
  'all': {
    id: 'all',
    name: 'All Divisions',
    shortName: 'All',
    color: 'text-[#1B254B]',
    bgColor: 'bg-[#F4F7FE]',
  },
  'nh-sales': {
    id: 'nh-sales',
    name: 'Nationwide Haul (Sales)',
    shortName: 'NH Sales',
    color: 'text-[#0f172a]',
    bgColor: 'bg-[#f1f5f9]',
  },
  'service-repair': {
    id: 'service-repair',
    name: 'Service & Repair',
    shortName: 'Service',
    color: 'text-[#01B574]',
    bgColor: 'bg-[#E6FAF5]',
  },
  'road-ready': {
    id: 'road-ready',
    name: 'Road Ready Insurance',
    shortName: 'Road Ready',
    color: 'text-[#FFB547]',
    bgColor: 'bg-[#FFF6E5]',
  },
};

// Map rep names (lowercase) to their division
const REP_DIVISION_MAP: Record<string, Division> = {
  // NH Sales
  'jake': 'nh-sales',
  'matt': 'nh-sales',
  'vanessa': 'nh-sales',
  'brian': 'nh-sales',
  'pablo': 'nh-sales',

  // Service & Repair
  'dustin': 'service-repair',
  'rocco': 'service-repair',
  'sean': 'service-repair',
  'erika': 'service-repair',
  'katrina': 'service-repair',

  // Road Ready Insurance
  'nikita': 'road-ready',
  'sladana': 'road-ready',
  'jennine': 'road-ready',
  'adam': 'road-ready',
  'rossy': 'road-ready',
  'herb': 'road-ready',
  'luis': 'road-ready',
};

/**
 * Get the division for a rep name
 * Returns 'nh-sales' as default for unknown reps (most common case)
 */
export function getRepDivision(repName: string | null | undefined): Division {
  if (!repName) return 'nh-sales';
  const normalized = repName.toLowerCase().trim();
  return REP_DIVISION_MAP[normalized] || 'nh-sales';
}

/**
 * Get division info for a rep
 */
export function getRepDivisionInfo(repName: string | null | undefined): DivisionInfo {
  const division = getRepDivision(repName);
  return DIVISIONS[division];
}

/**
 * Check if a rep belongs to a division
 */
export function repMatchesDivision(repName: string | null | undefined, division: Division): boolean {
  if (division === 'all') return true;
  return getRepDivision(repName) === division;
}

/**
 * Get all division options for a dropdown
 */
export function getDivisionOptions(): DivisionInfo[] {
  return Object.values(DIVISIONS);
}
