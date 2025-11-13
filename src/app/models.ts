// src/app/models.ts

export type ScopeClickUnit = 'MIL' | 'MOA';

export interface Rifle {
  id: number;
  name: string;
  caliber: string;
  barrelLengthCm?: number;
  twistRate?: string;
  bulletWeightGr?: number;
  muzzleVelocityMs?: number;
  zeroRangeM?: number;
  scopeModel?: string;
  scopeClickUnit?: ScopeClickUnit;
  scopeClickValue?: number; // e.g. 0.1 MIL or 0.25 MOA
  notes?: string;
}

export interface SubRange {
  id: number;
  distanceM: number;
  firingPointName?: string;
  targetType?: string; // steel, paper, gong, etc.
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
  windSpeedMps?: number;
  windDirectionDeg?: number;
  densityAltitudeM?: number;
  lightConditions?: string; // e.g. "Overcast", "Bright sun"
}

export interface DistanceDope {
  subRangeId: number;
  distanceM: number;
  elevationClicks?: number;
  windageClicks?: number;
  elevationMil?: number;
  windageMil?: number;
  elevationMoa?: number;
  windageMoa?: number;
  groupSizeMoA?: number;
  impactsDescription?: string; // e.g. "0.3 mil high, 0.2 left"
  notes?: string;
}

export interface Session {
  id: number;
  date: string; // ISO string
  rifleId: number;
  venueId: number;
  title?: string;
  environment: Environment;
  dope: DistanceDope[];
  notes?: string;
}
