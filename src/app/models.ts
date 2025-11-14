// Core domain models for the ballistic dope card app

export type ScopeClickUnit = 'MIL' | 'MOA';

// ---------- Rifle & load data ----------

export interface LoadData {
  id: number;
  powder: string;          // e.g. N570
  powderChargeGr: number;  // grains
  coal: string;            // COAL text, e.g. 3.456"
  primer: string;          // e.g. "CCI 450"
}

export interface Rifle {
  id: number;

  // Identity
  name: string;            // e.g. "Remington"
  caliber: string;         // e.g. "33XC"

  // Barrel
  barrelLength?: number;   // numeric value
  barrelLengthUnit?: 'cm' | 'in';
  twistRate?: string;      // e.g. "1:9"

  // Ballistics
  muzzleVelocityFps?: number; // fps
  scope?: string;             // scope model
  scopeClickUnit?: ScopeClickUnit;

  // Bullet
  bulletWeightGr?: number;
  bulletBc?: number;
  bulletName?: string;    // e.g. "300gr Berger Hybrid"

  // Notes
  notes?: string;

  // Load data entries (separate panel)
  loads?: LoadData[];
}

// ---------- Venues & sub-ranges ----------

export interface SubRange {
  id: number;
  name: string;          // e.g. "Warrior", "Zeiss", "Lane 3"
  distancesM: number[];  // e.g. [500, 578, 780]
}

export interface Venue {
  id: number;
  name: string;
  location?: string;
  altitudeM?: number;
  notes?: string;
  subRanges: SubRange[];
}

// ---------- Sessions / environment ----------

export interface Environment {
  temperatureC?: number;
  pressureHpa?: number;
  humidityPercent?: number;
  densityAltitudeM?: number;
  windSpeedMps?: number;
  windDirectionDeg?: number;
  lightConditions?: string;
}

export interface DistanceDope {
  subRangeId?: number;
  distanceM: number;
  elevationClicks?: number;
  windageClicks?: number;
  elevationMil?: number;
  windageMil?: number;
  groupSizeMoA?: number;
  impactsDescription?: string;
}

export interface Session {
  id: number;
  date: string;           // ISO string
  rifleId: number;
  venueId: number;
  title?: string;
  environment: Environment;
  dope: DistanceDope[];
  notes?: string;
}
