// Division configuration for NWH Call Tracker

export type Division = 'all' | 'nh-sales' | 'nh-service' | 'rr-sales' | 'rr-service';

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
    name: 'Nationwide Haul - Sales',
    shortName: 'NH Sales',
    color: 'text-[#0f172a]',
    bgColor: 'bg-[#f1f5f9]',
  },
  'nh-service': {
    id: 'nh-service',
    name: 'Nationwide Haul - Service & Repair',
    shortName: 'NH Service',
    color: 'text-[#0284c7]',
    bgColor: 'bg-[#e0f2fe]',
  },
  'rr-sales': {
    id: 'rr-sales',
    name: 'Road Ready Insurance - Sales',
    shortName: 'RR Sales',
    color: 'text-[#01B574]',
    bgColor: 'bg-[#E6FAF5]',
  },
  'rr-service': {
    id: 'rr-service',
    name: 'Road Ready Insurance - Service',
    shortName: 'RR Service',
    color: 'text-[#FFB547]',
    bgColor: 'bg-[#FFF6E5]',
  },
};

// Map rep names (lowercase) to their division
const REP_DIVISION_MAP: Record<string, Division> = {
  // Nationwide Haul - Sales
  'matt': 'nh-sales',
  'brian': 'nh-sales',
  'vanessa': 'nh-sales',
  'jake': 'nh-sales',

  // Nationwide Haul - Service & Repair
  'dustin': 'nh-service',
  'rocco': 'nh-service',

  // Road Ready Insurance - Sales
  'sean': 'rr-sales',
  'herb': 'rr-sales',
  'adam': 'rr-sales',
  'katrina': 'rr-sales',
  'sladana': 'rr-sales',

  // Road Ready Insurance - Service
  'nikita': 'rr-service',
  'luis': 'rr-service',
  'rossy': 'rr-service',
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
