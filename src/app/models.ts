// Core domain models for the ballistic dope card app

export type ScopeClickUnit = 'MIL' | 'MOA';

export interface Rifle {
  id: number;

  // Basic rifle info
  name: string;                 // e.g. "Remington"
  caliber: string;              // e.g. "33XC"
  barrelLengthCm?: number;      // optional – one of these
  barrelLengthInch?: number;    // optional

  twistRate?: string;           // e.g. "1:9"
  muzzleVelocityFps?: number;   // e.g. 3025

  // Optic
  scopeModel?: string;
  scopeClickUnit?: ScopeClickUnit; // MIL / MOA

  // Bullet
  bulletName?: string;          // e.g. "Berger Hybrid"
  bulletWeightGr?: number;      // e.g. 300
  bulletBcG1?: number;          // e.g. 0.471

  notes?: string;
}

export interface LoadData {
  id: number;
  rifleId: number;          // which rifle this belongs to

  powder: string;
  powderChargeGn: number;
  coalMm?: number;
  coalInch?: number;
  primer: string;
  notes?: string;
}

export interface SubRange {
  id: number;
  name?: string;           // e.g. "600 m gong", "Lane 3"
  distanceM: number;
  firingPointName?: string;
  targetType?: string;
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
