export interface RifleLoad {
  id: number;
  powder: string;
  chargeGn: number;
  coal: string;
  primer: string;
}

export type ScopeUnit = 'MIL' | 'MOA';

export interface Rifle {
  id: number;
  name: string;
  caliber: string;
  barrelLength: number | null;
  barrelUnit: 'cm' | 'inch';
  twistRate: string;
  muzzleVelocityFps: number | null;
  scopeUnit: ScopeUnit;
  bulletBc: string;
  bulletWeightGr: number | null;
  bulletName: string;
  notes?: string;
  roundCount?: number;       // total rounds through this rifle
  loads: RifleLoad[];
}

export interface SubRange {
  id: number;
  name: string;
  distancesM: number[];
}

export interface Venue {
  id: number;
  name: string;
  location?: string;
  altitudeM?: number;
  notes?: string;
  subRanges: SubRange[];
}

export interface Environment {
  temperatureC?: number;
  pressureHpa?: number;
  humidityPercent?: number;
  densityAltitudeM?: number;
  windSpeedMps?: number;        // currently used as mph in UI
  windDirectionDeg?: number;    // derived from wind clock
  lightConditions?: string;
}

export interface DistanceDope {
  subRangeId?: number;
  distanceM: number;
  elevationMil?: number;
  windageMil?: number;
  impactsDescription?: string;
}

export interface Session {
  id: number;
  date: string;
  rifleId: number;
  venueId: number;
  title?: string;
  environment: Environment;
  dope: DistanceDope[];
  notes?: string;
  completed?: boolean;
}

/* ============================
   Load development models
   ============================ */

export type LoadDevType = 'ladder' | 'ocw' | 'groups';

export type GroupSizeUnit = 'MOA' | 'mm';

export interface LoadDevEntry {
  id: number;
  // Nest inside project, no need for projectId field here
  loadLabel: string;         // e.g. "42.3 gr N570 / 140 ELD-M / 2.810"
  powder?: string;
  chargeGr?: number;
  coal?: string;
  primer?: string;
  bullet?: string;
  bulletWeightGr?: number;
  distanceM?: number;
  shotsFired?: number;
  groupSize?: number;
  groupUnit?: GroupSizeUnit;
  poiNote?: string;          // POI relative to aim, free text
  notes?: string;
}

export interface LoadDevProject {
  id: number;
  rifleId: number;
  name: string;              // "N570 6.5 CM ladder 2025-01"
  type: LoadDevType;
  dateStarted: string;       // ISO string
  notes?: string;
  entries: LoadDevEntry[];
}
