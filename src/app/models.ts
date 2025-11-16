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
  roundCount?: number;       // 🔥 total rounds through this rifle
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
  windSpeedMps?: number;
  windDirectionDeg?: number;
  lightConditions?: string;
}

export interface DistanceDope {
  subRangeId?: number;
  distanceM: number;
  elevationMil?: number;
  windageMil?: number;
  impactsDescription?: string;
  // (clicks/group MOA were removed in your last change)
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
